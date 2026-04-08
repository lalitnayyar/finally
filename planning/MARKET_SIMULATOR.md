# Market Simulator

This document describes the design and code structure of `SimulatedMarketData` — the default market data provider when no `MASSIVE_API_KEY` is configured.

---

## Goals

- Generate realistic-looking price movements without any external dependency
- Update at ~500ms intervals to drive SSE streaming and price flash animations
- Provide enough visual drama (correlated moves, occasional events) to make the UI compelling
- Start from seed prices close to real-world values so the UI looks credible
- Implement the full `MarketDataProvider` interface with no behavioral differences observable to callers

---

## Price Model: Geometric Brownian Motion (GBM)

Each tick, the price is updated using a discrete GBM step:

```
P(t+1) = P(t) * exp((μ - σ²/2) * dt + σ * √dt * Z)
```

Where:
- `μ` — drift (annualised, e.g. 0.05 for 5% annual growth)
- `σ` — volatility (annualised, e.g. 0.30 for 30%)
- `dt` — time step in years (0.5s / seconds_per_year ≈ 1.585e-8)
- `Z` — standard normal random variable

In practice, `dt` is so small that the per-step change is dominated entirely by the noise term `σ * √dt * Z`. The drift term has negligible effect over the simulation window — it is kept for correctness.

---

## Correlated Moves

Tickers in the same sector move together. This is implemented via a two-factor model:

1. **Market factor** — a single `Z_market` drawn each tick, shared across all tickers, weighted by `beta`
2. **Idiosyncratic factor** — an independent `Z_idio` drawn per ticker

```
Z_ticker = beta * Z_market + sqrt(1 - beta²) * Z_idio
```

Typical `beta` values:
- Tech stocks (AAPL, GOOGL, MSFT, etc.): 0.7
- Finance (JPM, V): 0.5
- Consumer (AMZN, NFLX): 0.6
- High-volatility (TSLA, NVDA): 0.5 (still correlated but noisier)

---

## Occasional Events

Every tick, each ticker has a small probability of an "event" — a sudden 2–5% jump (positive or negative). This makes the UI more interesting and tests the price flash animations.

```python
EVENT_PROBABILITY = 0.002   # ~0.2% per tick ≈ once per ~4 minutes per ticker
EVENT_MAGNITUDE = (0.02, 0.05)  # uniform range for jump size
```

---

## Seed Prices

Approximate real-world prices as of early 2025 for the default 10 tickers:

```python
SEED_PRICES = {
    "AAPL":  190.0,
    "GOOGL": 175.0,
    "MSFT":  420.0,
    "AMZN":  185.0,
    "TSLA":  175.0,
    "NVDA":  875.0,
    "META":  500.0,
    "JPM":   200.0,
    "V":     275.0,
    "NFLX":  625.0,
}
DEFAULT_SEED_PRICE = 100.0   # for any ticker not in the table
```

---

## Full Implementation

