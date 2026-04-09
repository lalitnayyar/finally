# Architecture

**Analysis Date:** 2026-04-10

## Pattern Overview

**Overall:** Single-process FastAPI application serving JSON APIs, an SSE stream, and a prebuilt static frontend from one container.

**Key Characteristics:**
- The backend entry point in `backend/app/main.py` owns startup, database initialization, market-data source startup, router registration, and static file mounting.
- Runtime state is centralized on `FastAPI.app.state` in `backend/app/main.py` with three shared objects: `cache`, `source`, and `db_path`.
- The checked-in UI is a static Next.js export under `backend/static/`, while the live `frontend/` source tree referenced by `Dockerfile` and `README.md` is not present in this repository snapshot.

## Layers

**Application Bootstrap:**
- Purpose: Construct the FastAPI app, initialize shared runtime services, and bind routes.
- Location: `backend/app/main.py`
- Contains: `FastAPI(...)`, `lifespan()`, static mount, router inclusion.
- Depends on: `app.db`, `app.market`, `app.llm`, `app.routes`, environment variable `DB_PATH`.
- Used by: `uvicorn app.main:app` from `Dockerfile` and local `uv run uvicorn ...` flows described in `README.md`.

**API Layer:**
- Purpose: Translate HTTP requests into domain/database operations and shape API responses.
- Location: `backend/app/routes/health.py`, `backend/app/routes/watchlist.py`, `backend/app/routes/portfolio.py`, `backend/app/llm/router.py`, `backend/app/market/stream.py`, `backend/app/market/prices.py`
- Contains: `APIRouter` instances, Pydantic request models, request-to-state lookups, HTTP validation.
- Depends on: `request.app.state`, `app.db.*`, `app.market.PriceCache`, `app.llm.chat`.
- Used by: the browser UI served from `backend/static/` and Playwright tests in `test/specs/*.ts`.

**Persistence Layer:**
- Purpose: Initialize and access the SQLite database.
- Location: `backend/app/db/init.py`, `backend/app/db/schema.py`, `backend/app/db/watchlist.py`, `backend/app/db/portfolio.py`
- Contains: schema DDL, async connection context manager, watchlist CRUD, trade execution, portfolio snapshots.
- Depends on: `sqlite3`, `aiosqlite`, generated UUIDs, UTC timestamps.
- Used by: route handlers in `backend/app/routes/*.py` and LLM execution in `backend/app/llm/chat.py`.

**Market Data Layer:**
- Purpose: Produce live prices, retain current and historical values, and expose them through REST/SSE.
- Location: `backend/app/market/`
- Contains: `PriceCache`, `MarketDataSource`, source factory, simulator implementation, Massive client, router factories.
- Depends on: environment variable `MASSIVE_API_KEY`, `numpy`, `massive`, asyncio background tasks.
- Used by: app startup in `backend/app/main.py`, portfolio valuation in `backend/app/routes/portfolio.py`, watchlist responses in `backend/app/routes/watchlist.py`, and chat context in `backend/app/llm/router.py`.

**LLM Orchestration Layer:**
- Purpose: Build portfolio-aware prompts, call the model, parse structured actions, and execute requested trades/watchlist mutations.
- Location: `backend/app/llm/chat.py`, `backend/app/llm/router.py`, `backend/app/llm/schema.py`
- Contains: system prompt builder, LiteLLM call wrapper, in-memory conversation history, action execution against DB/cache.
- Depends on: `.env` loading, `litellm`, `app.db.portfolio`, `app.db.watchlist`, shared `PriceCache`.
- Used by: `POST /api/chat` in `backend/app/llm/router.py`.

**Presentation Layer:**
- Purpose: Render the UI in the browser and talk to the backend over HTTP and SSE.
- Location: `backend/static/index.html`, `backend/static/_next/static/...`
- Contains: precompiled Next.js/Turbopack assets, static HTML shell, browser-side JS bundles.
- Depends on: backend APIs mounted under `/api/*` and static asset serving from `FastAPI.mount("/")`.
- Used by: end users at `/` and Playwright tests in `test/specs/*.ts`.

