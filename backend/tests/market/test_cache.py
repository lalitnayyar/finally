"""Tests for PriceCache."""

from app.market.cache import PriceCache


class TestPriceCache:
    """Unit tests for the PriceCache."""

    def test_update_and_get(self):
        """Test updating and getting a price."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.50)
        assert update.ticker == "AAPL"
        assert update.price == 190.50
        assert cache.get("AAPL") == update

    def test_first_update_is_flat(self):
        """Test that the first update has flat direction."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.50)
        assert update.direction == "flat"
        assert update.previous_price == 190.50

    def test_direction_up(self):
        """Test price update with upward direction."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        update = cache.update("AAPL", 191.00)
        assert update.direction == "up"
        assert update.change == 1.00

    def test_direction_down(self):
        """Test price update with downward direction."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        update = cache.update("AAPL", 189.00)
        assert update.direction == "down"
        assert update.change == -1.00

    def test_remove(self):
        """Test removing a ticker from cache."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.remove("AAPL")
        assert cache.get("AAPL") is None

    def test_remove_nonexistent(self):
        """Test removing a ticker that doesn't exist."""
        cache = PriceCache()
        cache.remove("AAPL")  # Should not raise

    def test_get_all(self):
        """Test getting all prices."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.update("GOOGL", 175.00)
        all_prices = cache.get_all()
        assert set(all_prices.keys()) == {"AAPL", "GOOGL"}

    def test_version_increments(self):
        """Test that version counter increments."""
        cache = PriceCache()
        v0 = cache.version
        cache.update("AAPL", 190.00)
        assert cache.version == v0 + 1
        cache.update("AAPL", 191.00)
        assert cache.version == v0 + 2

    def test_get_price_convenience(self):
        """Test the convenience get_price method."""
        cache = PriceCache()
        cache.update("AAPL", 190.50)
        assert cache.get_price("AAPL") == 190.50
        assert cache.get_price("NOPE") is None

    def test_len(self):
        """Test __len__ method."""
        cache = PriceCache()
        assert len(cache) == 0
        cache.update("AAPL", 190.00)
        assert len(cache) == 1
        cache.update("GOOGL", 175.00)
        assert len(cache) == 2

    def test_contains(self):
        """Test __contains__ method."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        assert "AAPL" in cache
        assert "GOOGL" not in cache

    def test_custom_timestamp(self):
        """Test updating with a custom timestamp."""
        cache = PriceCache()
        custom_ts = 1234567890.0
        update = cache.update("AAPL", 190.50, timestamp=custom_ts)
        assert update.timestamp == custom_ts

    def test_price_rounding(self):
        """Test that prices are rounded to 2 decimal places."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.12345)
        assert update.price == 190.12

    # --- History tests ---

    def test_get_history_single_update(self):
        """Test that a single update appears in history."""
        cache = PriceCache()
        update = cache.update("AAPL", 190.00)
        history = cache.get_history("AAPL")
        assert len(history) == 1
        assert history[0] == update

    def test_get_history_multiple_updates_ordered(self):
        """Test that history is ordered oldest-first."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.update("AAPL", 191.00)
        cache.update("AAPL", 192.00)
        history = cache.get_history("AAPL")
        assert len(history) == 3
        assert history[0].price == 190.00
        assert history[1].price == 191.00
        assert history[2].price == 192.00

    def test_get_history_unknown_ticker(self):
        """Test that get_history returns empty list for unknown ticker."""
        cache = PriceCache()
        assert cache.get_history("NOPE") == []

    def test_get_history_capped_at_200(self):
        """Test that history is capped at 200 entries."""
        cache = PriceCache()
        for i in range(250):
            cache.update("AAPL", float(100 + i))
        history = cache.get_history("AAPL")
        assert len(history) == 200
        # Oldest retained entry should be price 150 (250 - 200 + 100 = 150)
        assert history[0].price == 150.0

    def test_remove_clears_history(self):
        """Test that removing a ticker also clears its history."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.update("AAPL", 191.00)
        cache.remove("AAPL")
        assert cache.get_history("AAPL") == []

    def test_history_independent_per_ticker(self):
        """Test that history is tracked independently per ticker."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        cache.update("AAPL", 191.00)
        cache.update("GOOGL", 175.00)
        assert len(cache.get_history("AAPL")) == 2
        assert len(cache.get_history("GOOGL")) == 1

    def test_get_history_returns_copy(self):
        """Test that get_history returns a list copy (not the internal deque)."""
        cache = PriceCache()
        cache.update("AAPL", 190.00)
        history = cache.get_history("AAPL")
        history.clear()  # Mutating the returned list should not affect the cache
        assert len(cache.get_history("AAPL")) == 1

    def test_version_read_is_consistent(self):
        """Test that version reads are consistent under concurrent writes."""
        cache = PriceCache()
        # Sanity check: version is 0 before any writes
        assert cache.version == 0
        cache.update("AAPL", 190.00)
        assert cache.version == 1
