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

    await asyncio.sleep(0.6)

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    await source.stop()


@pytest.mark.asyncio
async def test_chat_returns_valid_response(client):
    resp = await client.post("/api/chat", json={"message": "How is my portfolio?"})
    assert resp.status_code == 200
    data = resp.json()
    assert "message" in data
    assert isinstance(data["message"], str)
    assert "trades" in data
    assert "watchlist_changes" in data
    assert "execution_results" in data


@pytest.mark.asyncio
async def test_chat_mock_has_message(client):
    resp = await client.post("/api/chat", json={"message": "Hello"})
    data = resp.json()
    assert len(data["message"]) > 0
    assert data["trades"] == []
    assert data["watchlist_changes"] == []


@pytest.mark.asyncio
async def test_chat_mock_response_structure(client):
    resp = await client.post("/api/chat", json={"message": "Buy 10 shares of AAPL"})
    data = resp.json()
    assert isinstance(data["trades"], list)
    assert isinstance(data["watchlist_changes"], list)
    assert isinstance(data["execution_results"], list)


@pytest.mark.asyncio
async def test_chat_error_handling(client, monkeypatch):
    from app.llm import router as router_module

    def raise_error(messages):
        raise RuntimeError("LLM connection failed")

    monkeypatch.setattr(router_module, "call_llm", raise_error)

    resp = await client.post("/api/chat", json={"message": "test"})
    assert resp.status_code == 200
    data = resp.json()
    assert "trouble connecting" in data["message"]
    assert data["trades"] == []
    assert data["watchlist_changes"] == []


@pytest.mark.asyncio
async def test_chat_times_out_slow_llm_without_hanging(client, monkeypatch):
    from app.llm import router as router_module

    def slow_llm(messages):
        import time

        from app.llm.schema import LLMResponse

        time.sleep(0.2)
        return LLMResponse(message="Too late", trades=[], watchlist_changes=[])

    monkeypatch.setattr(router_module, "CHAT_TIMEOUT_SECONDS", 0.01)
    monkeypatch.setattr(router_module, "call_llm", slow_llm)

    resp = await client.post("/api/chat", json={"message": "test"})
    assert resp.status_code == 200
    data = resp.json()
    assert "trouble connecting" in data["message"]
    assert data["execution_results"] == []


def test_call_llm_requires_openrouter_api_key(monkeypatch):
    from app.llm import chat as chat_module

    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.delenv("LLM_MOCK", raising=False)

    with pytest.raises(RuntimeError, match="OPENROUTER_API_KEY"):
        chat_module.call_llm([{"role": "user", "content": "Hello"}])


def test_validate_chat_environment_allows_mock_mode(monkeypatch):
    from app.llm import chat as chat_module

    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    monkeypatch.setenv("LLM_MOCK", "true")

    chat_module.validate_chat_environment()


@pytest.mark.asyncio
async def test_chat_watchlist_add_subscribes_market_source(client, monkeypatch):
    from app.llm import router as router_module
    from app.llm.schema import LLMResponse, WatchlistAction
    from app.main import app

    def add_pypl(messages):
        return LLMResponse(
            message="Added PYPL.",
            trades=[],
            watchlist_changes=[WatchlistAction(ticker="PYPL", action="add")],
        )

    monkeypatch.setattr(router_module, "call_llm", add_pypl)

    resp = await client.post("/api/chat", json={"message": "Add PYPL to my watchlist"})
    assert resp.status_code == 200
    data = resp.json()

    assert {"ticker": "PYPL", "action": "add"} in data["watchlist_changes"]
    assert "Added PYPL to watchlist" in data["execution_results"]
    assert "PYPL" in app.state.source.get_tickers()
    assert app.state.cache.get_price("PYPL") is not None


@pytest.mark.asyncio
async def test_chat_watchlist_remove_unsubscribes_market_source(client, monkeypatch):
    from app.llm import router as router_module
    from app.llm.schema import LLMResponse, WatchlistAction
    from app.main import app

    add_resp = await client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert add_resp.status_code == 200
    assert "PYPL" in app.state.source.get_tickers()
    assert app.state.cache.get_price("PYPL") is not None

    def remove_pypl(messages):
        return LLMResponse(
            message="Removed PYPL.",
            trades=[],
            watchlist_changes=[WatchlistAction(ticker="PYPL", action="remove")],
        )

    monkeypatch.setattr(router_module, "call_llm", remove_pypl)

    resp = await client.post("/api/chat", json={"message": "Remove PYPL from my watchlist"})
    assert resp.status_code == 200
    data = resp.json()

    assert {"ticker": "PYPL", "action": "remove"} in data["watchlist_changes"]
    assert "Removed PYPL from watchlist" in data["execution_results"]
    assert "PYPL" not in app.state.source.get_tickers()
    assert app.state.cache.get_price("PYPL") is None