## Data Flow

**Startup Flow:**

1. `backend/app/main.py` reads `DB_PATH`, calls `init_db()`, and creates a `PriceCache`.
2. `backend/app/main.py` opens SQLite via `get_db()` and loads the persisted watchlist from `backend/app/db/watchlist.py`.
3. `backend/app/main.py` seeds prices from `backend/app/market/seed_prices.py`, creates a market data source via `backend/app/market/factory.py`, starts that source, stores `cache`, `source`, and `db_path` on `app.state`, then registers stream/price routers.
4. `backend/app/main.py` mounts `backend/static/` at `/` after API routes so `/api/*` stays owned by FastAPI.

**Watchlist Flow:**

1. `POST /api/watchlist` in `backend/app/routes/watchlist.py` validates the ticker and persists it via `backend/app/db/watchlist.py`.
2. If the insert succeeds, the route calls `request.app.state.source.add_ticker()` so the live data source begins tracking it.
3. `GET /api/watchlist` reads the persisted list from SQLite and enriches each ticker with the latest `PriceCache` snapshot before returning JSON.
4. `DELETE /api/watchlist/{ticker}` removes the row from SQLite and then removes the ticker from the active source/cache.

**Trade Flow:**

1. `POST /api/portfolio/trade` in `backend/app/routes/portfolio.py` validates `side` and `quantity`, then reads the live price from `request.app.state.cache`.
2. The route executes the trade through `backend/app/db/portfolio.py`, which updates `users_profile`, `positions`, `trades`, and `portfolio_snapshots` in one async DB session.
3. The route re-reads the portfolio and records a second snapshot using live cache prices so chart/history consumers can show a more accurate post-trade valuation.
4. `GET /api/portfolio` and `GET /api/portfolio/history` read back the persisted state and derived totals.

**Chat Flow:**

1. `POST /api/chat` in `backend/app/llm/router.py` reads current portfolio rows and watchlist tickers from SQLite, then enriches them with live prices from `PriceCache`.
2. `backend/app/llm/chat.py` builds a system prompt, appends in-memory conversation history, and calls LiteLLM.
3. The parsed `LLMResponse` drives `execute_llm_actions()`, which can call `execute_trade()`, `add_ticker()`, and `remove_ticker()` directly against the open DB connection.
4. The endpoint returns the assistant message plus structured `trades`, `watchlist_changes`, and `execution_results`; failures collapse into a fallback JSON response instead of raising HTTP errors.

**Streaming/UI Flow:**

1. A browser page loaded from `backend/static/index.html` connects to `GET /api/stream/prices`.
2. `backend/app/market/stream.py` polls `PriceCache.version` and emits an SSE payload whenever a ticker update changes the cache.
3. Router `GET /api/prices/{ticker}/history` in `backend/app/market/prices.py` bootstraps chart history from the cache’s rolling per-ticker buffer.
4. UI behavior is verified indirectly by Playwright specs such as `test/specs/connection.spec.ts`, `test/specs/watchlist.spec.ts`, and `test/specs/portfolio.spec.ts`.

**State Management:**
- Process-wide shared state lives in memory on `app.state` and inside singleton module globals such as `_conversation_history` in `backend/app/llm/chat.py`.
- Durable business state lives in SQLite at the path configured by `DB_PATH`, defaulting to `db/finally.db` in `backend/app/main.py`.
- Live price state is ephemeral and held in `PriceCache` with a rolling in-memory history of up to 200 points per ticker in `backend/app/market/cache.py`.

## Key Abstractions

**`PriceCache`:**
- Purpose: Thread-safe, in-memory source of truth for the latest prices and recent history.
- Examples: `backend/app/market/cache.py`, consumers in `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/llm/router.py`
- Pattern: Shared mutable service injected at startup and passed into router factories.

**`MarketDataSource`:**
- Purpose: Stable contract for any background producer that writes updates into `PriceCache`.
- Examples: `backend/app/market/interface.py`, implementations `backend/app/market/simulator.py` and `backend/app/market/massive_client.py`
- Pattern: Strategy interface selected at runtime by `backend/app/market/factory.py`.

