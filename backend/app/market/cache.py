"""Thread-safe in-memory price cache."""

from __future__ import annotations

import time
from collections import deque
from threading import Lock

from .models import PriceUpdate

# Maximum number of historical price points kept per ticker
HISTORY_MAX_LEN = 200


class PriceCache:
    """Thread-safe in-memory cache of the latest price for each ticker.

    Writers: SimulatorDataSource or MassiveDataSource (one at a time).
    Readers: SSE streaming endpoint, portfolio valuation, trade execution.

    In addition to the current price, a rolling history of the last
    HISTORY_MAX_LEN (200) PriceUpdate objects is kept per ticker so that
    REST clients can bootstrap charts and sparklines without waiting for the
    SSE stream to accumulate data.
    """

    def __init__(self) -> None:
        self._prices: dict[str, PriceUpdate] = {}
        self._history: dict[str, deque[PriceUpdate]] = {}
        self._lock = Lock()
        self._version: int = 0  # Monotonically increasing; bumped on every update

    def update(self, ticker: str, price: float, timestamp: float | None = None) -> PriceUpdate:
        """Record a new price for a ticker. Returns the created PriceUpdate.

        Automatically computes direction and change from the previous price.
        If this is the first update for the ticker, previous_price == price (direction='flat').
        The update is appended to the rolling history buffer for the ticker.
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

            if ticker not in self._history:
                self._history[ticker] = deque(maxlen=HISTORY_MAX_LEN)
            self._history[ticker].append(update)

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

    def get_history(self, ticker: str) -> list[PriceUpdate]:
        """Return the rolling price history for a ticker (up to 200 points).

        Returns an empty list if the ticker is unknown or has no history.
        The list is ordered oldest-first.
        """
        with self._lock:
            hist = self._history.get(ticker)
            return list(hist) if hist else []

    def remove(self, ticker: str) -> None:
        """Remove a ticker from the cache and its history (e.g., watchlist removal)."""
        with self._lock:
            self._prices.pop(ticker, None)
            self._history.pop(ticker, None)

    @property
    def version(self) -> int:
        """Current version counter. Useful for SSE change detection."""
        with self._lock:
            return self._version

    def __len__(self) -> int:
        with self._lock:
            return len(self._prices)

    def __contains__(self, ticker: str) -> bool:
        with self._lock:
            return ticker in self._prices
