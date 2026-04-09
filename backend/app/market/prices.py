"""REST endpoints for price data (history)."""

from __future__ import annotations

import logging

from fastapi import APIRouter

from .cache import PriceCache

logger = logging.getLogger(__name__)


def create_prices_router(price_cache: PriceCache) -> APIRouter:
    """Create the prices REST router with a reference to the price cache.

    Endpoints:
        GET /api/prices/{ticker}/history  — last 200 price points for a ticker
    """
    router = APIRouter(prefix="/api/prices", tags=["prices"])

    @router.get("/{ticker}/history")
    async def get_price_history(ticker: str) -> list[dict]:
        """Return the rolling price history for a ticker (up to 200 points).

        Bootstraps frontend sparklines and the main chart on page load so
        clients don't have to wait for the SSE stream to accumulate data.

        Returns 404 if the ticker is not in the cache (not on the watchlist
        or not yet seeded).

        Response: JSON array ordered oldest-first, each element matching the
        PriceUpdate.to_dict() shape:
            [{"ticker": "AAPL", "price": 190.50, "previous_price": 190.00,
              "timestamp": 1234567890.0, "change": 0.5,
              "change_percent": 0.2632, "direction": "up"}, ...]
        """
        normalized = ticker.upper().strip()
        history = price_cache.get_history(normalized)

        return [update.to_dict() for update in history]

    return router
