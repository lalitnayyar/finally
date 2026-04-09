import os
import tempfile

import pytest

from app.db import get_db, init_db
from app.db.portfolio import execute_trade, get_portfolio, get_portfolio_history
from app.db.watchlist import add_ticker, get_watchlist, remove_ticker


@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "test.db")
        init_db(path)
        yield path


@pytest.mark.asyncio
async def test_init_creates_tables(db_path):
    async with get_db(db_path) as conn:
        cursor = await conn.execute(
            "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
        )
        tables = [row["name"] for row in await cursor.fetchall()]
    assert "users_profile" in tables
    assert "watchlist" in tables
    assert "positions" in tables
    assert "trades" in tables
    assert "portfolio_snapshots" in tables


@pytest.mark.asyncio
async def test_seed_data(db_path):
    async with get_db(db_path) as conn:
        cursor = await conn.execute("SELECT cash_balance FROM users_profile WHERE id = 'default'")
        row = await cursor.fetchone()
        assert row["cash_balance"] == 10000.0

        tickers = await get_watchlist(conn)
        assert len(tickers) == 10
        assert "AAPL" in tickers
        assert "NFLX" in tickers

        history = await get_portfolio_history(conn)
        assert len(history) == 1
        assert history[0]["total_value"] == 10000.0


@pytest.mark.asyncio
async def test_init_idempotent(db_path):
    init_db(db_path)
    async with get_db(db_path) as conn:
        tickers = await get_watchlist(conn)
        assert len(tickers) == 10


@pytest.mark.asyncio
async def test_buy_trade(db_path):
    async with get_db(db_path) as conn:
        new_cash = await execute_trade(conn, "AAPL", "buy", 10, 150.0)
        assert new_cash == pytest.approx(10000.0 - 10 * 150.0)

        portfolio = await get_portfolio(conn)
        assert portfolio["cash_balance"] == pytest.approx(new_cash)
        aapl = [p for p in portfolio["positions"] if p["ticker"] == "AAPL"][0]
        assert aapl["quantity"] == 10
        assert aapl["avg_cost"] == 150.0


@pytest.mark.asyncio
async def test_buy_avg_cost(db_path):
    async with get_db(db_path) as conn:
        await execute_trade(conn, "AAPL", "buy", 10, 100.0)
        await execute_trade(conn, "AAPL", "buy", 10, 200.0)

        portfolio = await get_portfolio(conn)
        aapl = [p for p in portfolio["positions"] if p["ticker"] == "AAPL"][0]
        assert aapl["quantity"] == 20
        assert aapl["avg_cost"] == pytest.approx(150.0)


@pytest.mark.asyncio
async def test_sell_trade(db_path):
    async with get_db(db_path) as conn:
        await execute_trade(conn, "AAPL", "buy", 10, 150.0)
        new_cash = await execute_trade(conn, "AAPL", "sell", 5, 160.0)

        expected = 10000.0 - 10 * 150.0 + 5 * 160.0
        assert new_cash == pytest.approx(expected)

        portfolio = await get_portfolio(conn)
        aapl = [p for p in portfolio["positions"] if p["ticker"] == "AAPL"][0]
        assert aapl["quantity"] == 5


@pytest.mark.asyncio
async def test_sell_all(db_path):
    async with get_db(db_path) as conn:
        await execute_trade(conn, "AAPL", "buy", 10, 150.0)
        await execute_trade(conn, "AAPL", "sell", 10, 160.0)

        portfolio = await get_portfolio(conn)
        aapl_positions = [p for p in portfolio["positions"] if p["ticker"] == "AAPL"]
        assert len(aapl_positions) == 0


@pytest.mark.asyncio
async def test_insufficient_cash(db_path):
    async with get_db(db_path) as conn:
        with pytest.raises(ValueError, match="Insufficient cash"):
            await execute_trade(conn, "AAPL", "buy", 1000, 100.0)


@pytest.mark.asyncio
async def test_sell_more_than_owned(db_path):
    async with get_db(db_path) as conn:
        await execute_trade(conn, "AAPL", "buy", 5, 100.0)
        with pytest.raises(ValueError, match="Insufficient shares"):
            await execute_trade(conn, "AAPL", "sell", 10, 100.0)


@pytest.mark.asyncio
async def test_sell_without_position(db_path):
    async with get_db(db_path) as conn:
        with pytest.raises(ValueError, match="Insufficient shares"):
            await execute_trade(conn, "AAPL", "sell", 1, 100.0)


@pytest.mark.asyncio
async def test_watchlist_add(db_path):
    async with get_db(db_path) as conn:
        added = await add_ticker(conn, "PYPL")
        assert added is True

        tickers = await get_watchlist(conn)
        assert "PYPL" in tickers


@pytest.mark.asyncio
async def test_watchlist_add_duplicate(db_path):
    async with get_db(db_path) as conn:
        added = await add_ticker(conn, "AAPL")
        assert added is False


@pytest.mark.asyncio
async def test_watchlist_remove(db_path):
    async with get_db(db_path) as conn:
        removed = await remove_ticker(conn, "AAPL")
        assert removed is True

        tickers = await get_watchlist(conn)
        assert "AAPL" not in tickers


@pytest.mark.asyncio
async def test_watchlist_remove_nonexistent(db_path):
    async with get_db(db_path) as conn:
        removed = await remove_ticker(conn, "ZZZZ")
        assert removed is False


@pytest.mark.asyncio
async def test_portfolio_history_grows(db_path):
    async with get_db(db_path) as conn:
        await execute_trade(conn, "AAPL", "buy", 10, 150.0)
        await execute_trade(conn, "AAPL", "sell", 5, 160.0)

        history = await get_portfolio_history(conn)
        assert len(history) == 3  # 1 seed + 2 trades
