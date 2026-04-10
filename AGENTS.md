<!-- GSD:project-start source:PROJECT.md -->
## Project

**FinAlly**

FinAlly is a single-user AI trading workstation for students in the course: a Bloomberg-inspired web app that streams market data, lets the user manage a simulated portfolio, and provides an AI chat assistant that can analyze positions and execute trade or watchlist actions. This brownfield repo already contains a working FastAPI backend, persisted portfolio/watchlist data, live market streaming, and a shipped static frontend artifact, but it still needs to be completed and tightened so the full product in `planning/PLAN.md` is actually delivered from source with reliable core-flow coverage.

**Core Value:** Students should be able to start one app locally and immediately experience a convincing end-to-end AI trading workstation where live market data, trading, portfolio visibility, and AI-assisted actions all work together.

### Constraints

- **Audience**: Course students — setup and usage must stay approachable and local-first
- **Architecture**: Single-container, single-port app — preserve the simple startup/deployment model in `planning/PLAN.md`
- **Scope**: Brownfield completion, not greenfield reinvention — build from the existing backend/runtime and close the gaps intentionally
- **Data Model**: Single-user simulated portfolio — avoid introducing multi-user or real brokerage complexity into v1
- **Runtime**: Live market data must work with simulator by default and Massive API when configured — optional external integration, sensible local defaults
- **Verification**: Core flows require reliable automated E2E coverage — "works on my machine" is not enough for completion
<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->
## Technology Stack

