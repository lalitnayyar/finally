# Codebase Structure

**Analysis Date:** 2026-04-10

## Directory Layout

```text
finally/
├── backend/                 # FastAPI app, database helpers, market/LLM modules, backend tests
├── db/                      # Local SQLite database file used by default runtime
├── scripts/                 # Repo-root operational scripts for Docker lifecycle and DB reset
├── test/                    # Playwright E2E suite and Docker Compose test harness
├── .github/workflows/       # GitHub Actions for Claude automation
├── .planning/codebase/      # Generated codebase mapping documents
├── planning/                # Product and technical planning notes, not runtime code
├── output_images/           # Generated assets/output artifacts
├── troubleshooting/         # Troubleshooting notes
├── Dockerfile               # Single-container build/runtime definition
├── README.md                # Setup, runtime, and architecture overview
└── .env.example             # Example environment configuration
```

## Directory Purposes

**`backend/`:**
- Purpose: Holds the actual application code and Python project configuration.
- Contains: `backend/app/` source, `backend/tests/` pytest suite, `backend/scripts/` maintenance script, `backend/pyproject.toml`, `backend/uv.lock`, checked-in `backend/static/` frontend export.
- Key files: `backend/app/main.py`, `backend/pyproject.toml`, `backend/tests/test_routes.py`

**`backend/app/`:**
- Purpose: Python package for the running FastAPI service.
- Contains: bootstrap code plus `db/`, `llm/`, `market/`, and `routes/` subpackages.
- Key files: `backend/app/main.py`, `backend/app/db/init.py`, `backend/app/market/factory.py`, `backend/app/llm/router.py`

**`backend/app/db/`:**
- Purpose: Database schema and data-access helpers.
- Contains: schema string, SQLite initialization, watchlist queries, portfolio/trade queries.
- Key files: `backend/app/db/schema.py`, `backend/app/db/init.py`, `backend/app/db/portfolio.py`, `backend/app/db/watchlist.py`

**`backend/app/market/`:**
- Purpose: Live market-data subsystem.
- Contains: cache model, provider interface, provider factory, simulator, Massive client, SSE router, history router, seed/correlation data.
- Key files: `backend/app/market/cache.py`, `backend/app/market/interface.py`, `backend/app/market/factory.py`, `backend/app/market/stream.py`

**`backend/app/llm/`:**
- Purpose: AI assistant request handling and tool/action execution.
- Contains: chat orchestration, response schemas, API router.
- Key files: `backend/app/llm/chat.py`, `backend/app/llm/router.py`, `backend/app/llm/schema.py`

**`backend/app/routes/`:**
- Purpose: Non-market, non-LLM HTTP routes.
- Contains: health, watchlist, and portfolio API handlers.
- Key files: `backend/app/routes/health.py`, `backend/app/routes/watchlist.py`, `backend/app/routes/portfolio.py`

**`backend/static/`:**
- Purpose: Checked-in browser bundle served by FastAPI at `/`.
- Contains: `index.html`, `_next/` assets, static icons, exported route artifacts such as `404.html`.
- Key files: `backend/static/index.html`, `backend/static/_next/static/...`

**`backend/tests/`:**
- Purpose: Backend unit and integration-style tests.
- Contains: route tests, DB tests, chat tests, and dedicated market subsystem tests.
- Key files: `backend/tests/test_routes.py`, `backend/tests/test_db.py`, `backend/tests/market/test_stream.py`

**`backend/scripts/`:**
- Purpose: Backend-local maintenance utilities.
- Contains: database reset script run from the backend working directory.
- Key files: `backend/scripts/reset_portfolio.py`

**`db/`:**
- Purpose: Default on-disk SQLite location for local runs.
- Contains: `db/finally.db`
- Key files: `db/finally.db`

