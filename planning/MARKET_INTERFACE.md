# Market Data Interface

This document defines the unified Python interface for retrieving stock prices in FinAlly. The backend selects an implementation at startup based on environment variables. All downstream code (SSE streaming, price cache, API routes) uses only this interface.

---

## Design Principles

- One abstract base class, two concrete implementations: `MassiveMarketData` and `SimulatedMarketData`
- Selection is purely environment-variable driven — no runtime switching
- Callers never import a concrete class; they call `create_market_data_provider()`
- The price cache is owned by the provider, not by callers
- All methods are `async`

---

## Data Types

```python
# backend/market/types.py

from dataclasses import dataclass, field
from typing import Optional
import time


@dataclass
class PricePoint:
    """A single price observation for one ticker."""
    ticker: str
    price: float
    prev_price: float          # price at the previous observation (for flash direction)
    timestamp: float           # Unix timestamp (seconds, float)
    change: float              # price - prev_close (today's change in dollars)
    change_pct: float          # percent change from prev close


@dataclass
class TickerHistory:
    """Rolling price history for one ticker (last N points)."""
    ticker: str
    prices: list[float] = field(default_factory=list)
    timestamps: list[float] = field(default_factory=list)
    max_points: int = 200

    def append(self, price: float, timestamp: float) -> None:
        self.prices.append(price)
        self.timestamps.append(timestamp)
        if len(self.prices) > self.max_points:
            self.prices.pop(0)
            self.timestamps.pop(0)
```

---

## Abstract Base Class

```python
# backend/market/base.py

from abc import ABC, abstractmethod
from .types import PricePoint, TickerHistory


class MarketDataProvider(ABC):
    """
    Abstract interface for market data. Two implementations exist:
      - MassiveMarketData  (MASSIVE_API_KEY is set)
      - SimulatedMarketData (default)

    Lifecycle:
      1. await provider.start(tickers)   — begin background polling/simulation
      2. provider.get_price(ticker)      — read latest price (sync, from cache)
      3. provider.get_all_prices()       — read all latest prices (sync, from cache)
      4. provider.get_history(ticker)    — read rolling history (sync, from cache)
      5. await provider.add_ticker(t)    — add a ticker at runtime
      6. await provider.remove_ticker(t) — remove a ticker at runtime
      7. await provider.stop()           — clean shutdown
    """

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Start the background data collection task for the given tickers."""
        ...

    @abstractmethod
    async def stop(self) -> None:
        """Stop the background task cleanly."""
        ...

    @abstractmethod
    def get_price(self, ticker: str) -> PricePoint | None:
        """Return the latest cached PricePoint for ticker, or None if unknown."""
        ...

    @abstractmethod
    def get_all_prices(self) -> dict[str, PricePoint]:
        """Return a dict of ticker → PricePoint for all tracked tickers."""
        ...

    @abstractmethod
    def get_history(self, ticker: str) -> TickerHistory | None:
        """Return rolling price history for ticker, or None if unknown."""
        ...

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the tracked set. No-op if already tracked."""
        ...

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker from the tracked set. No-op if not tracked."""
        ...

    @property
    @abstractmethod
    def tickers(self) -> set[str]:
        """The set of tickers currently being tracked."""
        ...
```

---

## Factory Function

```python
# backend/market/__init__.py

import os
from .base import MarketDataProvider
from .massive import MassiveMarketData
from .simulator import SimulatedMarketData


def create_market_data_provider() -> MarketDataProvider:
    """
    Return the appropriate MarketDataProvider based on environment variables.

    If MASSIVE_API_KEY is set and non-empty → MassiveMarketData
    Otherwise                               → SimulatedMarketData
    """
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()
    if api_key:
        return MassiveMarketData(api_key=api_key)
    return SimulatedMarketData()
```

---

## Massive Implementation