```python
# backend/market/simulator.py

import asyncio
import math
import random
import time
import logging
from .base import MarketDataProvider
from .types import PricePoint, TickerHistory

logger = logging.getLogger(__name__)

# --- Configuration ---

TICK_INTERVAL = 0.5          # seconds between price updates
SECONDS_PER_YEAR = 365.25 * 24 * 3600
DT = TICK_INTERVAL / SECONDS_PER_YEAR

ANNUAL_DRIFT = 0.05          # 5% annual drift (negligible over simulation window)
EVENT_PROBABILITY = 0.002    # per ticker per tick
EVENT_MAGNITUDE_MIN = 0.02
EVENT_MAGNITUDE_MAX = 0.05

SEED_PRICES: dict[str, float] = {
    "AAPL":  190.0,
    "GOOGL": 175.0,
    "MSFT":  420.0,
    "AMZN":  185.0,
    "TSLA":  175.0,
    "NVDA":  875.0,
    "META":  500.0,
    "JPM":   200.0,
    "V":     275.0,
    "NFLX":  625.0,
}
DEFAULT_SEED_PRICE = 100.0

# Per-ticker volatility (annualised). Higher = noisier.
VOLATILITY: dict[str, float] = {
    "AAPL":  0.28,
    "GOOGL": 0.30,
    "MSFT":  0.26,
    "AMZN":  0.35,
    "TSLA":  0.75,
    "NVDA":  0.65,
    "META":  0.40,
    "JPM":   0.25,
    "V":     0.22,
    "NFLX":  0.45,
}
DEFAULT_VOLATILITY = 0.35

# Per-ticker beta (market correlation). 0 = independent, 1 = pure market.
BETA: dict[str, float] = {
    "AAPL":  0.70,
    "GOOGL": 0.70,
    "MSFT":  0.70,
    "AMZN":  0.60,
    "TSLA":  0.50,
    "NVDA":  0.60,
    "META":  0.65,
    "JPM":   0.50,
    "V":     0.50,
    "NFLX":  0.55,
}
DEFAULT_BETA = 0.55


class SimulatedMarketData(MarketDataProvider):
    """
    In-process market data simulator using Geometric Brownian Motion.

    Runs a background asyncio task that ticks every TICK_INTERVAL seconds,
    updates prices for all tracked tickers, and stores them in the price cache.
    Implements the full MarketDataProvider interface.
    """

    def __init__(self, tick_interval: float = TICK_INTERVAL):
        self._tick_interval = tick_interval
        self._tickers: set[str] = set()
        self._prices: dict[str, float] = {}        # current simulated price
        self._prev_close: dict[str, float] = {}    # opening price for today's session
        self._cache: dict[str, PricePoint] = {}
        self._history: dict[str, TickerHistory] = {}
        self._task: asyncio.Task | None = None

    @property
    def tickers(self) -> set[str]:
        return set(self._tickers)

    async def start(self, tickers: list[str]) -> None:
        for t in tickers:
            self._add_ticker_state(t.upper())
        self._task = asyncio.create_task(self._tick_loop())
        logger.info("SimulatedMarketData started for %d tickers", len(self._tickers))

    async def stop(self) -> None:
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        logger.info("SimulatedMarketData stopped")

    async def add_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        if ticker not in self._tickers:
            self._add_ticker_state(ticker)

    async def remove_ticker(self, ticker: str) -> None:
        ticker = ticker.upper()
        self._tickers.discard(ticker)
        self._prices.pop(ticker, None)
        self._prev_close.pop(ticker, None)
        self._cache.pop(ticker, None)
        self._history.pop(ticker, None)

    def get_price(self, ticker: str) -> PricePoint | None:
        return self._cache.get(ticker.upper())

    def get_all_prices(self) -> dict[str, PricePoint]:
        return dict(self._cache)

    def get_history(self, ticker: str) -> TickerHistory | None:
        return self._history.get(ticker.upper())

    # --- Internal ---

    def _add_ticker_state(self, ticker: str) -> None:
        """Initialise state for a new ticker."""
        seed = SEED_PRICES.get(ticker, DEFAULT_SEED_PRICE)
        # Small random offset so tickers don't all start at exactly the same price
        seed = seed * random.uniform(0.97, 1.03)
        self._tickers.add(ticker)
        self._prices[ticker] = seed
        self._prev_close[ticker] = seed
        self._history[ticker] = TickerHistory(ticker=ticker)
        # Populate initial cache entry so callers don't get None on first read
        now = time.time()
        self._cache[ticker] = PricePoint(
            ticker=ticker,
            price=seed,
            prev_price=seed,
            timestamp=now,
            change=0.0,
            change_pct=0.0,
        )
        self._history[ticker].append(seed, now)

    async def _tick_loop(self) -> None:
        while True:
            try:
                self._tick()
            except Exception:
                logger.exception("Error in simulator tick")
            await asyncio.sleep(self._tick_interval)

    def _tick(self) -> None:
        """Advance all prices by one GBM step with correlated market factor."""
        if not self._tickers:
            return

        now = time.time()

        # Draw one shared market shock
        z_market = random.gauss(0, 1)

        for ticker in list(self._tickers):
            sigma = VOLATILITY.get(ticker, DEFAULT_VOLATILITY)
            beta = BETA.get(ticker, DEFAULT_BETA)

            # Correlated + idiosyncratic noise
            z_idio = random.gauss(0, 1)
            z = beta * z_market + math.sqrt(1 - beta ** 2) * z_idio

            # GBM step
            drift_term = (ANNUAL_DRIFT - 0.5 * sigma ** 2) * DT
            diffusion_term = sigma * math.sqrt(DT) * z
            factor = math.exp(drift_term + diffusion_term)

            old_price = self._prices[ticker]
            new_price = old_price * factor

            # Occasional event: sudden 2–5% jump
            if random.random() < EVENT_PROBABILITY:
                magnitude = random.uniform(EVENT_MAGNITUDE_MIN, EVENT_MAGNITUDE_MAX)
                direction = random.choice([-1, 1])
                new_price *= (1 + direction * magnitude)

            new_price = max(new_price, 0.01)   # floor at 1 cent
            self._prices[ticker] = new_price

            prev_close = self._prev_close[ticker]
            change = new_price - prev_close
            change_pct = (change / prev_close * 100) if prev_close else 0.0

            self._cache[ticker] = PricePoint(
                ticker=ticker,
                price=round(new_price, 2),
                prev_price=round(old_price, 2),
                timestamp=now,
                change=round(change, 2),
                change_pct=round(change_pct, 4),
            )
            self._history[ticker].append(round(new_price, 2), now)
```

---

## File Layout

```
backend/market/
├── __init__.py        # create_market_data_provider() factory
├── base.py            # MarketDataProvider ABC
├── types.py           # PricePoint, TickerHistory dataclasses
├── simulator.py       # SimulatedMarketData
└── massive.py         # MassiveMarketData
```

---

## Behaviour Notes

### Tick rate vs. SSE cadence

The simulator ticks every 500ms. The SSE endpoint also pushes every 500ms. In practice these two loops are unsynchronised — the SSE loop may occasionally send a price that hasn't changed since the last push. This is harmless; the frontend only triggers a flash animation when `price !== prev_price`.

### Simulator drift over time

GBM prices will drift (up or down) over long sessions. This is intentional — it makes the portfolio heatmap more interesting. Prices are not reset between sessions; a Docker volume restart gives fresh seed prices (new `SimulatedMarketData` instance).

### Adding a new ticker at runtime

When the user (or AI) adds a ticker not in `SEED_PRICES`, it starts at `DEFAULT_SEED_PRICE` ($100) with a ±3% random jitter. The history starts empty and fills in over time from the SSE stream. The frontend sparkline will appear empty for ~2 seconds then begin drawing.

### Determinism for testing

Pass a fixed seed to `random.seed()` before calling `start()` to make the simulation deterministic in tests. Alternatively, inject a mock `SimulatedMarketData` that returns scripted prices.

---

## Testing the Simulator

```python
import asyncio
from backend.market.simulator import SimulatedMarketData

async def test_simulator():
    sim = SimulatedMarketData(tick_interval=0.1)
    await sim.start(["AAPL", "TSLA"])
    await asyncio.sleep(1.0)

    point = sim.get_price("AAPL")
    assert point is not None
    assert point.price > 0

    history = sim.get_history("AAPL")
    assert len(history.prices) >= 5   # ~10 ticks in 1s at 0.1s interval

    await sim.stop()

asyncio.run(test_simulator())
```