**`scripts/`:**
- Purpose: Repo-root command entry points for developers.
- Contains: macOS/Windows start and stop scripts plus a wrapper around the backend reset script.
- Key files: `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `scripts/reset_portfolio.py`

**`test/`:**
- Purpose: Browser-level end-to-end test project.
- Contains: Playwright config, package manifest, Docker Compose harness, browser specs, test output directories.
- Key files: `test/playwright.config.ts`, `test/docker-compose.test.yml`, `test/specs/portfolio.spec.ts`

**`planning/`:**
- Purpose: Design notes, archived plans, and implementation writeups.
- Contains: markdown planning documents, archive directory.
- Key files: `planning/MARKET_DATA_DESIGN.md`, `planning/MARKET_INTERFACE.md`

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: Main FastAPI app and lifecycle entry point.
- `Dockerfile`: Production-style build and runtime entry point.
- `scripts/start_mac.sh`: macOS Docker start command.
- `scripts/start_windows.ps1`: Windows Docker start command.
- `test/playwright.config.ts`: Playwright test runner entry point.

**Configuration:**
- `backend/pyproject.toml`: Python dependencies, pytest, coverage, and Ruff config.
- `Dockerfile`: Container build steps and runtime command.
- `test/docker-compose.test.yml`: E2E orchestration for app + Playwright.
- `.env.example`: Example environment variable names.
- `.github/workflows/claude.yml`: GitHub automation configuration.

**Core Logic:**
- `backend/app/routes/portfolio.py`: Trade submission and derived portfolio response shaping.
- `backend/app/routes/watchlist.py`: Watchlist CRUD and live source synchronization.
- `backend/app/market/cache.py`: In-memory live-price and history store.
- `backend/app/market/simulator.py`: Default simulated price generator.
- `backend/app/market/massive_client.py`: Real market-data poller.
- `backend/app/llm/chat.py`: Prompt construction, model call, and action execution.
- `backend/app/db/portfolio.py`: Portfolio SQL and trade persistence.

**Testing:**
- `backend/tests/`: Python tests for backend behavior.
- `test/specs/`: Playwright specs for browser-visible flows.
- `test/test-results/`: Playwright output artifacts generated by test runs.

## Naming Conventions

**Files:**
- Python modules use lowercase snake_case filenames such as `backend/app/routes/watchlist.py` and `backend/app/market/massive_client.py`.
- Test files follow `test_*.py` in `backend/tests/` and `*.spec.ts` in `test/specs/`.
- Operational shell/PowerShell scripts use verb-oriented snake_case names such as `scripts/start_mac.sh` and `scripts/stop_windows.ps1`.

**Directories:**
- Runtime modules are grouped by concern under `backend/app/` as `db`, `llm`, `market`, and `routes`.
- Tests are split by runtime boundary: backend tests under `backend/tests/`, browser tests under `test/specs/`.
- Planning and generated metadata live outside the runtime tree in `planning/` and `.planning/`.

## Where to Add New Code

**New Backend Feature:**
- Primary code: `backend/app/routes/` for the HTTP surface, then the matching concern package under `backend/app/db/`, `backend/app/market/`, or `backend/app/llm/`.
- Tests: `backend/tests/` for backend behavior and `test/specs/` only if the feature changes browser-visible flows.

**New API Route:**
- Implementation: add a router module in `backend/app/routes/` or a factory-style router in `backend/app/market/` if it depends on injected runtime state like `PriceCache`.
- Registration: include it from `backend/app/main.py`.

**New Database Logic:**
- Implementation: add functions beside related SQL helpers in `backend/app/db/`.
- Schema changes: update `backend/app/db/schema.py` and initialization flow in `backend/app/db/init.py`.

**New Market Data Provider:**
- Implementation: add a new `MarketDataSource` implementation under `backend/app/market/`.
- Wiring: select it in `backend/app/market/factory.py`.

**New AI Behavior:**
- Implementation: extend prompt/action logic in `backend/app/llm/chat.py` and schemas in `backend/app/llm/schema.py`.
- HTTP wiring: keep the endpoint in `backend/app/llm/router.py`.

**Frontend Changes:**
- Runtime artifact: the deployed app serves files from `backend/static/`.
- Source location: not present in this repository snapshot. `Dockerfile` and `README.md` expect a separate `frontend/` tree, so verify where that source lives before adding UI code.

**Utilities:**
- Shared backend helpers: add them within the owning concern package under `backend/app/` rather than creating a broad utilities directory.
- Developer/ops scripts: add them under `scripts/` or `backend/scripts/` depending on whether they run from repo root or backend context.

## Special Directories

**`.planning/codebase/`:**
- Purpose: Generated repository intelligence documents for downstream planning/execution commands.
- Generated: Yes
- Committed: Yes

**`backend/static/`:**
- Purpose: Built frontend export served directly by FastAPI.
- Generated: Yes
- Committed: Yes

**`test/test-results/`:**
- Purpose: Playwright artifacts from prior runs.
- Generated: Yes
- Committed: No assumption enforced by code; it is present in the current working tree.

**`planning/archive/`:**
- Purpose: Archived planning documents and earlier design notes.
- Generated: No
- Committed: Yes

## Important Behavior Map

- App startup and shutdown behavior: `backend/app/main.py`
- SQLite schema and default data seeding: `backend/app/db/schema.py`, `backend/app/db/init.py`
- Watchlist persistence and runtime synchronization: `backend/app/routes/watchlist.py`, `backend/app/db/watchlist.py`
- Portfolio valuation, trade execution, and history: `backend/app/routes/portfolio.py`, `backend/app/db/portfolio.py`
- Live price production and cache mutation: `backend/app/market/simulator.py`, `backend/app/market/massive_client.py`, `backend/app/market/cache.py`
- SSE streaming and chart-history endpoints: `backend/app/market/stream.py`, `backend/app/market/prices.py`
- LLM prompt building and action execution: `backend/app/llm/chat.py`, `backend/app/llm/router.py`
- Dockerized local/prod startup: `Dockerfile`, `scripts/start_mac.sh`, `scripts/start_windows.ps1`
- E2E browser verification: `test/specs/*.ts`

## Notable Layout Constraints

- The repository contains `backend/static/` but no `frontend/` directory, even though `Dockerfile` and `README.md` reference `frontend/` build inputs.
- The live default database file `db/finally.db` is tracked at the repository root, while containerized runs mount `/app/db` through a Docker volume from `scripts/start_mac.sh`, `scripts/start_windows.ps1`, and `test/docker-compose.test.yml`.
- Runtime code is concentrated in `backend/app/`; most other top-level directories are support, planning, or test orchestration rather than production code.

---

*Structure analysis: 2026-04-10*