**Router Factories:**
- Purpose: Bind runtime dependencies without using globals.
- Examples: `create_stream_router()` in `backend/app/market/stream.py`, `create_prices_router()` in `backend/app/market/prices.py`
- Pattern: Dependency injection through closure capture during app startup.

**Database Helper Modules:**
- Purpose: Keep SQL out of route files and expose task-focused async functions.
- Examples: `backend/app/db/watchlist.py`, `backend/app/db/portfolio.py`
- Pattern: Thin repository-style modules over raw SQL and `aiosqlite`.

**Structured LLM Response Models:**
- Purpose: Constrain model output to message text plus actionable trade/watchlist instructions.
- Examples: `backend/app/llm/schema.py`
- Pattern: Pydantic schema validation around model output before side effects execute.

## Entry Points

**Primary HTTP App:**
- Location: `backend/app/main.py`
- Triggers: `uvicorn app.main:app`, Docker `CMD` in `Dockerfile`
- Responsibilities: initialize DB, start market data source, mount API/static routes, stop background source on shutdown.

**Container Build and Runtime:**
- Location: `Dockerfile`
- Triggers: `docker build`, `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `test/docker-compose.test.yml`
- Responsibilities: build a missing `frontend/` tree if present, install Python deps from `backend/pyproject.toml`, copy `backend/app`, copy static export to `/app/static`, run Uvicorn on port 8000.

**Operational Scripts:**
- Location: `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `scripts/stop_mac.sh`, `scripts/stop_windows.ps1`, `scripts/reset_portfolio.py`, `backend/scripts/reset_portfolio.py`
- Triggers: local developer commands
- Responsibilities: build/run Docker, stop the container, or reset the database.

**Test Entry Points:**
- Location: `backend/tests/`, `test/playwright.config.ts`, `test/docker-compose.test.yml`
- Triggers: `uv run pytest ...` for backend tests and `npx playwright test` inside the `playwright` service for E2E.
- Responsibilities: validate route contracts, DB helpers, market layer behavior, and browser-visible UI flows.

## Error Handling

**Strategy:** API routes mostly fail fast with `HTTPException` for input and business-rule violations, while background loops and the chat endpoint swallow exceptions, log them, and keep the process alive.

**Patterns:**
- Validation errors are raised in route handlers such as `backend/app/routes/portfolio.py` and `backend/app/routes/watchlist.py`.
- Market background tasks in `backend/app/market/simulator.py` and `backend/app/market/massive_client.py` log exceptions and continue on the next cycle.
- `POST /api/chat` in `backend/app/llm/router.py` wraps the entire flow in `try/except` and returns a fallback payload instead of surfacing an HTTP 5xx body.
- Startup/shutdown lifecycle is wrapped in `lifespan()` in `backend/app/main.py`, which ensures the market data source is stopped when the app exits cleanly.

## Cross-Cutting Concerns

**Logging:** Standard-library `logging` is used in `backend/app/main.py`, `backend/app/llm/router.py`, and the market modules; no separate logging package or central config module is present.

**Validation:** Request schemas use Pydantic models in `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, and `backend/app/llm/router.py`; ticker format validation is regex-based in route/LLM code.

**Authentication:** Not detected. All API routes under `/api/*` are unauthenticated in the checked-in backend.

**Backend/Frontend Split:** The backend source lives under `backend/app/`; the frontend runtime artifact lives under `backend/static/`; browser-level behavior is tested from `test/specs/*.ts`. The source `frontend/` tree referenced by `Dockerfile` and `README.md` is not present, so the repository currently ships the compiled frontend rather than its source code.

**Runtime Interactions:** One FastAPI process owns HTTP serving, SQLite access, background market-data polling/simulation, SSE generation, and static asset serving. There is no separate worker process, queue, cache server, or frontend dev server in the checked-in runtime layout.

---

*Architecture analysis: 2026-04-10*
