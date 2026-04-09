# Coding Conventions

**Analysis Date:** 2026-04-10

## Naming Patterns

**Files:**
- Use `snake_case.py` for Python modules in `backend/app/`, `backend/tests/`, and `backend/scripts/`; examples: `backend/app/db/watchlist.py`, `backend/app/market/massive_client.py`, `backend/tests/market/test_simulator_source.py`.
- Use `*.spec.ts` for Playwright browser tests in `test/specs/`; examples: `test/specs/watchlist.spec.ts`, `test/specs/portfolio.spec.ts`.
- Use platform-specific script names under `scripts/` with verb-first naming; examples: `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `scripts/reset_portfolio.py`.

**Functions:**
- Python functions use `snake_case`; examples: `backend/app/routes/portfolio.py` defines `get_portfolio_view`, `trade`, and `portfolio_history`.
- Async I/O functions are still named with plain verbs rather than `async_` prefixes; examples: `backend/app/db/portfolio.py` defines `execute_trade`, `record_snapshot`, and `get_portfolio_history`.
- Route factories use `create_*_router` or `create_*_source` naming when they capture runtime dependencies; examples: `backend/app/market/stream.py`, `backend/app/market/prices.py`, `backend/app/market/factory.py`.
- Playwright specs use sentence-style test names inside `test.describe(...)`; examples: `test/specs/chat.spec.ts`, `test/specs/connection.spec.ts`.

**Variables:**
- Local Python variables are descriptive `snake_case`; examples: `cash_balance`, `current_price`, `unrealized_pnl_total` in `backend/app/routes/portfolio.py`.
- Module-level constants are `UPPER_SNAKE_CASE`; examples: `DB_PATH` in `backend/app/main.py`, `DEFAULT_TICKERS` in `backend/app/db/init.py`, `_VALID_TICKER` in `backend/app/routes/watchlist.py`.
- TypeScript test constants also use `UPPER_SNAKE_CASE`; example: `DEFAULT_TICKERS` in `test/specs/watchlist.spec.ts`.

**Types:**
- Pydantic request and response models use `PascalCase` with noun suffixes like `Request`, `Response`, or `Action`; examples: `TradeRequest` in `backend/app/routes/portfolio.py`, `ChatRequest` in `backend/app/llm/router.py`, `LLMResponse` in `backend/app/llm/schema.py`.
- Dataclasses and concrete service classes also use `PascalCase`; examples: `PriceUpdate` in `backend/app/market/models.py`, `PriceCache` in `backend/app/market/cache.py`, `SimulatorDataSource` in `backend/app/market/simulator.py`.
- Test classes are `PascalCase` prefixed with `Test`; examples: `TestPriceCache` in `backend/tests/market/test_cache.py`, `TestGBMSimulator` in `backend/tests/market/test_simulator.py`.

## Code Style

**Formatting:**
- Use Ruff formatting and linting for Python. `backend/pyproject.toml` sets `line-length = 100` and `target-version = "py312"`.
- Keep type hints on public Python functions and return types when practical; examples: `backend/app/db/watchlist.py`, `backend/app/market/cache.py`, `backend/app/market/simulator.py`.
- Prefer standard-library imports first, then third-party imports, then local imports. Ruff import sorting is enabled through `select = ["E", "F", "I", "N", "W"]` in `backend/pyproject.toml`.
- TypeScript test files use semicolons and single quotes consistently, matching Playwright defaults in `test/playwright.config.ts` and `test/specs/*.spec.ts`.

**Linting:**
- Use Ruff as the backend linter. `backend/README.md` documents `uv run ruff check .` and `uv run ruff format .`.
- Enforced rule families in `backend/pyproject.toml`: `E`, `F`, `I`, `N`, `W`.
- `E501` is ignored because line length is delegated to the formatter in `backend/pyproject.toml`.

## Import Organization

**Order:**
1. Python standard library imports such as `os`, `uuid`, `datetime`, `logging`, `asyncio`.
2. Third-party imports such as `fastapi`, `pydantic`, `aiosqlite`, `numpy`, `pytest`.
3. Local `app.*` imports or same-package relative imports.

**Path Aliases:**
- Python modules import from the installed package root `app`, not from relative project paths; examples: `from app.db import get_db` in `backend/app/routes/portfolio.py`, `from app.market.cache import PriceCache` in `backend/tests/market/test_cache.py`.
- Intra-package code uses relative imports within subsystems when the dependency stays inside the package; examples: `from .cache import PriceCache` in `backend/app/market/stream.py`, `from .schema import LLMResponse` in `backend/app/llm/chat.py`.
- Playwright tests use relative file layout only; no TS path aliases are configured in `test/playwright.config.ts` or `test/package.json`.

## Error Handling

**Patterns:**
- Route-layer validation errors are raised as `HTTPException(status_code=400, detail=...)`; examples: invalid trade side or quantity in `backend/app/routes/portfolio.py`, invalid ticker format in `backend/app/routes/watchlist.py`.
- Domain and persistence functions raise `ValueError` for business rule violations, and route handlers translate those to HTTP 400; see `backend/app/db/portfolio.py` and the `except ValueError as e` block in `backend/app/routes/portfolio.py`.
- Long-running background loops swallow transient failures after logging them, rather than crashing the task; examples: `_run_loop()` in `backend/app/market/simulator.py` and `_poll_once()` in `backend/app/market/massive_client.py`.
- The chat route favors graceful degradation over propagated errors. `backend/app/llm/router.py` logs with `logger.exception(...)` and returns a fallback JSON payload if LLM execution fails.

## Logging

**Framework:** `logging`

**Patterns:**
- Each long-lived module creates a module logger with `logging.getLogger(__name__)`; examples: `backend/app/main.py`, `backend/app/market/factory.py`, `backend/app/market/stream.py`, `backend/app/llm/router.py`.
- Log startup, shutdown, and dependency-selection events at `info` level; examples: database init and market source startup in `backend/app/main.py`, simulator vs Massive selection in `backend/app/market/factory.py`.
- Log recoverable background-task failures at `warning`, `error`, or `exception` level rather than raising to the caller; examples: malformed Massive snapshots in `backend/app/market/massive_client.py`, simulator loop failures in `backend/app/market/simulator.py`.
- One-off maintenance scripts print user-facing status to stdout instead of wiring up logging; examples: `backend/scripts/reset_portfolio.py`, `scripts/start_mac.sh`.

## Comments

**When to Comment:**
- Use short docstrings on modules, classes, and non-trivial functions to explain purpose and operational constraints; examples: `backend/app/market/models.py`, `backend/app/market/prices.py`, `backend/app/market/stream.py`.
- Add brief inline comments where runtime ordering or external-system behavior matters; examples: router/static mount ordering in `backend/app/main.py`, thread offload rationale in `backend/app/market/massive_client.py`, classic Docker builder note in `scripts/start_mac.sh`.
- Avoid comments for self-evident CRUD logic. Files like `backend/app/db/watchlist.py` and `backend/app/routes/health.py` rely on clear code instead of narration.

**JSDoc/TSDoc:**
- Not used in the Playwright suite under `test/specs/`.
- Python docstrings are the preferred documentation mechanism.

## Function Design

**Size:** Use small to medium functions with one responsibility.
- Database helpers in `backend/app/db/watchlist.py` are narrowly scoped.
- Route functions in `backend/app/routes/watchlist.py` and `backend/app/routes/health.py` keep orchestration thin.
- More complex orchestration is accepted in endpoint handlers when they assemble response payloads from several sources; examples: `chat()` in `backend/app/llm/router.py`, `get_portfolio_view()` in `backend/app/routes/portfolio.py`.

**Parameters:**
- FastAPI handlers accept `Request` when they need shared app state such as `db_path`, `cache`, or `source`; examples: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/llm/router.py`.
- Request bodies are wrapped in explicit Pydantic models instead of bare dicts; examples: `TradeRequest`, `AddTickerRequest`, `ChatRequest`.
- Subsystem factories accept their runtime dependency explicitly instead of importing singletons; examples: `create_stream_router(price_cache)` in `backend/app/market/stream.py`, `create_prices_router(price_cache)` in `backend/app/market/prices.py`, `create_market_data_source(price_cache)` in `backend/app/market/factory.py`.

**Return Values:**
- API routes return plain dict or list payloads that FastAPI serializes automatically; examples: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/routes/health.py`.
- Service-layer methods return simple primitives or plain dict/list shapes instead of custom repository objects; examples: `execute_trade(...) -> float` in `backend/app/db/portfolio.py`, `get_watchlist(...) -> list[str]` in `backend/app/db/watchlist.py`.
- Cache and model helpers return rich Python objects internally and serialize at the edge; examples: `PriceCache.get_history()` returns `list[PriceUpdate]` in `backend/app/market/cache.py`, and `backend/app/market/prices.py` converts them with `to_dict()`.

## Module Design

**Exports:**
- Modules usually expose concrete functions or classes directly; there is little use of internal helper files beyond subsystem-local modules such as `backend/app/market/` and `backend/app/db/`.
- The package root re-exports selected helpers for convenient imports. `backend/app/market/__init__.py` and `backend/app/db/__init__.py` centralize commonly used symbols.

**Barrel Files:**
- Minimal barrel-file pattern is used in Python package `__init__.py` files, not in TypeScript.
- Use `backend/app/db/__init__.py` to expose `get_db` and `init_db`, and `backend/app/market/__init__.py` to expose cache, models, routers, and data-source factories.

## Schema Usage

**Database Schema:**
- Keep the SQLite schema as a single SQL string constant in `backend/app/db/schema.py` and apply it with `conn.executescript(...)` from `backend/app/db/init.py`.
- Seed data belongs with initialization logic rather than migrations; `backend/app/db/init.py` inserts the default user, default tickers, and an initial portfolio snapshot.

**API and LLM Schemas:**
- Use lightweight Pydantic `BaseModel` classes for request/response validation; examples: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/llm/router.py`, `backend/app/llm/schema.py`.
- LLM structured output is modeled in the same schema module consumed by the parser. `backend/app/llm/chat.py` passes `LLMResponse` to `litellm.completion(...)` and parses with `LLMResponse.model_validate_json(...)`.
- Current models use mutable-looking defaults for list fields in `backend/app/llm/schema.py`. Match the existing style when editing nearby code unless you are intentionally correcting that implementation detail across the module.

## Route Patterns

**HTTP Routes:**
- Group routes by bounded context with `APIRouter(prefix=..., tags=[...])`; examples: `backend/app/routes/watchlist.py`, `backend/app/routes/portfolio.py`, `backend/app/routes/health.py`, `backend/app/llm/router.py`.
- Use `/api/...` prefixes for JSON endpoints and reserve `/api/stream/...` for SSE. See `backend/app/market/stream.py` and `backend/app/market/prices.py`.
- Keep stateful dependencies on `app.state` and inject them at runtime in `backend/app/main.py`; route handlers then read `request.app.state.cache`, `request.app.state.source`, and `request.app.state.db_path`.
- Register cache-dependent routers during lifespan startup after the cache is initialized. `backend/app/main.py` includes `create_stream_router(cache)` and `create_prices_router(cache)` inside the lifespan function.

**Factory Routes:**
- When a route depends on runtime objects, define it in a router factory returning a fresh `APIRouter`; examples: `backend/app/market/stream.py` and `backend/app/market/prices.py`.
- Tests depend on factory isolation. `backend/tests/market/test_prices.py` and `backend/tests/market/test_stream.py` assert that new router instances can be created repeatedly.

## Script Conventions

**Runtime Scripts:**
- Root scripts are thin wrappers around Docker or backend scripts, not alternate business-logic implementations; examples: `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `scripts/reset_portfolio.py`.
- Backend maintenance scripts are executable Python files with `main()` entrypoints and `if __name__ == "__main__":` guards; example: `backend/scripts/reset_portfolio.py`.
- Shell scripts use `set -e` and fail fast; see `scripts/start_mac.sh`.
- Windows PowerShell scripts mirror the macOS/Linux behavior closely, including `--build` handling and `.env` injection; compare `scripts/start_windows.ps1` with `scripts/start_mac.sh`.

**Test Scripts:**
- Playwright commands live in `test/package.json` and are intentionally minimal: `test`, `test:headed`, and `test:debug`.
- Backend developer commands are documented in `backend/README.md` rather than exposed as root `package.json` scripts.

---

*Convention analysis: 2026-04-10*
