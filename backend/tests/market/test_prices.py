"""Tests for the /api/prices/{ticker}/history REST endpoint."""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.market.cache import PriceCache
from app.market.prices import create_prices_router


def _make_app(cache: PriceCache) -> FastAPI:
    app = FastAPI()
    app.include_router(create_prices_router(cache))
    return app


class TestCreatePricesRouter:
    """Tests for create_prices_router factory."""

    def test_returns_router_with_correct_prefix(self):
        """Test that the router is created with /api/prices prefix."""
        from fastapi import APIRouter

        cache = PriceCache()
        router = create_prices_router(cache)
        assert isinstance(router, APIRouter)
        assert router.prefix == "/api/prices"

    def test_router_has_history_route(self):
        """Test that the router registers the history route."""
        cache = PriceCache()
        router = create_prices_router(cache)
        paths = [route.path for route in router.routes]
        assert "/api/prices/{ticker}/history" in paths

    def test_each_call_returns_fresh_router(self):
        """Test factory isolation: two calls produce independent routers."""
        cache = PriceCache()
        r1 = create_prices_router(cache)
        r2 = create_prices_router(cache)
        assert r1 is not r2
        assert len(r1.routes) == len(r2.routes) == 1


class TestPriceHistoryEndpoint:
    """Integration tests for GET /api/prices/{ticker}/history."""

    def test_returns_empty_list_for_unknown_ticker(self):
        cache = PriceCache()
        client = TestClient(_make_app(cache))
        response = client.get("/api/prices/ZZZZ/history")
        assert response.status_code == 200
        assert response.json() == []

    def test_returns_history_for_known_ticker(self):
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.update("AAPL", 191.00)
        client = TestClient(_make_app(cache))

        response = client.get("/api/prices/AAPL/history")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2
        assert data[0]["price"] == 190.00
        assert data[1]["price"] == 191.00

    def test_response_shape_contains_all_fields(self):
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.update("AAPL", 191.00)
        client = TestClient(_make_app(cache))

        response = client.get("/api/prices/AAPL/history")
        point = response.json()[1]  # second update has non-flat direction
        assert "ticker" in point
        assert "price" in point
        assert "previous_price" in point
        assert "timestamp" in point
        assert "change" in point
        assert "change_percent" in point
        assert "direction" in point

    def test_ticker_normalised_to_uppercase(self):
        """Lowercase ticker in URL should still match cache entry."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        client = TestClient(_make_app(cache))

        response = client.get("/api/prices/aapl/history")
        assert response.status_code == 200

    def test_returns_at_most_200_points(self):
        """History is capped at 200 entries by the cache."""
        cache = PriceCache()
        for i in range(250):
            cache.update("MSFT", float(400 + i))
        client = TestClient(_make_app(cache))

        response = client.get("/api/prices/MSFT/history")
        assert response.status_code == 200
        assert len(response.json()) == 200

    def test_history_ordered_oldest_first(self):
        """History list must be ordered oldest-first."""
        cache = PriceCache()
        prices = [100.0, 105.0, 110.0, 95.0]
        for p in prices:
            cache.update("TSLA", p)
        client = TestClient(_make_app(cache))

        data = client.get("/api/prices/TSLA/history").json()
        assert [d["price"] for d in data] == prices

    def test_returns_empty_list_for_removed_ticker(self):
        """After removal the history is gone — returns empty list, not 404."""
        cache = PriceCache()
        cache.update("NVDA", 800.00)
        cache.remove("NVDA")
        client = TestClient(_make_app(cache))

        response = client.get("/api/prices/NVDA/history")
        assert response.status_code == 200
        assert response.json() == []