## Languages
- Python 3.12+ - Backend API, market data, database access, and LLM orchestration in `backend/app/` with dependency metadata in `backend/pyproject.toml`.
- TypeScript - End-to-end tests in `test/specs/chat.spec.ts` and inferred frontend application source referenced by `Dockerfile` and `README.md`.
- Shell / PowerShell - Local container lifecycle scripts in `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `scripts/start_windows.ps1`, and `scripts/stop_windows.ps1`.
- HTML/CSS/JavaScript - Generated static frontend export served from `backend/static/index.html` and related `_next` assets under `backend/static/`.
- YAML - CI and test orchestration in `.github/workflows/*.yml` and `test/docker-compose.test.yml`.
## Runtime
- Python 3.12 slim runtime image in `Dockerfile`.
- Node.js 20 slim build image in `Dockerfile` for frontend build and Playwright tooling in `test/package.json`.
- Docker container exposes port `8000` and sets `DB_PATH=/app/db/finally.db` in `Dockerfile`.
- `uv` - Python dependency management and execution, defined by `backend/pyproject.toml` and locked in `backend/uv.lock`.
- `npm` - Frontend build stage and Playwright test workspace, evidenced by `Dockerfile`, `test/package.json`, and `test/package-lock.json`.
- Lockfile: present via `backend/uv.lock` and `test/package-lock.json`.
## Frameworks
- FastAPI `>=0.115.0` - Main HTTP API in `backend/app/main.py` and route modules under `backend/app/routes/`.
- Uvicorn `>=0.32.0` with `standard` extras - ASGI server launched by `Dockerfile` and documented in `README.md`.
- Next.js - Inferred frontend framework from `README.md`, `Dockerfile` frontend build stage, and generated `_next` artifacts in `backend/static/index.html`.
- Pytest `>=8.3.0` - Backend test runner configured in `backend/pyproject.toml` and used under `backend/tests/`.
- `pytest-asyncio` `>=0.24.0` - Async backend tests configured in `backend/pyproject.toml`.
- `pytest-cov` `>=5.0.0` - Coverage support configured in `backend/pyproject.toml`.
- Playwright `^1.40.0` - Browser E2E tests in `test/package.json` and `test/specs/chat.spec.ts`.
- Hatchling - Python build backend in `backend/pyproject.toml`.
- Ruff `>=0.7.0` - Formatting and linting in `backend/pyproject.toml` and `backend/README.md`.
- Docker multi-stage build - Frontend build plus Python runtime packaging in `Dockerfile`.
## Key Dependencies
- `fastapi>=0.115.0` - API framework and router composition in `backend/app/main.py`.
- `uvicorn[standard]>=0.32.0` - Production server entrypoint in `Dockerfile`.
- `aiosqlite>=0.22.1` - Async database access in `backend/app/db/init.py`.
- `litellm>=1.83.4` - LLM abstraction used in `backend/app/llm/chat.py`.
- `massive>=1.0.0` - Real market data client used by `backend/app/market/massive_client.py`.
- `numpy>=2.0.0` - Market simulation math in `backend/app/market/simulator.py`.
- `python-dotenv>=1.0.1` - Loads repo-root `.env` for backend chat integration in `backend/app/llm/chat.py`.
- `rich>=13.0.0` - Installed in `backend/pyproject.toml`; not detected in runtime imports.
- `@playwright/test` `^1.40.0` - Browser automation in `test/specs/chat.spec.ts`.
## Configuration
- Runtime env vars are documented in `.env.example`, `README.md`, and `backend/README.md`.
- Detected variables: `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK`, and `DB_PATH`.
- `.env` and `.env.example` are present at repo root; `.env` exists but was not read.
- `Dockerfile` defines the canonical production build and runtime packaging path.
- `backend/pyproject.toml` carries Python dependency, pytest, coverage, and Ruff configuration.
- `test/docker-compose.test.yml` defines the E2E app container and Playwright runner.
- No frontend source manifest such as `frontend/package.json` is present in this checkout, despite being referenced by `Dockerfile`.
## Platform Requirements
- Docker is required for the default local startup flow in `scripts/start_mac.sh` and `scripts/start_windows.ps1`.
- Python toolchain with `uv` is required for direct backend development from `README.md` and `backend/README.md`.
- Node.js and `npm` are required for Playwright tests in `test/package.json`, and would also be required for the missing `frontend/` build source referenced by `Dockerfile`.
- Single-container deployment on port `8000`, serving FastAPI APIs plus static frontend files from `backend/static/`, as defined in `Dockerfile` and `backend/app/main.py`.
## Generated Assets And Runtime Setup
- `backend/static/` is a generated frontend export containing `index.html`, `_next` chunk references, and static assets that FastAPI mounts at `/` in `backend/app/main.py`.
- `backend/db/finally.db` and `db/finally.db` are SQLite database files; the container persists `/app/db` via Docker volume mounts in `scripts/start_mac.sh`, `scripts/start_windows.ps1`, and `test/docker-compose.test.yml`.
- `.github/workflows/claude.yml` and `.github/workflows/claude-code-review.yml` integrate Anthropic GitHub Actions for issue/PR automation and review.
- Frontend technology details beyond generated output are partially inferred because the `frontend/` source tree referenced by `Dockerfile` is not present in this repository snapshot.
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

## Naming Patterns
- Use `snake_case.py` for Python modules in `backend/app/`, `backend/tests/`, and `backend/scripts/`; examples: `backend/app/db/watchlist.py`, `backend/app/market/massive_client.py`, `backend/tests/market/test_simulator_source.py`.
- Use `*.spec.ts` for Playwright browser tests in `test/specs/`; examples: `test/specs/watchlist.spec.ts`, `test/specs/portfolio.spec.ts`.
- Use platform-specific script names under `scripts/` with verb-first naming; examples: `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `scripts/reset_portfolio.py`.
- Python functions use `snake_case`; examples: `backend/app/routes/portfolio.py` defines `get_portfolio_view`, `trade`, and `portfolio_history`.
- Async I/O functions are still named with plain verbs rather than `async_` prefixes; examples: `backend/app/db/portfolio.py` defines `execute_trade`, `record_snapshot`, and `get_portfolio_history`.
- Route factories use `create_*_router` or `create_*_source` naming when they capture runtime dependencies; examples: `backend/app/market/stream.py`, `backend/app/market/prices.py`, `backend/app/market/factory.py`.
- Playwright specs use sentence-style test names inside `test.describe(...)`; examples: `test/specs/chat.spec.ts`, `test/specs/connection.spec.ts`.
- Local Python variables are descriptive `snake_case`; examples: `cash_balance`, `current_price`, `unrealized_pnl_total` in `backend/app/routes/portfolio.py`.
- Module-level constants are `UPPER_SNAKE_CASE`; examples: `DB_PATH` in `backend/app/main.py`, `DEFAULT_TICKERS` in `backend/app/db/init.py`, `_VALID_TICKER` in `backend/app/routes/watchlist.py`.
- TypeScript test constants also use `UPPER_SNAKE_CASE`; example: `DEFAULT_TICKERS` in `test/specs/watchlist.spec.ts`.
- Pydantic request and response models use `PascalCase` with noun suffixes like `Request`, `Response`, or `Action`; examples: `TradeRequest` in `backend/app/routes/portfolio.py`, `ChatRequest` in `backend/app/llm/router.py`, `LLMResponse` in `backend/app/llm/schema.py`.
- Dataclasses and concrete service classes also use `PascalCase`; examples: `PriceUpdate` in `backend/app/market/models.py`, `PriceCache` in `backend/app/market/cache.py`, `SimulatorDataSource` in `backend/app/market/simulator.py`.
- Test classes are `PascalCase` prefixed with `Test`; examples: `TestPriceCache` in `backend/tests/market/test_cache.py`, `TestGBMSimulator` in `backend/tests/market/test_simulator.py`.
## Code Style
- Use Ruff formatting and linting for Python. `backend/pyproject.toml` sets `line-length = 100` and `target-version = "py312"`.
- Keep type hints on public Python functions and return types when practical; examples: `backend/app/db/watchlist.py`, `backend/app/market/cache.py`, `backend/app/market/simulator.py`.
- Prefer standard-library imports first, then third-party imports, then local imports. Ruff import sorting is enabled through `select = ["E", "F", "I", "N", "W"]` in `backend/pyproject.toml`.
- TypeScript test files use semicolons and single quotes consistently, matching Playwright defaults in `test/playwright.config.ts` and `test/specs/*.spec.ts`.
- Use Ruff as the backend linter. `backend/README.md` documents `uv run ruff check .` and `uv run ruff format .`.
- Enforced rule families in `backend/pyproject.toml`: `E`, `F`, `I`, `N`, `W`.
- `E501` is ignored because line length is delegated to the formatter in `backend/pyproject.toml`.
## Import Organization
- Python modules import from the installed package root `app`, not from relative project paths; examples: `from app.db import get_db` in `backend/app/routes/portfolio.py`, `from app.market.cache import PriceCache` in `backend/tests/market/test_cache.py`.
- Intra-package code uses relative imports within subsystems when the dependency stays inside the package; examples: `from .cache import PriceCache` in `backend/app/market/stream.py`, `from .schema import LLMResponse` in `backend/app/llm/chat.py`.
- Playwright tests use relative file layout only; no TS path aliases are configured in `test/playwright.config.ts` or `test/package.json`.
## Error Handling
- Route-layer validation errors are raised as `HTTPException(status_code=400, detail=...)`; examples: invalid trade side or quantity in `backend/app/routes/portfolio.py`, invalid ticker format in `backend/app/routes/watchlist.py`.
- Domain and persistence functions raise `ValueError` for business rule violations, and route handlers translate those to HTTP 400; see `backend/app/db/portfolio.py` and the `except ValueError as e` block in `backend/app/routes/portfolio.py`.
- Long-running background loops swallow transient failures after logging them, rather than crashing the task; examples: `_run_loop()` in `backend/app/market/simulator.py` and `_poll_once()` in `backend/app/market/massive_client.py`.
- The chat route favors graceful degradation over propagated errors. `backend/app/llm/router.py` logs with `logger.exception(...)` and returns a fallback JSON payload if LLM execution fails.
## Logging
- Each long-lived module creates a module logger with `logging.getLogger(__name__)`; examples: `backend/app/main.py`, `backend/app/market/factory.py`, `backend/app/market/stream.py`, `backend/app/llm/router.py`.
- Log startup, shutdown, and dependency-selection events at `info` level; examples: database init and market source startup in `backend/app/main.py`, simulator vs Massive selection in `backend/app/market/factory.py`.
- Log recoverable background-task failures at `warning`, `error`, or `exception` level rather than raising to the caller; examples: malformed Massive snapshots in `backend/app/market/massive_client.py`, simulator loop failures in `backend/app/market/simulator.py`.
- One-off maintenance scripts print user-facing status to stdout instead of wiring up logging; examples: `backend/scripts/reset_portfolio.py`, `scripts/start_mac.sh`.
## Comments
- Use short docstrings on modules, classes, and non-trivial functions to explain purpose and operational constraints; examples: `backend/app/market/models.py`, `backend/app/market/prices.py`, `backend/app/market/stream.py`.
- Add brief inline comments where runtime ordering or external-system behavior matters; examples: router/static mount ordering in `backend/app/main.py`, thread offload rationale in `backend/app/market/massive_client.py`, classic Docker builder note in `scripts/start_mac.sh`.
- Avoid comments for self-evident CRUD logic. Files like `backend/app/db/watchlist.py` and `backend/app/routes/health.py` rely on clear code instead of narration.
- Not used in the Playwright suite under `test/specs/`.
- Python docstrings are the preferred documentation mechanism.
## Function Design
- Database helpers in `backend/app/db/watchlist.py` are narrowly scoped.
- Route functions in `backend/app/routes/watchlist.py` and `backend/app/routes/health.py` keep orchestration thin.
- More complex orchestration is accepted in endpoint handlers when they assemble response payloads from several sources; examples: `chat()` in `backend/app/llm/router.py`, `get_portfolio_view()` in `backend/app/routes/portfolio.py`.
- FastAPI handlers accept `Request` when they need shared app state such as `db_path`, `cache`, or `source`; examples: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/llm/router.py`.
- Request bodies are wrapped in explicit Pydantic models instead of bare dicts; examples: `TradeRequest`, `AddTickerRequest`, `ChatRequest`.
- Subsystem factories accept their runtime dependency explicitly instead of importing singletons; examples: `create_stream_router(price_cache)` in `backend/app/market/stream.py`, `create_prices_router(price_cache)` in `backend/app/market/prices.py`, `create_market_data_source(price_cache)` in `backend/app/market/factory.py`.
- API routes return plain dict or list payloads that FastAPI serializes automatically; examples: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/routes/health.py`.
- Service-layer methods return simple primitives or plain dict/list shapes instead of custom repository objects; examples: `execute_trade(...) -> float` in `backend/app/db/portfolio.py`, `get_watchlist(...) -> list[str]` in `backend/app/db/watchlist.py`.
- Cache and model helpers return rich Python objects internally and serialize at the edge; examples: `PriceCache.get_history()` returns `list[PriceUpdate]` in `backend/app/market/cache.py`, and `backend/app/market/prices.py` converts them with `to_dict()`.
## Module Design
- Modules usually expose concrete functions or classes directly; there is little use of internal helper files beyond subsystem-local modules such as `backend/app/market/` and `backend/app/db/`.
- The package root re-exports selected helpers for convenient imports. `backend/app/market/__init__.py` and `backend/app/db/__init__.py` centralize commonly used symbols.
- Minimal barrel-file pattern is used in Python package `__init__.py` files, not in TypeScript.
- Use `backend/app/db/__init__.py` to expose `get_db` and `init_db`, and `backend/app/market/__init__.py` to expose cache, models, routers, and data-source factories.
## Schema Usage
- Keep the SQLite schema as a single SQL string constant in `backend/app/db/schema.py` and apply it with `conn.executescript(...)` from `backend/app/db/init.py`.
- Seed data belongs with initialization logic rather than migrations; `backend/app/db/init.py` inserts the default user, default tickers, and an initial portfolio snapshot.
- Use lightweight Pydantic `BaseModel` classes for request/response validation; examples: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/llm/router.py`, `backend/app/llm/schema.py`.
- LLM structured output is modeled in the same schema module consumed by the parser. `backend/app/llm/chat.py` passes `LLMResponse` to `litellm.completion(...)` and parses with `LLMResponse.model_validate_json(...)`.
- Current models use mutable-looking defaults for list fields in `backend/app/llm/schema.py`. Match the existing style when editing nearby code unless you are intentionally correcting that implementation detail across the module.
## Route Patterns
- Group routes by bounded context with `APIRouter(prefix=..., tags=[...])`; examples: `backend/app/routes/watchlist.py`, `backend/app/routes/portfolio.py`, `backend/app/routes/health.py`, `backend/app/llm/router.py`.
- Use `/api/...` prefixes for JSON endpoints and reserve `/api/stream/...` for SSE. See `backend/app/market/stream.py` and `backend/app/market/prices.py`.
- Keep stateful dependencies on `app.state` and inject them at runtime in `backend/app/main.py`; route handlers then read `request.app.state.cache`, `request.app.state.source`, and `request.app.state.db_path`.
- Register cache-dependent routers during lifespan startup after the cache is initialized. `backend/app/main.py` includes `create_stream_router(cache)` and `create_prices_router(cache)` inside the lifespan function.
- When a route depends on runtime objects, define it in a router factory returning a fresh `APIRouter`; examples: `backend/app/market/stream.py` and `backend/app/market/prices.py`.
- Tests depend on factory isolation. `backend/tests/market/test_prices.py` and `backend/tests/market/test_stream.py` assert that new router instances can be created repeatedly.
## Script Conventions
- Root scripts are thin wrappers around Docker or backend scripts, not alternate business-logic implementations; examples: `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `scripts/reset_portfolio.py`.
- Backend maintenance scripts are executable Python files with `main()` entrypoints and `if __name__ == "__main__":` guards; example: `backend/scripts/reset_portfolio.py`.
- Shell scripts use `set -e` and fail fast; see `scripts/start_mac.sh`.
- Windows PowerShell scripts mirror the macOS/Linux behavior closely, including `--build` handling and `.env` injection; compare `scripts/start_windows.ps1` with `scripts/start_mac.sh`.
- Playwright commands live in `test/package.json` and are intentionally minimal: `test`, `test:headed`, and `test:debug`.
- Backend developer commands are documented in `backend/README.md` rather than exposed as root `package.json` scripts.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

## Pattern Overview
- The backend entry point in `backend/app/main.py` owns startup, database initialization, market-data source startup, router registration, and static file mounting.
- Runtime state is centralized on `FastAPI.app.state` in `backend/app/main.py` with three shared objects: `cache`, `source`, and `db_path`.
- The checked-in UI is a static Next.js export under `backend/static/`, while the live `frontend/` source tree referenced by `Dockerfile` and `README.md` is not present in this repository snapshot.
## Layers
- Purpose: Construct the FastAPI app, initialize shared runtime services, and bind routes.
- Location: `backend/app/main.py`
- Contains: `FastAPI(...)`, `lifespan()`, static mount, router inclusion.
- Depends on: `app.db`, `app.market`, `app.llm`, `app.routes`, environment variable `DB_PATH`.
- Used by: `uvicorn app.main:app` from `Dockerfile` and local `uv run uvicorn ...` flows described in `README.md`.
- Purpose: Translate HTTP requests into domain/database operations and shape API responses.
- Location: `backend/app/routes/health.py`, `backend/app/routes/watchlist.py`, `backend/app/routes/portfolio.py`, `backend/app/llm/router.py`, `backend/app/market/stream.py`, `backend/app/market/prices.py`
- Contains: `APIRouter` instances, Pydantic request models, request-to-state lookups, HTTP validation.
- Depends on: `request.app.state`, `app.db.*`, `app.market.PriceCache`, `app.llm.chat`.
- Used by: the browser UI served from `backend/static/` and Playwright tests in `test/specs/*.ts`.
- Purpose: Initialize and access the SQLite database.
- Location: `backend/app/db/init.py`, `backend/app/db/schema.py`, `backend/app/db/watchlist.py`, `backend/app/db/portfolio.py`
- Contains: schema DDL, async connection context manager, watchlist CRUD, trade execution, portfolio snapshots.
- Depends on: `sqlite3`, `aiosqlite`, generated UUIDs, UTC timestamps.
- Used by: route handlers in `backend/app/routes/*.py` and LLM execution in `backend/app/llm/chat.py`.
- Purpose: Produce live prices, retain current and historical values, and expose them through REST/SSE.
- Location: `backend/app/market/`
- Contains: `PriceCache`, `MarketDataSource`, source factory, simulator implementation, Massive client, router factories.
- Depends on: environment variable `MASSIVE_API_KEY`, `numpy`, `massive`, asyncio background tasks.
- Used by: app startup in `backend/app/main.py`, portfolio valuation in `backend/app/routes/portfolio.py`, watchlist responses in `backend/app/routes/watchlist.py`, and chat context in `backend/app/llm/router.py`.
- Purpose: Build portfolio-aware prompts, call the model, parse structured actions, and execute requested trades/watchlist mutations.
- Location: `backend/app/llm/chat.py`, `backend/app/llm/router.py`, `backend/app/llm/schema.py`
- Contains: system prompt builder, LiteLLM call wrapper, in-memory conversation history, action execution against DB/cache.
- Depends on: `.env` loading, `litellm`, `app.db.portfolio`, `app.db.watchlist`, shared `PriceCache`.
- Used by: `POST /api/chat` in `backend/app/llm/router.py`.
- Purpose: Render the UI in the browser and talk to the backend over HTTP and SSE.
- Location: `backend/static/index.html`, `backend/static/_next/static/...`
- Contains: precompiled Next.js/Turbopack assets, static HTML shell, browser-side JS bundles.
- Depends on: backend APIs mounted under `/api/*` and static asset serving from `FastAPI.mount("/")`.
- Used by: end users at `/` and Playwright tests in `test/specs/*.ts`.
## Data Flow
- Process-wide shared state lives in memory on `app.state` and inside singleton module globals such as `_conversation_history` in `backend/app/llm/chat.py`.
- Durable business state lives in SQLite at the path configured by `DB_PATH`, defaulting to `db/finally.db` in `backend/app/main.py`.
- Live price state is ephemeral and held in `PriceCache` with a rolling in-memory history of up to 200 points per ticker in `backend/app/market/cache.py`.
## Key Abstractions
- Purpose: Thread-safe, in-memory source of truth for the latest prices and recent history.
- Examples: `backend/app/market/cache.py`, consumers in `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/llm/router.py`
- Pattern: Shared mutable service injected at startup and passed into router factories.
- Purpose: Stable contract for any background producer that writes updates into `PriceCache`.
- Examples: `backend/app/market/interface.py`, implementations `backend/app/market/simulator.py` and `backend/app/market/massive_client.py`
- Pattern: Strategy interface selected at runtime by `backend/app/market/factory.py`.
- Purpose: Bind runtime dependencies without using globals.
- Examples: `create_stream_router()` in `backend/app/market/stream.py`, `create_prices_router()` in `backend/app/market/prices.py`
- Pattern: Dependency injection through closure capture during app startup.
- Purpose: Keep SQL out of route files and expose task-focused async functions.
- Examples: `backend/app/db/watchlist.py`, `backend/app/db/portfolio.py`
- Pattern: Thin repository-style modules over raw SQL and `aiosqlite`.
- Purpose: Constrain model output to message text plus actionable trade/watchlist instructions.
- Examples: `backend/app/llm/schema.py`
- Pattern: Pydantic schema validation around model output before side effects execute.
## Entry Points
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app`, Docker `CMD` in `Dockerfile`
- Responsibilities: initialize DB, start market data source, mount API/static routes, stop background source on shutdown.
- Location: `Dockerfile`
- Triggers: `docker build`, `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `test/docker-compose.test.yml`
- Responsibilities: build a missing `frontend/` tree if present, install Python deps from `backend/pyproject.toml`, copy `backend/app`, copy static export to `/app/static`, run Uvicorn on port 8000.
- Location: `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `scripts/stop_mac.sh`, `scripts/stop_windows.ps1`, `scripts/reset_portfolio.py`, `backend/scripts/reset_portfolio.py`
- Triggers: local developer commands
- Responsibilities: build/run Docker, stop the container, or reset the database.
- Location: `backend/tests/`, `test/playwright.config.ts`, `test/docker-compose.test.yml`
- Triggers: `uv run pytest ...` for backend tests and `npx playwright test` inside the `playwright` service for E2E.
- Responsibilities: validate route contracts, DB helpers, market layer behavior, and browser-visible UI flows.
## Error Handling
- Validation errors are raised in route handlers such as `backend/app/routes/portfolio.py` and `backend/app/routes/watchlist.py`.
- Market background tasks in `backend/app/market/simulator.py` and `backend/app/market/massive_client.py` log exceptions and continue on the next cycle.
- `POST /api/chat` in `backend/app/llm/router.py` wraps the entire flow in `try/except` and returns a fallback payload instead of surfacing an HTTP 5xx body.
- Startup/shutdown lifecycle is wrapped in `lifespan()` in `backend/app/main.py`, which ensures the market data source is stopped when the app exits cleanly.
## Cross-Cutting Concerns
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

| Skill | Description | Path |
|-------|-------------|------|
| cerebras-inference | Use this to write code to call an LLM using LiteLLM and OpenRouter with the Cerebras inference provider | `.claude/skills/cerebras/SKILL.md` |
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
