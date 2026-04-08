"""Tests for SSE streaming endpoint."""

from __future__ import annotations

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.market.cache import PriceCache
from app.market.stream import _generate_events, create_stream_router


class TestCreateStreamRouter:
    """Tests for the create_stream_router factory."""

    def test_returns_api_router(self):
        """Test that create_stream_router returns a FastAPI APIRouter."""
        from fastapi import APIRouter

        cache = PriceCache()
        router = create_stream_router(cache)
        assert isinstance(router, APIRouter)

    def test_router_has_prices_route(self):
        """Test that the router has a /prices GET route."""
        cache = PriceCache()
        router = create_stream_router(cache)

        paths = [route.path for route in router.routes]
        assert "/prices" in paths

    def test_router_prefix(self):
        """Test that the router has the correct prefix."""
        from fastapi import APIRouter

        cache = PriceCache()
        router = create_stream_router(cache)
        assert isinstance(router, APIRouter)
        # The router prefix is set at module level
        assert router.prefix == "/api/stream"


@pytest.mark.asyncio
class TestGenerateEvents:
    """Tests for the _generate_events async generator."""

    def _make_request(self, disconnected_after: int = 2) -> MagicMock:
        """Create a mock request that disconnects after N calls."""
        request = MagicMock()
        request.client = MagicMock()
        request.client.host = "127.0.0.1"

        call_count = 0

        async def is_disconnected():
            nonlocal call_count
            call_count += 1
            return call_count > disconnected_after

        request.is_disconnected = is_disconnected
        return request

    async def test_yields_retry_directive_first(self):
        """Test that the first yielded value is the retry directive."""
        cache = PriceCache()
        request = self._make_request(disconnected_after=1)

        events = []
        async for event in _generate_events(cache, request, interval=0.01):
            events.append(event)
            break  # Only take the first event

        assert events[0] == "retry: 1000\n\n"

    async def test_yields_price_data_when_cache_has_entries(self):
        """Test that price data is yielded when cache contains tickers."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        request = self._make_request(disconnected_after=2)

        events = []
        async for event in _generate_events(cache, request, interval=0.01):
            events.append(event)

        # First event is retry, second should be price data
        data_events = [e for e in events if e.startswith("data:")]
        assert len(data_events) >= 1

        # Parse the first data event
        payload = data_events[0].removeprefix("data: ").strip()
        data = json.loads(payload)
        assert "AAPL" in data
        assert data["AAPL"]["price"] == 190.50

    async def test_data_event_format(self):
        """Test that data events are correctly formatted SSE."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        request = self._make_request(disconnected_after=2)

        events = []
        async for event in _generate_events(cache, request, interval=0.01):
            events.append(event)

        data_events = [e for e in events if e.startswith("data:")]
        assert len(data_events) >= 1
        # SSE format: must end with double newline
        assert data_events[0].endswith("\n\n")

    async def test_skips_event_when_cache_empty(self):
        """Test that no data events are sent when cache is empty."""
        cache = PriceCache()  # Empty cache
        request = self._make_request(disconnected_after=2)

        events = []
        async for event in _generate_events(cache, request, interval=0.01):
            events.append(event)

        # Should only have the retry directive
        data_events = [e for e in events if e.startswith("data:")]
        assert len(data_events) == 0

    async def test_stops_on_client_disconnect(self):
        """Test that the generator stops when the client disconnects."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)

        # Disconnect immediately after the first iteration
        request = self._make_request(disconnected_after=0)

        events = []
        async for event in _generate_events(cache, request, interval=0.01):
            events.append(event)

        # Should only have the retry directive before detecting disconnect
        assert len(events) == 1
        assert events[0] == "retry: 1000\n\n"

    async def test_no_duplicate_events_without_version_change(self):
        """Test that events are only sent when the cache version changes."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)

        call_count = 0

        async def is_disconnected():
            nonlocal call_count
            call_count += 1
            return call_count > 5  # Let it run 5 cycles

        request = MagicMock()
        request.client = MagicMock()
        request.client.host = "127.0.0.1"
        request.is_disconnected = is_disconnected

        events = []
        async for event in _generate_events(cache, request, interval=0.001):
            events.append(event)

        # Even though 5 cycles ran, only 1 data event should be sent
        # because the cache version doesn't change between cycles
        data_events = [e for e in events if e.startswith("data:")]
        assert len(data_events) == 1

    async def test_sends_new_event_on_version_change(self):
        """Test that a new event is sent when the cache version increments."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)

        update_after_cycles = 2
        call_count = 0

        async def is_disconnected():
            nonlocal call_count
            call_count += 1
            if call_count == update_after_cycles:
                # Trigger a cache update to bump the version
                cache.update("AAPL", 191.00)
            return call_count > update_after_cycles + 2

        request = MagicMock()
        request.client = MagicMock()
        request.client.host = "127.0.0.1"
        request.is_disconnected = is_disconnected

        events = []
        async for event in _generate_events(cache, request, interval=0.001):
            events.append(event)

        data_events = [e for e in events if e.startswith("data:")]
        # Should have 2 data events: initial + after version bump
        assert len(data_events) >= 2

    async def test_multiple_tickers_in_payload(self):
        """Test that all tickers in the cache appear in the payload."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        cache.update("GOOGL", 175.25)
        cache.update("MSFT", 420.00)

        request = self._make_request(disconnected_after=2)

        events = []
        async for event in _generate_events(cache, request, interval=0.01):
            events.append(event)

        data_events = [e for e in events if e.startswith("data:")]
        assert len(data_events) >= 1

        payload = data_events[0].removeprefix("data: ").strip()
        data = json.loads(payload)
        assert "AAPL" in data
        assert "GOOGL" in data
        assert "MSFT" in data

    async def test_payload_contains_all_price_fields(self):
        """Test that each ticker's payload contains all required fields."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.update("AAPL", 191.00)  # Second update to have non-flat direction

        request = self._make_request(disconnected_after=2)

        events = []
        async for event in _generate_events(cache, request, interval=0.01):
            events.append(event)

        data_events = [e for e in events if e.startswith("data:")]
        payload = data_events[0].removeprefix("data: ").strip()
        data = json.loads(payload)

        aapl = data["AAPL"]
        assert "ticker" in aapl
        assert "price" in aapl
        assert "previous_price" in aapl
        assert "timestamp" in aapl
        assert "change" in aapl
        assert "change_percent" in aapl
        assert "direction" in aapl

    async def test_handles_none_client(self):
        """Test that generator works when request.client is None."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)

        request = MagicMock()
        request.client = None  # No client info

        call_count = 0

        async def is_disconnected():
            nonlocal call_count
            call_count += 1
            return call_count > 2

        request.is_disconnected = is_disconnected

        events = []
        async for event in _generate_events(cache, request, interval=0.01):
            events.append(event)

        # Should still yield events normally
        assert len(events) >= 1
        assert events[0] == "retry: 1000\n\n"
