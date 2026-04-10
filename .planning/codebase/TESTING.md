# Testing Patterns

**Analysis Date:** 2026-04-10

## Test Framework

**Runner:**
- Backend: `pytest` with `pytest-asyncio`
- Config: `backend/pyproject.toml`
- Browser E2E: `@playwright/test`
- Config: `test/playwright.config.ts`

**Assertion Library:**
- Backend tests use plain `assert` plus `pytest.raises(...)`; examples: `backend/tests/test_db.py`, `backend/tests/market/test_models.py`.
- API tests use `httpx` and FastAPI `TestClient` response assertions; examples: `backend/tests/test_routes.py`, `backend/tests/market/test_prices.py`.
- Browser tests use Playwright's `expect(...)`; examples: `test/specs/watchlist.spec.ts`, `test/specs/chat.spec.ts`.

**Run Commands:**
```bash
cd backend && uv run pytest
cd backend && uv run pytest -v
cd backend && uv run pytest --cov=app --cov-report=html
cd test && npm test
cd test && npm run test:headed
cd test && npm run test:debug
```

## Test File Organization

**Location:**
- Backend tests live under `backend/tests/`.
- Subsystem-specific backend tests are nested by package, especially under `backend/tests/market/`.
- Browser tests live in the standalone harness under `test/specs/`.

**Naming:**
- Pytest files use `test_*.py`, matching `backend/pyproject.toml`.
- Playwright files use `*.spec.ts`, configured by `test/playwright.config.ts`.

**Structure:**
```text
backend/tests/
backend/tests/market/
test/specs/
```

## Test Structure

**Suite Organization:**
```python
@pytest.mark.asyncio
async def test_watchlist_add(client):
    resp = await client.post("/api/watchlist", json={"ticker": "PYPL"})
    assert resp.status_code == 200
    assert resp.json()["added"] is True
```

```python
class TestPriceCache:
    def test_update_and_get(self):
        cache = PriceCache()
        update = cache.update("AAPL", 190.50)
        assert cache.get("AAPL") == update
```

```ts
test.describe('Watchlist', () => {
  test('add a new ticker to watchlist', async ({ page }) => {
    await page.goto('/');
    await page.getByPlaceholder('Add ticker').fill('PYPL');
    await page.getByRole('button', { name: '+' }).click();
    await expect(page.getByText('PYPL').first()).toBeVisible();
  });
});
```

**Patterns:**
- Prefer plain function tests for API and DB flows, and class-based grouping for pure unit tests with a shared subject area; compare `backend/tests/test_db.py` with `backend/tests/market/test_cache.py`.
- Mark async pytest tests explicitly with `@pytest.mark.asyncio`; examples: `backend/tests/test_routes.py`, `backend/tests/test_chat.py`, `backend/tests/market/test_massive.py`.
- Give tests long, behavior-oriented names that state the scenario and expected outcome; examples: `test_portfolio_trade_insufficient_cash` in `backend/tests/test_routes.py`, `test_no_duplicate_events_without_version_change` in `backend/tests/market/test_stream.py`.
- Browser specs lean on comments to describe the intended UI contract when resilient selectors are missing; examples: `test/specs/connection.spec.ts`, `test/specs/charts.spec.ts`.

## Mocking

**Framework:** `pytest` `monkeypatch`, `unittest.mock`, Playwright request API

**Patterns:**
```python
with patch.dict(os.environ, {"MASSIVE_API_KEY": "test-key"}, clear=True):
    source = create_market_data_source(cache)
```

```python
def raise_error(messages):
    raise RuntimeError("LLM connection failed")

monkeypatch.setattr(router_module, "call_llm", raise_error)
```

```python
with patch.object(source, "_fetch_snapshots", return_value=mock_snapshots):
    await source._poll_once()
```

```ts
await page.request.post('/api/watchlist', { data: { ticker: 'DIS' } });
await page.reload();
```

**What to Mock:**
- Environment-variable switches that select integrations; see `backend/tests/market/test_factory.py`.
- External network clients and snapshot fetches for Massive/Polygon integration; see `backend/tests/market/test_massive.py`.
- LLM calls at the router boundary or via `LLM_MOCK=true`; see `backend/tests/test_chat.py`.
- Browser-side setup through backend HTTP APIs instead of brittle UI-only setup; see `test/specs/watchlist.spec.ts`, `test/specs/portfolio.spec.ts`, `test/specs/charts.spec.ts`.

**What NOT to Mock:**
- Core trading, watchlist, cache, and simulator logic are tested as real in-process units; see `backend/tests/test_db.py`, `backend/tests/market/test_cache.py`, `backend/tests/market/test_simulator.py`.
- FastAPI route wiring is exercised against an ASGI app or `TestClient` rather than stubbing handler functions; see `backend/tests/test_routes.py`, `backend/tests/market/test_prices.py`.

## Fixtures and Factories

**Test Data:**
```python
@pytest.fixture
async def client(tmp_path):
    db_path = str(tmp_path / "test.db")
    os.environ["DB_PATH"] = db_path
    init_db(db_path)
    ...
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
```