```python
# backend/market/massive.py

import asyncio
import httpx
import time
import logging
from .base import MarketDataProvider
from .types import PricePoint, TickerHistory

logger = logging.getLogger(__name__)

BASE_URL = "https://api.massive.com"
POLL_INTERVAL = 15.0   # seconds — safe for free tier (5 req/min)


class MassiveMarketData(MarketDataProvider):
    """
    Polls the Massive REST API on a fixed interval.

    Uses GET /v2/snapshot/locale/us/markets/stocks/tickers?tickers=A,B,C
    to retrieve prices for all tracked tickers in one request.
    """

    def __init__(self, api_key: str, poll_interval: float = POLL_INTERVAL):
        self._api_key = api_key
        self._poll_interval = poll_interval
        self._tickers: set[str] = set()
        self._cache: dict[str, PricePoint] = {}
        self._history: dict[str, TickerHistory] = {}
        self._task: asyncio.Task | None = None
        self._http: httpx.AsyncClient | None = None

    @property
    def tickers(self) -> set[str]:
        return set(self._tickers)

    async def start(self, tickers: list[str]) -> None:
        self._tickers = set(t.upper() for t in tickers)
        for t in self._tickers:
            self._history[t] = TickerHistory(ticker=t)
        self._http = httpx.AsyncClient(timeout=10.0)
        self._task = asyncio.create_task(self._poll_loop())
        logger.info("MassiveMarketData started for %d tickers", len(self._tickers))

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        if self._http:
            await self._http.aclose()
        logger.info("MassiveMarketData stopped")

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        if ticker not in self._tickers:
            self._tickers.add(ticker)
            self._history[ticker] = TickerHistory(ticker=ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        self._tickers.discard(ticker)
        self._cache.pop(ticker, None)
        self._history.pop(ticker, None)

    def get_price(self, ticker: str) -> PricePoint | None:
        return self._cache.get(ticker.upper())

    def get_all_prices(self) -> dict[str, PricePoint]:
        return dict(self._cache)

    def get_history(self, ticker: str) -> TickerHistory | None:
        return self._history.get(ticker.upper())

    async def _poll_loop(self) -> None:
        while True:
            try:
                await self._fetch_and_update()
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("Error polling Massive API")
            await asyncio.sleep(self._poll_interval)

    async def _fetch_and_update(self) -> None:
        if not self._tickers or not self._http:
            return

        tickers_param = ",".join(sorted(self._tickers))
        resp = await self._http.get(
            f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers",
            params={"tickers": tickers_param, "apiKey": self._api_key},
        )
        resp.raise_for_status()
        data = resp.json()

        now = time.time()
        for snap in data.get("tickers", []):
            ticker = snap.get("ticker", "")
            price = _extract_price(snap)
            if price is None or price <= 0:
                continue

            prev_point = self._cache.get(ticker)
            prev_price = prev_point.price if prev_point else price
            prev_close = (snap.get("prevDay") or {}).get("c") or price

            point = PricePoint(
                ticker=ticker,
                price=price,
                prev_price=prev_price,
                timestamp=now,
                change=price - prev_close,
                change_pct=((price - prev_close) / prev_close * 100) if prev_close else 0.0,
            )
            self._cache[ticker] = point

            if ticker not in self._history:
                self._history[ticker] = TickerHistory(ticker=ticker)
            self._history[ticker].append(price, now)


def _extract_price(snap: dict) -> float | None:
    """Best available price from a v2 snapshot ticker object."""
    last_trade = snap.get("lastTrade") or {}
    if p := last_trade.get("p"):
        return float(p)
    day = snap.get("day") or {}
    if p := day.get("c"):
        return float(p)
    prev_day = snap.get("prevDay") or {}
    if p := prev_day.get("c"):
        return float(p)
    return None
```

---

## Usage in FastAPI App

```python
# backend/main.py (simplified)

from contextlib import asynccontextmanager
from fastapi import FastAPI
from .market import create_market_data_provider
from .db import get_watchlist_tickers

provider = create_market_data_provider()

@asynccontextmanager
async def lifespan(app: FastAPI):
    tickers = await get_watchlist_tickers()
    await provider.start(tickers)
    yield
    await provider.stop()

app = FastAPI(lifespan=lifespan)

# SSE streaming endpoint
@app.get("/api/stream/prices")
async def stream_prices():
    from sse_starlette.sse import EventSourceResponse
    import asyncio, json

    async def generate():
        while True:
            prices = provider.get_all_prices()
            for point in prices.values():
                yield {
                    "event": "price",
                    "data": json.dumps({
                        "ticker": point.ticker,
                        "price": point.price,
                        "prev_price": point.prev_price,
                        "change": point.change,
                        "change_pct": point.change_pct,
                        "timestamp": point.timestamp,
                    })
                }
            await asyncio.sleep(0.5)

    return EventSourceResponse(generate())

# Price history endpoint
@app.get("/api/prices/{ticker}/history")
async def price_history(ticker: str):
    history = provider.get_history(ticker.upper())
    if history is None:
        return {"ticker": ticker, "prices": [], "timestamps": []}
    return {
        "ticker": history.ticker,
        "prices": history.prices,
        "timestamps": history.timestamps,
    }
```

---

## Provider Selection Summary

| `MASSIVE_API_KEY` env var | Provider used | Data source |
|---|---|---|
| Not set or empty | `SimulatedMarketData` | GBM-based in-process simulation |
| Set to a valid key | `MassiveMarketData` | Massive REST API, polled every 15s |

No code changes are required to switch between providers — it is purely configuration.
