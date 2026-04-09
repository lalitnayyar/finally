# Technology Stack

**Analysis Date:** 2026-04-10

## Languages

**Primary:**
- Python 3.12+ - Backend API, market data, database access, and LLM orchestration in `backend/app/` with dependency metadata in `backend/pyproject.toml`.
- TypeScript - End-to-end tests in `test/specs/chat.spec.ts` and inferred frontend application source referenced by `Dockerfile` and `README.md`.

**Secondary:**
- Shell / PowerShell - Local container lifecycle scripts in `scripts/start_mac.sh`, `scripts/stop_mac.sh`, `scripts/start_windows.ps1`, and `scripts/stop_windows.ps1`.
- HTML/CSS/JavaScript - Generated static frontend export served from `backend/static/index.html` and related `_next` assets under `backend/static/`.
- YAML - CI and test orchestration in `.github/workflows/*.yml` and `test/docker-compose.test.yml`.

## Runtime

**Environment:**
- Python 3.12 slim runtime image in `Dockerfile`.
- Node.js 20 slim build image in `Dockerfile` for frontend build and Playwright tooling in `test/package.json`.
- Docker container exposes port `8000` and sets `DB_PATH=/app/db/finally.db` in `Dockerfile`.

**Package Manager:**
- `uv` - Python dependency management and execution, defined by `backend/pyproject.toml` and locked in `backend/uv.lock`.
- `npm` - Frontend build stage and Playwright test workspace, evidenced by `Dockerfile`, `test/package.json`, and `test/package-lock.json`.
- Lockfile: present via `backend/uv.lock` and `test/package-lock.json`.

## Frameworks

**Core:**
- FastAPI `>=0.115.0` - Main HTTP API in `backend/app/main.py` and route modules under `backend/app/routes/`.
- Uvicorn `>=0.32.0` with `standard` extras - ASGI server launched by `Dockerfile` and documented in `README.md`.
- Next.js - Inferred frontend framework from `README.md`, `Dockerfile` frontend build stage, and generated `_next` artifacts in `backend/static/index.html`.

**Testing:**
- Pytest `>=8.3.0` - Backend test runner configured in `backend/pyproject.toml` and used under `backend/tests/`.
- `pytest-asyncio` `>=0.24.0` - Async backend tests configured in `backend/pyproject.toml`.
- `pytest-cov` `>=5.0.0` - Coverage support configured in `backend/pyproject.toml`.
- Playwright `^1.40.0` - Browser E2E tests in `test/package.json` and `test/specs/chat.spec.ts`.

**Build/Dev:**
- Hatchling - Python build backend in `backend/pyproject.toml`.
- Ruff `>=0.7.0` - Formatting and linting in `backend/pyproject.toml` and `backend/README.md`.
- Docker multi-stage build - Frontend build plus Python runtime packaging in `Dockerfile`.

## Key Dependencies

**Critical:**
- `fastapi>=0.115.0` - API framework and router composition in `backend/app/main.py`.
- `uvicorn[standard]>=0.32.0` - Production server entrypoint in `Dockerfile`.
- `aiosqlite>=0.22.1` - Async database access in `backend/app/db/init.py`.
- `litellm>=1.83.4` - LLM abstraction used in `backend/app/llm/chat.py`.
- `massive>=1.0.0` - Real market data client used by `backend/app/market/massive_client.py`.
- `numpy>=2.0.0` - Market simulation math in `backend/app/market/simulator.py`.

**Infrastructure:**
- `python-dotenv>=1.0.1` - Loads repo-root `.env` for backend chat integration in `backend/app/llm/chat.py`.
- `rich>=13.0.0` - Installed in `backend/pyproject.toml`; not detected in runtime imports.
- `@playwright/test` `^1.40.0` - Browser automation in `test/specs/chat.spec.ts`.

## Configuration

**Environment:**
- Runtime env vars are documented in `.env.example`, `README.md`, and `backend/README.md`.
- Detected variables: `OPENROUTER_API_KEY`, `MASSIVE_API_KEY`, `LLM_MOCK`, and `DB_PATH`.
- `.env` and `.env.example` are present at repo root; `.env` exists but was not read.

**Build:**
- `Dockerfile` defines the canonical production build and runtime packaging path.
- `backend/pyproject.toml` carries Python dependency, pytest, coverage, and Ruff configuration.
- `test/docker-compose.test.yml` defines the E2E app container and Playwright runner.
- No frontend source manifest such as `frontend/package.json` is present in this checkout, despite being referenced by `Dockerfile`.

## Platform Requirements

**Development:**
- Docker is required for the default local startup flow in `scripts/start_mac.sh` and `scripts/start_windows.ps1`.
- Python toolchain with `uv` is required for direct backend development from `README.md` and `backend/README.md`.
- Node.js and `npm` are required for Playwright tests in `test/package.json`, and would also be required for the missing `frontend/` build source referenced by `Dockerfile`.

**Production:**
- Single-container deployment on port `8000`, serving FastAPI APIs plus static frontend files from `backend/static/`, as defined in `Dockerfile` and `backend/app/main.py`.

## Generated Assets And Runtime Setup

- `backend/static/` is a generated frontend export containing `index.html`, `_next` chunk references, and static assets that FastAPI mounts at `/` in `backend/app/main.py`.
- `backend/db/finally.db` and `db/finally.db` are SQLite database files; the container persists `/app/db` via Docker volume mounts in `scripts/start_mac.sh`, `scripts/start_windows.ps1`, and `test/docker-compose.test.yml`.
- `.github/workflows/claude.yml` and `.github/workflows/claude-code-review.yml` integrate Anthropic GitHub Actions for issue/PR automation and review.
- Frontend technology details beyond generated output are partially inferred because the `frontend/` source tree referenced by `Dockerfile` is not present in this repository snapshot.

---

*Stack analysis: 2026-04-10*