```python
@pytest.fixture
def db_path():
    with tempfile.TemporaryDirectory() as tmpdir:
        path = os.path.join(tmpdir, "test.db")
        init_db(path)
        yield path
```

```python
def _make_snapshot(ticker: str, price: float, timestamp_ms: int) -> MagicMock:
    snap = MagicMock()
    snap.ticker = ticker
    snap.last_trade.price = price
    snap.last_trade.timestamp = timestamp_ms
    return snap
```

**Location:**
- Shared backend fixture configuration is minimal and lives in `backend/tests/conftest.py`.
- Most fixtures are kept local to each test module, especially `client` and `db_path` fixtures in `backend/tests/test_routes.py`, `backend/tests/test_chat.py`, and `backend/tests/test_db.py`.
- Mock factories are defined close to the tests that use them; example: `_make_snapshot(...)` in `backend/tests/market/test_massive.py`.

## Coverage

**Requirements:** None enforced by CI in the checked-in files.
- Coverage is configured for the backend in `backend/pyproject.toml` with `source = ["app"]` and `omit = ["tests/*"]`.
- `backend/README.md` documents HTML coverage generation.

**View Coverage:**
```bash
cd backend && uv run pytest --cov=app --cov-report=html
```

## Test Types

**Unit Tests:**
- Pure units dominate the market subsystem tests under `backend/tests/market/`.
- Examples: `backend/tests/market/test_cache.py`, `backend/tests/market/test_models.py`, `backend/tests/market/test_simulator.py`, `backend/tests/market/test_factory.py`.

**Integration Tests:**
- Async backend integration tests boot the FastAPI app, temp database, cache, and data source together.
- Examples: `backend/tests/test_routes.py`, `backend/tests/test_chat.py`, `backend/tests/market/test_simulator_source.py`, `backend/tests/market/test_prices.py`.

**E2E Tests:**
- Browser E2E coverage uses Playwright only.
- Specs live in `test/specs/`.
- The harness points to `process.env.BASE_URL || 'http://localhost:8000'` in `test/playwright.config.ts`.

## Common Patterns

**Async Testing:**
```python
@pytest.mark.asyncio
async def test_prices_update_over_time():
    cache = PriceCache()
    source = SimulatorDataSource(price_cache=cache, update_interval=0.05)
    await source.start(["AAPL"])
    await asyncio.sleep(0.3)
    assert cache.version > 0
    await source.stop()
```

**Error Testing:**
```python
with pytest.raises(ValueError, match="Insufficient cash"):
    await execute_trade(conn, "AAPL", "buy", 1000, 100.0)
```

```python
resp = await client.post("/api/portfolio/trade", json={
    "ticker": "AAPL",
    "side": "buy",
    "quantity": 999999,
})
assert resp.status_code == 400
```

```python
monkeypatch.setattr(router_module, "call_llm", raise_error)
resp = await client.post("/api/chat", json={"message": "test"})
assert "trouble connecting" in resp.json()["message"]
```

## Execution Notes

**Observed collection:**
- `cd test && npm test -- --list` successfully lists 16 Playwright tests across `test/specs/charts.spec.ts`, `test/specs/chat.spec.ts`, `test/specs/connection.spec.ts`, `test/specs/portfolio.spec.ts`, and `test/specs/watchlist.spec.ts`.
- Backend pytest collection is configured, but collecting through `uv` in this session was blocked by network-dependent build resolution for `hatchling` after redirecting the cache to a writable directory. Treat the pytest layout as source-observed rather than session-verified.

**Environment dependencies:**
- Backend tests assume `uv` plus Python 3.12 and installable dev dependencies from `backend/pyproject.toml`.
- Playwright tests assume a running application at `http://localhost:8000` unless `BASE_URL` is overridden in `test/playwright.config.ts`.
- Some tests explicitly force simulator or mock mode via environment variables: `MASSIVE_API_KEY=""` in `backend/tests/test_routes.py`, `LLM_MOCK="true"` in `backend/tests/test_chat.py`.

## Observed Gaps

**Backend gaps:**
- No frontend source tests are present in this checkout; only backend tests and browser-level Playwright specs exist.
- No CI workflow file in `.github/workflows/` was found for running pytest or Playwright automatically.
- Authentication, authorization, migrations, and secrets handling are not represented in the test suite because those features are not present in the app code read here.
- There are no explicit contract tests for Pydantic schema edge cases in `backend/app/llm/schema.py` or request-model validation in `backend/app/routes/portfolio.py` and `backend/app/routes/watchlist.py`.

**E2E gaps:**
- Playwright tests rely on visible text, placeholder text, and fallback selectors rather than a consistently instrumented test-id strategy; examples: `test/specs/chat.spec.ts`, `test/specs/connection.spec.ts`, `test/specs/charts.spec.ts`.
- E2E specs cover happy paths and smoke checks but not failure paths such as SSE disconnect recovery, invalid ticker validation, or chat error rendering in the browser.

---

*Testing analysis: 2026-04-10*
