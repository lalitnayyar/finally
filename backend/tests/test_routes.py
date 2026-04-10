import asyncio
import os

import pytest
from httpx import ASGITransport, AsyncClient

os.environ["MASSIVE_API_KEY"] = ""  # Force simulator
os.environ["LLM_MOCK"] = "true"


@pytest.fixture
async def client(tmp_path):
    db_path = str(tmp_path / "test.db")
    os.environ["DB_PATH"] = db_path

    from app.db import get_db, init_db
    from app.db.watchlist import get_watchlist
    from app.main import app
    from app.market import PriceCache, create_market_data_source

    init_db(db_path)

    cache = PriceCache()
    source = create_market_data_source(cache)

    async with get_db(db_path) as conn:
        tickers = await get_watchlist(conn)

    await source.start(tickers)

    app.state.cache = cache
    app.state.source = source
    app.state.db_path = db_path

    # Give simulator time to seed initial prices
    await asyncio.sleep(0.6)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await source.stop()


@pytest.mark.asyncio
async def test_health(client):
    resp = await client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


@pytest.mark.asyncio
async def test_watchlist_list(client):
    resp = await client.get("/api/watchlist")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) == 10
    tickers = [item["ticker"] for item in data]
    assert "AAPL" in tickers


@pytest.mark.asyncio
async def test_watchlist_add(client):
    resp = await client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert resp.status_code == 200
    assert resp.json()["ticker"] == "PYPL"
    assert resp.json()["added"] is True

    # Adding again should return added=False (idempotent)
    resp2 = await client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert resp2.status_code == 200
    assert resp2.json()["added"] is False


@pytest.mark.asyncio
async def test_watchlist_delete(client):
    resp = await client.delete("/api/watchlist/AAPL")
    assert resp.status_code == 200
    assert resp.json()["removed"] is True

    # Deleting again should return removed=False
    resp2 = await client.delete("/api/watchlist/AAPL")
    assert resp2.status_code == 200
    assert resp2.json()["removed"] is False


@pytest.mark.asyncio
async def test_portfolio_get(client):
    resp = await client.get("/api/portfolio")
    assert resp.status_code == 200
    data = resp.json()
    assert "cash_balance" in data
    assert data["cash_balance"] == 10000.0
    assert "total_value" in data
    assert "positions" in data
    assert "unrealized_pnl_total" in data


@pytest.mark.asyncio
async def test_portfolio_trade_buy(client):
    resp = await client.post("/api/portfolio/trade", json={
        "ticker": "AAPL",
        "side": "buy",
        "quantity": 5,
    })
    assert resp.status_code == 200
    data = resp.json()
    assert data["ticker"] == "AAPL"
    assert data["side"] == "buy"
    assert data["quantity"] == 5
    assert data["cash_balance"] < 10000.0


@pytest.mark.asyncio
async def test_portfolio_trade_sell(client):
    # Buy first
    await client.post("/api/portfolio/trade", json={
        "ticker": "AAPL", "side": "buy", "quantity": 10,
    })
    # Then sell
    resp = await client.post("/api/portfolio/trade", json={
        "ticker": "AAPL", "side": "sell", "quantity": 5,
    })
    assert resp.status_code == 200
    assert resp.json()["side"] == "sell"


@pytest.mark.asyncio
async def test_portfolio_trade_insufficient_cash(client):
    resp = await client.post("/api/portfolio/trade", json={
        "ticker": "AAPL", "side": "buy", "quantity": 999999,
    })
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_portfolio_history(client):
    resp = await client.get("/api/portfolio/history")
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 1  # At least the seed snapshot
