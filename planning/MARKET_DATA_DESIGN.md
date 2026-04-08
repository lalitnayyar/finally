# Market Data Backend — Complete Design

Implementation guide for the FinAlly market data subsystem. Covers all modules in `backend/app/market/` with full code, wiring instructions, and testing examples. The market data subsystem is **already built** — this document captures the complete design so that downstream developers (portfolio, watchlist, chat, frontend) can integrate with it correctly.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [File Structure](#2-file-structure)
3. [Data Model — `models.py`](#3-data-model)
4. [Price Cache — `cache.py`](#4-price-cache)
5. [Abstract Interface — `interface.py`](#5-abstract-interface)
6. [Seed Prices & Parameters — `seed_prices.py`](#6-seed-prices--parameters)
7. [GBM Simulator — `simulator.py`](#7-gbm-simulator)
8. [Massive API Client — `massive_client.py`](#8-massive-api-client)
9. [Factory — `factory.py`](#9-factory)
10. [SSE Streaming — `stream.py`](#10-sse-streaming)
11. [FastAPI Lifecycle Integration](#11-fastapi-lifecycle-integration)
12. [Watchlist Coordination](#12-watchlist-coordination)
13. [Price History Extension](#13-price-history-extension)
14. [Error Handling & Edge Cases](#14-error-handling--edge-cases)
15. [Testing Strategy](#15-testing-strategy)
16. [Configuration Summary](#16-configuration-summary)

---

## 1. Architecture Overview

```
Environment variable MASSIVE_API_KEY
          │
          ▼
   create_market_data_source(cache)
          │
    ┌─────┴────────────────────┐
    │                          │
    ▼                          ▼
SimulatorDataSource      MassiveDataSource
(GBM, default)           (Polygon.io REST)
    │                          │
    └──────────┬───────────────┘
               │  writes every 500ms / 15s
               ▼
          PriceCache  (thread-safe in-memory)
               │
       ┌───────┼───────────────┐
       │       │               │
       ▼       ▼               ▼
   SSE stream  Portfolio    Trade execution
   /api/stream/prices  valuation  /api/portfolio/trade
```

**Key design decisions:**

| Decision | Rationale |
|---|---|
| Strategy pattern (ABC) | Both sources are interchangeable; all downstream code is source-agnostic |
| PriceCache as single truth | Producers write, consumers read; no direct coupling between them |
| GBM with Cholesky correlation | Realistic correlated moves: tech stocks move together, etc. |
| SSE over WebSockets | One-way push is all we need; simpler, universal browser support |
| Synchronous Massive client in thread | `asyncio.to_thread()` offloads blocking I/O without blocking the event loop |

---

## 2. File Structure

```
backend/
  app/
    market/
      __init__.py          # Re-exports public API
      models.py            # PriceUpdate dataclass
      cache.py             # PriceCache (thread-safe)
      interface.py         # MarketDataSource ABC
      seed_prices.py       # SEED_PRICES, TICKER_PARAMS, correlation constants
      simulator.py         # GBMSimulator + SimulatorDataSource
      massive_client.py    # MassiveDataSource
      factory.py           # create_market_data_source()
      stream.py            # FastAPI SSE router
```

The `__init__.py` re-exports so that downstream code uses:

```python
from app.market import (
    PriceUpdate,
    PriceCache,
    MarketDataSource,
    create_market_data_source,
    create_stream_router,
)
```

---

## 3. Data Model

**File: `backend/app/market/models.py`**

`PriceUpdate` is the **only** data structure that leaves the market data layer. Every downstream consumer — SSE streaming, portfolio valuation, trade execution — works exclusively with this type.

```python
from __future__ import annotations

import time
from dataclasses import dataclass, field


@dataclass(frozen=True, slots=True)
class PriceUpdate:
    """Immutable snapshot of a single ticker's price at a point in time."""

    ticker: str
    price: float           # Current price, rounded to 2 decimal places
    previous_price: float  # Price from the immediately preceding update
    timestamp: float = field(default_factory=time.time)  # Unix seconds

    @property
    def change(self) -> float:
        """Absolute price change from previous update."""
        return round(self.price - self.previous_price, 4)

    @property
    def change_percent(self) -> float:
        """Percentage change from previous update."""
        if self.previous_price == 0:
            return 0.0
        return round((self.price - self.previous_price) / self.previous_price * 100, 4)

    @property
    def direction(self) -> str:
        """'up', 'down', or 'flat'."""
        if self.price > self.previous_price:
            return "up"
        elif self.price < self.previous_price:
            return "down"
        return "flat"

    def to_dict(self) -> dict:
        """Serialize for JSON / SSE transmission."""
        return {
            "ticker": self.ticker,
            "price": self.price,
            "previous_price": self.previous_price,
            "timestamp": self.timestamp,
            "change": self.change,
            "change_percent": self.change_percent,
            "direction": self.direction,
        }
```

**Design notes:**
- `frozen=True` — immutable; no accidental mutation after creation
- `slots=True` — memory-efficient; avoids `__dict__` overhead for high-frequency objects
- Properties are computed on read, not stored — the dataclass stays lean
- `previous_price == price` on the first update → `direction = "flat"` — safe default

**Usage example:**

```python
update = PriceUpdate(ticker="AAPL", price=191.50, previous_price=190.00)
print(update.change)          # 1.5
print(update.change_percent)  # 0.7895
print(update.direction)       # "up"
print(update.to_dict())
# {"ticker": "AAPL", "price": 191.5, "previous_price": 190.0,
#  "timestamp": 1712345678.0, "change": 1.5, "change_percent": 0.7895, "direction": "up"}
```

---

## 4. Price Cache

**File: `backend/app/market/cache.py`**

Thread-safe in-memory store for the latest price of every tracked ticker. The simulator and Massive client both write here; SSE streaming, portfolio valuation, and trade execution all read from here.

### Current Implementation

```python
from __future__ import annotations

import time
from threading import Lock

from .models import PriceUpdate


class PriceCache:
    """Thread-safe cache of the latest price for each ticker.

    Writers: SimulatorDataSource or MassiveDataSource (one at a time).
    Readers: SSE streaming endpoint, portfolio valuation, trade execution.
    """

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._lock = Lock()
        self._version: int = 0  # Monotonically increasing; bumped on every update

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        """Record a new price for a ticker. Returns the created PriceUpdate.

        Automatically computes direction/change from the previous price.
        If this is the first update for the ticker, previous_price == price.
        """
        with self._lock:
            ts = timestamp or time.time()
            prev = self._prices.get(ticker)
            previous_price = prev.price if prev else price

            update = PriceUpdate(
                ticker=ticker,
                price=round(price, 2),
                previous_price=round(previous_price, 2),
                timestamp=ts,
            )
            self._prices[ticker] = update
            self._version += 1
            return update

    def get(self, ticker: str) -> PriceUpdate | None:
        """Get the latest price for a single ticker, or None if unknown."""
        with self._lock:
            return self._prices.get(ticker)

    def get_all(self) -> dict[str, PriceUpdate]:
        """Snapshot of all current prices. Returns a shallow copy."""
        with self._lock:
            return dict(self._prices)

    def get_price(self, ticker: str) -> float | None:
        """Convenience: get just the price float, or None."""
        update = self.get(ticker)
        return update.price if update else None

    def remove(self, ticker: str) -> None:
        """Remove a ticker from the cache (e.g., removed from watchlist)."""
        with self._lock:
            self._prices.pop(ticker, None)

    @property
    def version(self) -> int:
        """Monotonic counter, incremented on every update. Used by SSE."""
        return self._version

    def __len__(self) -> int:
        with self._lock:
            return len(self._prices)

    def __contains__(self, ticker: str) -> bool:
        with self._lock:
            return ticker in self._prices
```

### Required Extension: Price History

Per PLAN.md section 6, `PriceCache` must also maintain a **rolling history of the last 200 prices per ticker** for the `GET /api/prices/{ticker}/history` endpoint. Add this before building the API layer:

```python
from collections import deque

class PriceCache:
    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._history: dict[str, deque[PriceUpdate]] = {}  # NEW
        self._lock = Lock()
        self._version: int = 0

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        with self._lock:
            ts = timestamp or time.time()
            prev = self._prices.get(ticker)
            previous_price = prev.price if prev else price

            update = PriceUpdate(
                ticker=ticker,
                price=round(price, 2),
                previous_price=round(previous_price, 2),
                timestamp=ts,
            )
            self._prices[ticker] = update

            # Maintain rolling history — NEW
            if ticker not in self._history:
                self._history[ticker] = deque(maxlen=200)
            self._history[ticker].append(update)

            self._version += 1
            return update

    def get_history(self, ticker: str) -> list[PriceUpdate]:
        """Return recent price history for a ticker (up to 200 points)."""
        with self._lock:
            history = self._history.get(ticker)
            return list(history) if history else []

    def remove(self, ticker: str) -> None:
        with self._lock:
            self._prices.pop(ticker, None)
            self._history.pop(ticker, None)  # NEW — clean up history too
```

**Usage:**

```python
cache = PriceCache()
cache.update("AAPL", 190.0)
cache.update("AAPL", 191.5)
cache.update("AAPL", 189.8)

history = cache.get_history("AAPL")
# [PriceUpdate(ticker='AAPL', price=190.0, ...), PriceUpdate(ticker='AAPL', price=191.5, ...), ...]

# For the API endpoint: serialize to list of dicts
payload = [u.to_dict() for u in history]
```

---

## 5. Abstract Interface

**File: `backend/app/market/interface.py`**

The strategy contract. Both `SimulatorDataSource` and `MassiveDataSource` implement this ABC. All downstream code works only with `MarketDataSource` — it never knows which implementation is running.

```python
from __future__ import annotations

from abc import ABC, abstractmethod


class MarketDataSource(ABC):
    """Contract for market data providers.

    Implementations push price updates into a shared PriceCache on their own
    schedule. Downstream code never calls the data source directly for prices —
    it reads from the cache.

    Lifecycle:
        source = create_market_data_source(cache)
        await source.start(["AAPL", "GOOGL", ...])  # starts background task
        await source.add_ticker("PYPL")              # dynamic watchlist change
        await source.remove_ticker("NFLX")
        await source.stop()                          # on app shutdown
    """

    @abstractmethod
    async def start(self, tickers: list[str]) -> None:
        """Begin producing price updates for the given tickers.
        Starts a background task. Call exactly once."""

    @abstractmethod
    async def stop(self) -> None:
        """Stop the background task. Safe to call multiple times."""

    @abstractmethod
    async def add_ticker(self, ticker: str) -> None:
        """Add a ticker to the active set. No-op if already present."""

    @abstractmethod
    async def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker. Also removes it from PriceCache."""

    @abstractmethod
    def get_tickers(self) -> list[str]:
        """Return the current list of actively tracked tickers."""
```

**Calling pattern from the watchlist router:**

```python
# In POST /api/watchlist
await source.add_ticker(ticker.upper())

# In DELETE /api/watchlist/{ticker}
await source.remove_ticker(ticker.upper())
```

---

## 6. Seed Prices & Parameters

**File: `backend/app/market/seed_prices.py`**

All constants that tune the simulator. Extracted into a separate module so `simulator.py` stays focused on logic.

```python
# Realistic starting prices for the default watchlist
SEED_PRICES: dict[str, float] = {
    "AAPL": 190.00,
    "GOOGL": 175.00,
    "MSFT": 420.00,
    "AMZN": 185.00,
    "TSLA": 250.00,
    "NVDA": 800.00,
    "META": 500.00,
    "JPM": 195.00,
    "V": 280.00,
    "NFLX": 600.00,
}

# Per-ticker GBM parameters
# sigma: annualized volatility  (higher = more movement per tick)
# mu:    annualized drift        (expected annual return)
TICKER_PARAMS: dict[str, dict[str, float]] = {
    "AAPL":  {"sigma": 0.22, "mu": 0.05},
    "GOOGL": {"sigma": 0.25, "mu": 0.05},
    "MSFT":  {"sigma": 0.20, "mu": 0.05},
    "AMZN":  {"sigma": 0.28, "mu": 0.05},
    "TSLA":  {"sigma": 0.50, "mu": 0.03},  # High vol — dramatic moves
    "NVDA":  {"sigma": 0.40, "mu": 0.08},  # High vol, strong positive drift
    "META":  {"sigma": 0.30, "mu": 0.05},
    "JPM":   {"sigma": 0.18, "mu": 0.04},  # Low vol (bank)
    "V":     {"sigma": 0.17, "mu": 0.04},  # Low vol (payments)
    "NFLX":  {"sigma": 0.35, "mu": 0.05},
}

# Default for dynamically-added tickers not in the list above
DEFAULT_PARAMS: dict[str, float] = {"sigma": 0.25, "mu": 0.05}

# Correlation groups for Cholesky decomposition
CORRELATION_GROUPS: dict[str, set[str]] = {
    "tech":    {"AAPL", "GOOGL", "MSFT", "AMZN", "META", "NVDA", "NFLX"},
    "finance": {"JPM", "V"},
}

# Pairwise correlation coefficients
INTRA_TECH_CORR    = 0.6   # Tech stocks move together strongly
INTRA_FINANCE_CORR = 0.5   # Finance stocks move together moderately
CROSS_GROUP_CORR   = 0.3   # Between sectors or for unknown tickers
TSLA_CORR          = 0.3   # TSLA does its own thing (in tech set but independent)
```

**To add a new well-known ticker:** add it to both `SEED_PRICES` and `TICKER_PARAMS` with appropriate `sigma` (look up the ticker's historical annualized volatility). Add it to `CORRELATION_GROUPS["tech"]` or `["finance"]` as appropriate.

**Volatility reference guide:**

| Ticker type | Typical sigma range |
|---|---|
| Large-cap stable (bank, payments) | 0.15 – 0.20 |
| Large-cap tech | 0.20 – 0.30 |
| Growth tech / volatile | 0.30 – 0.45 |
| Speculative (TSLA-like) | 0.45 – 0.70 |

---

## 7. GBM Simulator

**File: `backend/app/market/simulator.py`**

Two classes: `GBMSimulator` (pure math engine) and `SimulatorDataSource` (async wrapper that writes to `PriceCache`).

### 7.1 GBM Math

At each time step, a stock price evolves as:

```
S(t+dt) = S(t) * exp((mu - sigma²/2) * dt + sigma * sqrt(dt) * Z)
```

Where:
- `S(t)` = current price
- `mu` = annualized drift (0.05 = 5% expected annual return)
- `sigma` = annualized volatility (0.22 = 22% annual vol for AAPL)
- `dt` = time step as fraction of a trading year
- `Z` = correlated standard normal random variable

For 500ms ticks over 252 trading days × 6.5 hours/day:
```
dt = 0.5 / (252 × 6.5 × 3600) ≈ 8.48 × 10⁻⁸
```

This tiny `dt` produces sub-cent moves per tick that compound naturally. `exp()` ensures prices can never go negative.

### 7.2 Correlated Moves (Cholesky Decomposition)

Real stocks don't move independently — tech stocks move together. We generate correlated random draws using Cholesky decomposition of the correlation matrix:

1. Build `n×n` correlation matrix `C` with pairwise correlations
2. Compute lower triangular `L = cholesky(C)` (done once; rebuilt only when tickers change)
3. For each step: draw `z_independent ~ N(0,1)^n`, then `z_correlated = L @ z_independent`
4. Use `z_correlated[i]` as the `Z` for ticker `i`

The Cholesky approach guarantees the resulting random vectors have the exact desired pairwise correlations.

### 7.3 GBMSimulator Class

```python
import math
import random
import numpy as np
from .seed_prices import (
    CORRELATION_GROUPS, CROSS_GROUP_CORR, DEFAULT_PARAMS,
    INTRA_FINANCE_CORR, INTRA_TECH_CORR, SEED_PRICES, TICKER_PARAMS, TSLA_CORR,
)


class GBMSimulator:
    """Geometric Brownian Motion simulator for correlated stock prices."""

    TRADING_SECONDS_PER_YEAR = 252 * 6.5 * 3600  # 5,896,800
    DEFAULT_DT = 0.5 / TRADING_SECONDS_PER_YEAR   # ~8.48e-8

    def __init__(
        self,
        tickers: list[str],
        dt: float = DEFAULT_DT,
        event_probability: float = 0.001,
    ) -> None:
        self._dt = dt
        self._event_prob = event_probability
        self._tickers: list[str] = []
        self._prices: dict[str, float] = {}
        self._params: dict[str, dict[str, float]] = {}
        self._cholesky: np.ndarray | None = None

        # Batch-initialize without rebuilding Cholesky each time
        for ticker in tickers:
            self._add_ticker_internal(ticker)
        self._rebuild_cholesky()

    def step(self) -> dict[str, float]:
        """Advance all tickers one time step. Returns {ticker: new_price}.

        Called every 500ms — hot path, kept fast.
        """
        n = len(self._tickers)
        if n == 0:
            return {}

        z_independent = np.random.standard_normal(n)
        z = self._cholesky @ z_independent if self._cholesky is not None else z_independent

        result: dict[str, float] = {}
        for i, ticker in enumerate(self._tickers):
            mu = self._params[ticker]["mu"]
            sigma = self._params[ticker]["sigma"]

            drift = (mu - 0.5 * sigma**2) * self._dt
            diffusion = sigma * math.sqrt(self._dt) * z[i]
            self._prices[ticker] *= math.exp(drift + diffusion)

            # Random shock: ~0.1% chance, 2-5% move up or down
            if random.random() < self._event_prob:
                shock = random.uniform(0.02, 0.05) * random.choice([-1, 1])
                self._prices[ticker] *= (1 + shock)

            result[ticker] = round(self._prices[ticker], 2)

        return result

    def add_ticker(self, ticker: str) -> None:
        """Add a ticker and rebuild the correlation matrix."""
        if ticker in self._prices:
            return
        self._add_ticker_internal(ticker)
        self._rebuild_cholesky()

    def remove_ticker(self, ticker: str) -> None:
        """Remove a ticker and rebuild the correlation matrix."""
        if ticker not in self._prices:
            return
        self._tickers.remove(ticker)
        del self._prices[ticker]
        del self._params[ticker]
        self._rebuild_cholesky()

    def get_price(self, ticker: str) -> float | None:
        return self._prices.get(ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    def _add_ticker_internal(self, ticker: str) -> None:
        """Add without rebuilding Cholesky (for batch init)."""
        if ticker in self._prices:
            return
        self._tickers.append(ticker)
        self._prices[ticker] = SEED_PRICES.get(ticker, random.uniform(50.0, 300.0))
        self._params[ticker] = TICKER_PARAMS.get(ticker, dict(DEFAULT_PARAMS))

    def _rebuild_cholesky(self) -> None:
        """Rebuild Cholesky decomposition of the correlation matrix.

        O(n²) but n is always small (< 50 tickers).
        """
        n = len(self._tickers)
        if n <= 1:
            self._cholesky = None
            return

        corr = np.eye(n)
        for i in range(n):
            for j in range(i + 1, n):
                rho = self._pairwise_correlation(self._tickers[i], self._tickers[j])
                corr[i, j] = rho
                corr[j, i] = rho

        self._cholesky = np.linalg.cholesky(corr)

    @staticmethod
    def _pairwise_correlation(t1: str, t2: str) -> float:
        """Sector-based pairwise correlation."""
        tech = CORRELATION_GROUPS["tech"]
        finance = CORRELATION_GROUPS["finance"]

        if t1 == "TSLA" or t2 == "TSLA":
            return TSLA_CORR
        if t1 in tech and t2 in tech:
            return INTRA_TECH_CORR
        if t1 in finance and t2 in finance:
            return INTRA_FINANCE_CORR
        return CROSS_GROUP_CORR
```

### 7.4 SimulatorDataSource Class

```python
import asyncio
import logging
from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)


class SimulatorDataSource(MarketDataSource):
    """MarketDataSource backed by the GBM simulator.

    Runs a background asyncio task that steps the simulator every
    `update_interval` seconds and writes results to PriceCache.
    """

    def __init__(
        self,
        price_cache: PriceCache,
        update_interval: float = 0.5,
        event_probability: float = 0.001,
    ) -> None:
        self._cache = price_cache
        self._interval = update_interval
        self._event_prob = event_probability
        self._sim: GBMSimulator | None = None
        self._task: asyncio.Task | None = None

    async def start(self, tickers: list[str]) -> None:
        self._sim = GBMSimulator(tickers=tickers, event_probability=self._event_prob)
        # Seed cache immediately — SSE has data on the very first poll
        for ticker in tickers:
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
        self._task = asyncio.create_task(self._run_loop(), name="simulator-loop")
        logger.info("Simulator started with %d tickers", len(tickers))

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        logger.info("Simulator stopped")

    async def add_ticker(self, ticker: str) -> None:
        if self._sim:
            self._sim.add_ticker(ticker)
            price = self._sim.get_price(ticker)
            if price is not None:
                self._cache.update(ticker=ticker, price=price)
            logger.info("Simulator: added %s", ticker)

    async def remove_ticker(self, ticker: str) -> None:
        if self._sim:
            self._sim.remove_ticker(ticker)
        self._cache.remove(ticker)
        logger.info("Simulator: removed %s", ticker)

    def get_tickers(self) -> list[str]:
        return self._sim.get_tickers() if self._sim else []

    async def _run_loop(self) -> None:
        """Core loop: step simulator → write to cache → sleep."""
        while True:
            try:
                if self._sim:
                    prices = self._sim.step()
                    for ticker, price in prices.items():
                        self._cache.update(ticker=ticker, price=price)
            except Exception:
                logger.exception("Simulator step failed")
            await asyncio.sleep(self._interval)
```

**Behavior notes:**
- Initial seed ensures SSE has prices before the first 500ms interval elapses
- `_run_loop` catches all exceptions and continues — essential for a long-lived background service
- `asyncio.CancelledError` propagates normally out of `stop()` — this is correct behavior
- Adding/removing tickers while running is safe: `add_ticker`/`remove_ticker` are called from the main async thread, `_run_loop` runs in the same event loop (no threading issues)

---

## 8. Massive API Client

**File: `backend/app/market/massive_client.py`**

Polls the Polygon.io REST API (branded as "Massive") for real market data. Activated when `MASSIVE_API_KEY` is set.

### 8.1 API Overview

- **Package**: `massive` (`uv add massive`)
- **Base URL**: `https://api.massive.com` (legacy `api.polygon.io` still works)
- **Auth**: `Authorization: Bearer <API_KEY>` (handled by client automatically)
- **Rate limits**: Free tier = 5 req/min → poll every 15s. Paid = effectively unlimited.
- **Key endpoint**: `GET /v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,GOOGL,...` — returns all requested tickers in **one call**.

### 8.2 MassiveDataSource Class

```python
from __future__ import annotations

import asyncio
import logging

from massive import RESTClient
from massive.rest.models import SnapshotMarketType

from .cache import PriceCache
from .interface import MarketDataSource

logger = logging.getLogger(__name__)


class MassiveDataSource(MarketDataSource):
    """MarketDataSource backed by the Massive (Polygon.io) REST API.

    Polls all watched tickers in a single API call.

    Rate limits:
      Free tier (5 req/min):  poll_interval=15.0s (default)
      Paid tiers:             poll_interval=2.0-5.0s
    """

    def __init__(
        self,
        api_key: str,
        price_cache: PriceCache,
        poll_interval: float = 15.0,
    ) -> None:
        self._api_key = api_key
        self._cache = price_cache
        self._interval = poll_interval
        self._tickers: list[str] = []
        self._task: asyncio.Task | None = None
        self._client: RESTClient | None = None

    async def start(self, tickers: list[str]) -> None:
        self._client = RESTClient(api_key=self._api_key)
        self._tickers = list(tickers)
        # Immediate poll so the cache has data before the first interval
        await self._poll_once()
        self._task = asyncio.create_task(self._poll_loop(), name="massive-poller")
        logger.info("Massive poller started: %d tickers, %.1fs interval", len(tickers), self._interval)

    async def stop(self) -> None:
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        self._client = None
        logger.info("Massive poller stopped")

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        if ticker not in self._tickers:
            self._tickers.append(ticker)
            logger.info("Massive: added %s (appears on next poll)", ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper().strip()
        self._tickers = [t for t in self._tickers if t != ticker]
        self._cache.remove(ticker)
        logger.info("Massive: removed %s", ticker)

    def get_tickers(self) -> list[str]:
        return list(self._tickers)

    async def _poll_loop(self) -> None:
        """Sleep then poll, forever. First poll already happened in start()."""
        while True:
            await asyncio.sleep(self._interval)
            await self._poll_once()

    async def _poll_once(self) -> None:
        """One poll cycle: fetch snapshots, update cache."""
        if not self._tickers or not self._client:
            return

        try:
            # RESTClient is synchronous — run in thread to avoid blocking event loop
            snapshots = await asyncio.to_thread(self._fetch_snapshots)
            processed = 0
            for snap in snapshots:
                try:
                    price = snap.last_trade.price
                    # Massive returns timestamps in Unix milliseconds — convert to seconds
                    timestamp = snap.last_trade.timestamp / 1000.0
                    self._cache.update(ticker=snap.ticker, price=price, timestamp=timestamp)
                    processed += 1
                except (AttributeError, TypeError) as e:
                    # Malformed snapshot — skip, don't crash the whole poll
                    logger.warning("Skipping snapshot for %s: %s", getattr(snap, "ticker", "???"), e)

            logger.debug("Massive poll: %d/%d tickers updated", processed, len(self._tickers))

        except Exception as e:
            # 401 bad key, 429 rate limit, network errors — log and retry next interval
            logger.error("Massive poll failed: %s", e)

    def _fetch_snapshots(self) -> list:
        """Synchronous Massive API call. Runs in asyncio.to_thread()."""
        return self._client.get_snapshot_all(
            market_type=SnapshotMarketType.STOCKS,
            tickers=self._tickers,
        )
```

### 8.3 Snapshot Response Structure

Each snapshot object from `get_snapshot_all()` has this structure:

```
snap.ticker                     # "AAPL"
snap.last_trade.price           # 191.50  (the price we use)
snap.last_trade.timestamp       # 1712345678000  (milliseconds!)
snap.last_trade.size            # 100
snap.day.open                   # 190.00
snap.day.high                   # 193.20
snap.day.low                    # 189.50
snap.day.close                  # 191.50  (same as last_trade.price during market hours)
snap.day.volume                 # 45000000
snap.day.previous_close         # 188.75  (yesterday's close)
snap.day.change                 # 2.75
snap.day.change_percent         # 1.46
snap.last_quote.bid_price       # 191.49
snap.last_quote.ask_price       # 191.51
```

**We only use `last_trade.price` and `last_trade.timestamp`** for the price cache. The day stats (`open`, `high`, `low`, `volume`) are available if needed by future API endpoints.

### 8.4 Error Handling

| HTTP Status | Cause | Our behavior |
|---|---|---|
| 401 | Invalid API key | Log error, retry next interval |
| 403 | Plan doesn't include endpoint | Log error, retry next interval |
| 429 | Rate limit exceeded | Log error, retry next interval (longer interval needed) |
| 5xx | Server error | Client retries 3× internally; our code logs and continues |
| Network error | Connectivity | Log error, retry next interval |

All errors are caught in `_poll_once()` and logged at ERROR level. The poller never crashes — it always retries on the next interval. The frontend handles stale prices gracefully (connection indicator goes yellow if SSE stops updating).

### 8.5 Rate Limit Configuration

For paid API plans, you can reduce the poll interval by setting a custom `poll_interval` in the factory:

```python
# In factory.py (for paid tier usage):
if api_key:
    poll_interval = float(os.environ.get("MASSIVE_POLL_INTERVAL", "15.0"))
    return MassiveDataSource(api_key=api_key, price_cache=price_cache, poll_interval=poll_interval)
```

This allows: `MASSIVE_POLL_INTERVAL=5` in `.env` for paid tier users without code changes.

### 8.6 After-Hours Behavior

When markets are closed:
- `last_trade.price` reflects the last traded price (may include after-hours trades)
- `day` stats (`open`, `high`, `low`) are from the most recent trading session
- The simulator is the better choice for demos since it produces continuous updates regardless of market hours

---

## 9. Factory

**File: `backend/app/market/factory.py`**

Selects which implementation to use at startup. Downstream code never needs an `if/else` — it just calls the factory once and holds a `MarketDataSource` reference.

```python
from __future__ import annotations

import logging
import os

from .cache import PriceCache
from .interface import MarketDataSource
from .massive_client import MassiveDataSource
from .simulator import SimulatorDataSource

logger = logging.getLogger(__name__)


def create_market_data_source(price_cache: PriceCache) -> MarketDataSource:
    """Select simulator or Massive based on environment.

    - MASSIVE_API_KEY set and non-empty → MassiveDataSource (real market data)
    - Otherwise                          → SimulatorDataSource (GBM simulation)

    Returns an *unstarted* source. Caller must: await source.start(tickers)
    """
    api_key = os.environ.get("MASSIVE_API_KEY", "").strip()

    if api_key:
        logger.info("Market data source: Massive API (real data)")
        return MassiveDataSource(api_key=api_key, price_cache=price_cache)
    else:
        logger.info("Market data source: GBM Simulator")
        return SimulatorDataSource(price_cache=price_cache)
```

**Usage in `main.py`:**

```python
from app.market import PriceCache, create_market_data_source

cache = PriceCache()
source = create_market_data_source(cache)   # reads env vars
await source.start(initial_tickers)         # begins background task
```

---

## 10. SSE Streaming

**File: `backend/app/market/stream.py`**

FastAPI router that streams price updates to connected browser clients via Server-Sent Events.

### 10.1 Known Bug — Module-Level Router

The current implementation has a latent bug: `router = APIRouter(...)` is at module scope, and `create_stream_router()` registers the `/prices` route onto that single shared router object. Calling `create_stream_router()` twice registers the route twice. This doesn't fail in production (called once), but breaks any test or fixture that calls the factory more than once.

**Fix:** Move `router = APIRouter(...)` inside the factory function so each call returns a fresh router.

### 10.2 Corrected Implementation

```python
from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncGenerator

from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse

from .cache import PriceCache

logger = logging.getLogger(__name__)


def create_stream_router(price_cache: PriceCache) -> APIRouter:
    """Create the SSE streaming router with an injected PriceCache.

    Returns a fresh APIRouter each call — safe to call in tests.
    """
    # FIX: router created inside the factory, not at module scope
    router = APIRouter(prefix="/api/stream", tags=["streaming"])

    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        """SSE endpoint: streams all watchlist ticker prices every ~500ms.

        Client connects with native EventSource API:
            const es = new EventSource('/api/stream/prices');
            es.onmessage = (e) => {
                const prices = JSON.parse(e.data);
                // prices = {"AAPL": {ticker, price, previous_price, change, ...}, ...}
            };

        Includes retry directive for automatic browser reconnection.
        """
        return StreamingResponse(
            _generate_events(price_cache, request),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",   # Prevent nginx from buffering the stream
            },
        )

    return router


async def _generate_events(
    price_cache: PriceCache,
    request: Request,
    interval: float = 0.5,
) -> AsyncGenerator[str, None]:
    """Async generator that yields SSE-formatted price events.

    Uses version-based change detection: only sends an event when at least
    one price has changed since the last event.
    """
    # Tell browser to reconnect after 1 second if connection drops
    yield "retry: 1000\n\n"

    last_version = -1
    client_ip = request.client.host if request.client else "unknown"
    logger.info("SSE client connected: %s", client_ip)

    try:
        while True:
            if await request.is_disconnected():
                logger.info("SSE client disconnected: %s", client_ip)
                break

            current_version = price_cache.version
            if current_version != last_version:
                last_version = current_version
                prices = price_cache.get_all()

                if prices:
                    data = {ticker: update.to_dict() for ticker, update in prices.items()}
                    yield f"data: {json.dumps(data)}\n\n"

            await asyncio.sleep(interval)

    except asyncio.CancelledError:
        logger.info("SSE stream cancelled for: %s", client_ip)
```

### 10.3 SSE Event Format

Each event is a single `data:` line followed by two newlines:

```
retry: 1000

data: {"AAPL": {"ticker": "AAPL", "price": 191.50, "previous_price": 190.00, "timestamp": 1712345678.0, "change": 1.5, "change_percent": 0.7895, "direction": "up"}, "GOOGL": {...}, ...}

data: {"AAPL": {"ticker": "AAPL", "price": 191.48, ...}, ...}
```

### 10.4 Frontend Integration

```typescript
// EventSource reconnects automatically on drop (built-in browser behavior)
const es = new EventSource('/api/stream/prices');

es.onmessage = (event) => {
  const prices: Record<string, PriceUpdate> = JSON.parse(event.data);

  for (const [ticker, update] of Object.entries(prices)) {
    // Flash green (up) or red (down)
    if (update.direction === 'up') flashGreen(ticker);
    else if (update.direction === 'down') flashRed(ticker);

    // Update sparkline data
    appendSparklinePoint(ticker, update.price, update.timestamp);
  }
};

es.onerror = () => {
  // Show yellow dot in connection indicator
  setConnectionStatus('reconnecting');
};

es.onopen = () => {
  setConnectionStatus('connected');
};
```

### 10.5 Connection Status Indicator

The frontend should maintain a connection state machine:

| State | Trigger | Indicator color |
|---|---|---|
| `connected` | `es.onopen` fires | Green dot |
| `reconnecting` | `es.onerror` fires | Yellow dot |
| `disconnected` | Error after 5+ seconds with no reconnect | Red dot |

---

## 11. FastAPI Lifecycle Integration

**File: `backend/app/main.py`** (to be built)

The market data subsystem must be started during FastAPI's lifespan and stopped on shutdown. Here is the complete wiring pattern:

```python
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.market import PriceCache, create_market_data_source, create_stream_router

logger = logging.getLogger(__name__)

# Module-level singletons — shared across the request lifetime
price_cache: PriceCache | None = None
market_source = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """FastAPI lifespan: start market data on startup, stop on shutdown."""
    global price_cache, market_source

    # 1. Initialize the price cache
    price_cache = PriceCache()

    # 2. Load initial watchlist from DB (or use defaults if DB empty)
    initial_tickers = await get_watchlist_tickers_from_db()
    # Falls back to DEFAULT_TICKERS if DB has no rows yet:
    # DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA",
    #                    "NVDA", "META", "JPM", "V", "NFLX"]

    # 3. Create and start market data source
    market_source = create_market_data_source(price_cache)
    await market_source.start(initial_tickers)
    logger.info("Market data source started with %d tickers", len(initial_tickers))

    yield  # Application runs here

    # 4. Shutdown
    if market_source:
        await market_source.stop()
    logger.info("Market data source stopped")


def create_app() -> FastAPI:
    app = FastAPI(lifespan=lifespan, title="FinAlly API")

    # Register SSE streaming router (inject price_cache via closure)
    # Note: price_cache is None at module load — create_stream_router is called
    # after lifespan sets it, OR use a lazy accessor pattern:
    app.include_router(create_stream_router(get_price_cache))
    # ... other routers ...

    # Serve Next.js static export
    app.mount("/", StaticFiles(directory="static", html=True), name="frontend")

    return app


def get_price_cache() -> PriceCache:
    """Dependency injection accessor for the shared price cache."""
    if price_cache is None:
        raise RuntimeError("Price cache not initialized")
    return price_cache


def get_market_source():
    """Dependency injection accessor for the market data source."""
    if market_source is None:
        raise RuntimeError("Market source not initialized")
    return market_source
```

### Dependency Injection Pattern

For routers that need the price cache or market source, use FastAPI's `Depends`:

```python
from fastapi import APIRouter, Depends
from app.main import get_price_cache, get_market_source
from app.market import PriceCache, MarketDataSource

router = APIRouter()

@router.get("/api/watchlist")
async def get_watchlist(
    cache: PriceCache = Depends(get_price_cache),
):
    # Read current prices for watchlist tickers
    watchlist = await db_get_watchlist()
    return [
        {**ticker_info, "price": cache.get_price(ticker_info["ticker"])}
        for ticker_info in watchlist
    ]

@router.post("/api/watchlist")
async def add_to_watchlist(
    body: AddTickerRequest,
    source: MarketDataSource = Depends(get_market_source),
    cache: PriceCache = Depends(get_price_cache),
):
    ticker = body.ticker.upper().strip()
    # Add to DB
    await db_add_ticker(ticker)
    # Wire to market source (critical!)
    await source.add_ticker(ticker)
    return {"ticker": ticker, "price": cache.get_price(ticker)}
```

---

## 12. Watchlist Coordination

**Critical**: When the user adds or removes a ticker via the watchlist API, the watchlist router **must** also update the market data source. Failing to do so means the price cache won't have data for the new ticker.

### Add Ticker Flow

```
POST /api/watchlist {"ticker": "PYPL"}
        │
        ├─ 1. Validate: ticker is a valid symbol (uppercase, 1-5 chars)
        ├─ 2. DB INSERT into watchlist table (idempotent — IGNORE if duplicate)
        ├─ 3. await source.add_ticker("PYPL")  ← wires to market source
        │         │
        │         ├─ Simulator: adds to GBMSimulator, seeds cache with initial price
        │         └─ Massive: adds to poll list (appears on next poll in ≤15s)
        └─ 4. Return: {"ticker": "PYPL", "price": cache.get_price("PYPL")}
```

### Remove Ticker Flow

```
DELETE /api/watchlist/PYPL
        │
        ├─ 1. DB DELETE from watchlist table
        ├─ 2. await source.remove_ticker("PYPL")  ← removes from source AND cache
        └─ 3. Return: 204 No Content
```

### Implementation

```python
@router.delete("/api/watchlist/{ticker}", status_code=204)
async def remove_from_watchlist(
    ticker: str,
    source: MarketDataSource = Depends(get_market_source),
):
    ticker = ticker.upper().strip()
    await db_remove_ticker(ticker)
    await source.remove_ticker(ticker)  # Also removes from PriceCache
    # No body on 204
```

### Ticker Validation Rules

A ticker is valid for trading/watchlist if:
1. It exists in `PriceCache` (has a current price), OR
2. It can be added to the market source and a price obtained within one poll cycle

For the **trade endpoint**, reject trades for tickers with no price in cache:

```python
@router.post("/api/portfolio/trade")
async def execute_trade(body: TradeRequest, cache: PriceCache = Depends(get_price_cache)):
    price = cache.get_price(body.ticker)
    if price is None:
        raise HTTPException(400, f"No price available for {body.ticker}. "
                                  "Add it to your watchlist first.")
    # ... proceed with trade ...
```

---

## 13. Price History Extension

**New endpoint**: `GET /api/prices/{ticker}/history`

Required by PLAN.md section 6. Returns the last 200 price points for a ticker, used by:
- Sparklines: bootstrap on page load instead of waiting for SSE
- Main chart: initial data before SSE updates stream in

### Implementation

```python
# In backend/app/routers/prices.py (new file)
from fastapi import APIRouter, HTTPException, Depends
from app.main import get_price_cache
from app.market import PriceCache

router = APIRouter(prefix="/api/prices", tags=["prices"])


@router.get("/{ticker}/history")
async def get_price_history(
    ticker: str,
    cache: PriceCache = Depends(get_price_cache),
):
    """Return recent price history for a ticker (up to 200 points).

    Used by the frontend to bootstrap sparklines and the main chart
    without waiting for the SSE stream to accumulate data.
    """
    ticker = ticker.upper().strip()
    history = cache.get_history(ticker)   # requires PriceCache history extension

    if not history:
        raise HTTPException(404, f"No price history for {ticker}. "
                                  "It may not be in the watchlist yet.")

    return {
        "ticker": ticker,
        "history": [u.to_dict() for u in history],
        "count": len(history),
    }
```

**Example response:**

```json
{
  "ticker": "AAPL",
  "count": 47,
  "history": [
    {"ticker": "AAPL", "price": 190.00, "previous_price": 190.00, "timestamp": 1712345600.0, "change": 0.0, "change_percent": 0.0, "direction": "flat"},
    {"ticker": "AAPL", "price": 190.12, "previous_price": 190.00, "timestamp": 1712345600.5, "change": 0.12, "change_percent": 0.0632, "direction": "up"},
    {"ticker": "AAPL", "price": 190.08, "previous_price": 190.12, "timestamp": 1712345601.0, "change": -0.04, "change_percent": -0.021, "direction": "down"}
  ]
}
```

**Frontend usage:**

```typescript
// On page load / ticker selection: bootstrap chart from history
async function loadHistory(ticker: string) {
  const res = await fetch(`/api/prices/${ticker}/history`);
  const { history } = await res.json();

  // Seed sparkline with historical data
  setSparklineData(ticker, history.map(u => ({ time: u.timestamp, value: u.price })));
}

// Then continue accumulating from SSE stream
es.onmessage = (event) => {
  const updates = JSON.parse(event.data);
  if (updates[selectedTicker]) {
    appendToChart(selectedTicker, updates[selectedTicker]);
  }
};
```

---

## 14. Error Handling & Edge Cases

### Simulator Edge Cases

| Scenario | Behavior |
|---|---|
| Ticker not in SEED_PRICES | Starts at `random.uniform(50, 300)` with DEFAULT_PARAMS |
| Only 1 ticker | Cholesky is skipped (`_cholesky = None`), uses independent normal |
| Watchlist empty | `step()` returns `{}`, no cache updates, SSE sends no prices |
| Step exception | Logged at ERROR; loop continues (never crashes) |
| Adding ticker mid-session | Cholesky rebuilt immediately; new ticker gets seeded in cache |

### Massive API Edge Cases

| Scenario | Behavior |
|---|---|
| API key invalid (401) | Poll fails, logged at ERROR, retried next interval |
| Rate limit hit (429) | Poll fails, logged at ERROR, retried next interval |
| Snapshot missing a ticker | That ticker is not updated; cache retains last known price |
| Malformed snapshot | Skipped with WARNING log; other tickers still processed |
| Network outage | Poll fails, logged at ERROR, retried; cache retains stale prices |
| Market closed | `last_trade.price` is last traded price; still valid for display |

### SSE Edge Cases

| Scenario | Behavior |
|---|---|
| Client disconnects abruptly | `request.is_disconnected()` → True; generator exits cleanly |
| No prices in cache yet | SSE waits silently; sends data once first price arrives |
| Price cache unchanged between polls | Version unchanged; SSE skips the event (no redundant payload) |
| Server restart | Browser EventSource auto-reconnects (retry: 1000 directive) |

### PriceCache Thread Safety

The cache uses a single `threading.Lock`. This is correct because the Massive client calls `self._cache.update()` from within `asyncio.to_thread()` (a real OS thread), while the SSE endpoint reads from the main event loop thread. The lock prevents torn reads.

For CPython with the GIL, even the unlocked `version` property read is safe, but the lock is used for consistency and correctness on alternative Python implementations.

---

## 15. Testing Strategy

### Test Structure

```
backend/tests/market/
  test_models.py           # PriceUpdate properties and to_dict()
  test_cache.py            # PriceCache thread safety, update/get/remove, version
  test_simulator.py        # GBMSimulator: step(), correlation, shock events
  test_simulator_source.py # SimulatorDataSource: start/stop/add/remove lifecycle
  test_massive.py          # MassiveDataSource: mock Massive client
  test_factory.py          # create_market_data_source() env var selection
  test_stream.py           # SSE endpoint (ASGI integration test — missing, needed)
```

### Key Test Examples

#### PriceCache history

```python
from collections import deque
from app.market.cache import PriceCache

def test_price_history_max_200():
    cache = PriceCache()
    for i in range(250):
        cache.update("AAPL", 100.0 + i)
    history = cache.get_history("AAPL")
    assert len(history) == 200
    assert history[0].price == 150.0   # oldest of last 200
    assert history[-1].price == 349.0  # most recent

def test_price_history_empty_for_unknown_ticker():
    cache = PriceCache()
    assert cache.get_history("UNKNOWN") == []

def test_remove_clears_history():
    cache = PriceCache()
    cache.update("AAPL", 190.0)
    cache.remove("AAPL")
    assert cache.get_history("AAPL") == []
```

#### GBMSimulator correlation

```python
import numpy as np
from app.market.simulator import GBMSimulator

def test_cholesky_built_for_full_default_watchlist():
    """Verify Cholesky decomp succeeds for all 10 default tickers."""
    tickers = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]
    sim = GBMSimulator(tickers=tickers)
    assert sim._cholesky is not None
    assert sim._cholesky.shape == (10, 10)

def test_prices_never_go_negative():
    sim = GBMSimulator(tickers=["AAPL", "TSLA"])
    for _ in range(10000):
        prices = sim.step()
        assert all(p > 0 for p in prices.values())
```

#### SimulatorDataSource lifecycle

```python
import asyncio
import pytest
from app.market.cache import PriceCache
from app.market.simulator import SimulatorDataSource

@pytest.mark.asyncio
async def test_start_seeds_cache():
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache)
    await source.start(["AAPL", "GOOGL"])

    assert cache.get_price("AAPL") is not None
    assert cache.get_price("GOOGL") is not None

    await source.stop()

@pytest.mark.asyncio
async def test_add_ticker_appears_in_cache():
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache)
    await source.start(["AAPL"])
    await source.add_ticker("TSLA")

    assert "TSLA" in cache
    await source.stop()

@pytest.mark.asyncio
async def test_remove_ticker_clears_cache():
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache)
    await source.start(["AAPL", "TSLA"])
    await source.remove_ticker("TSLA")

    assert "TSLA" not in cache
    assert "AAPL" in cache
    await source.stop()
```

#### SSE integration test (currently missing — add this)

```python
import pytest
from httpx import AsyncClient, ASGITransport
from app.market.cache import PriceCache
from app.market.stream import create_stream_router
from fastapi import FastAPI

@pytest.mark.asyncio
async def test_sse_sends_prices_when_cache_has_data():
    cache = PriceCache()
    cache.update("AAPL", 190.0)

    app = FastAPI()
    app.include_router(create_stream_router(cache))

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        async with client.stream("GET", "/api/stream/prices") as response:
            assert response.status_code == 200
            assert "text/event-stream" in response.headers["content-type"]

            # Read the first two chunks (retry directive + first data event)
            lines = []
            async for line in response.aiter_lines():
                lines.append(line)
                if len(lines) >= 4:   # retry\n\n + data: ...\n\n
                    break

            # First non-empty chunk should be the retry directive
            assert any("retry: 1000" in line for line in lines)
            # At least one data event with AAPL
            data_lines = [l for l in lines if l.startswith("data:")]
            assert len(data_lines) >= 1
            import json
            prices = json.loads(data_lines[0][len("data: "):])
            assert "AAPL" in prices
            assert prices["AAPL"]["price"] == 190.0
```

### Running Tests

```bash
cd backend

# All market data tests
uv run --extra dev pytest tests/market/ -v

# With coverage
uv run --extra dev pytest tests/market/ --cov=app/market --cov-report=term-missing

# Lint
uv run --extra dev ruff check app/market/ tests/market/

# Single module
uv run --extra dev pytest tests/market/test_cache.py -v
```

---

## 16. Configuration Summary

| Environment Variable | Default | Effect |
|---|---|---|
| `MASSIVE_API_KEY` | (not set) | If set and non-empty: use Massive REST API. Otherwise: GBM simulator. |
| `MASSIVE_POLL_INTERVAL` | `15.0` | Seconds between Massive API polls (optional, for paid tiers). |
| `LLM_MOCK` | `false` | Not market-related; controls LLM mock mode for tests. |

### Default Tickers (from `seed_prices.py`)

```
AAPL  GOOGL  MSFT  AMZN  TSLA  NVDA  META  JPM  V  NFLX
```

These 10 tickers are used when the database is empty (first run). They are seeded into the `watchlist` table by the database initialization logic, then loaded and passed to `source.start()`.

### Simulator Timing

| Parameter | Value | Notes |
|---|---|---|
| Update interval | 500ms | One GBM step every half-second |
| `dt` | 8.48 × 10⁻⁸ | 0.5s / (252 trading days × 6.5h × 3600s) |
| Shock probability | 0.1% per tick | ~1 event per 500s per ticker; ~1 every 50s across 10 tickers |
| Shock magnitude | 2–5% | Dramatic enough to be visible, not enough to be unrealistic |
| History depth | 200 points | ~100 seconds of price history at 500ms intervals |

### Massive API Timing

| Plan | Rate limit | Recommended poll interval |
|---|---|---|
| Free | 5 req/min | 15s |
| Starter+ | Unlimited | 5s |
| Developer+ | Unlimited | 2s |

### Quick Integration Checklist

For the developer building the next layer (portfolio, watchlist, chat):

- [ ] Import from `app.market` — never from submodules directly
- [ ] Call `create_market_data_source(cache)` once in the FastAPI lifespan
- [ ] Pass `market_source` to the watchlist router via dependency injection
- [ ] Call `source.add_ticker()` / `source.remove_ticker()` in watchlist endpoints
- [ ] Read prices with `cache.get_price(ticker)` — returns `float | None`
- [ ] Reject trades with `None` price (`HTTPException(400, ...)`)
- [ ] Extend `PriceCache` with `get_history()` before building `/api/prices/{ticker}/history`
- [ ] Fix `create_stream_router` to create `router` inside the factory, not at module scope
