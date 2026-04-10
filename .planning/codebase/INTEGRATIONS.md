# External Integrations

**Analysis Date:** 2026-04-10

## APIs & External Services

**LLM Providers:**
- OpenRouter - LLM gateway for chat completions in `backend/app/llm/chat.py`.
  - SDK/Client: `litellm`
  - Auth: `OPENROUTER_API_KEY`
- Cerebras - Preferred downstream inference provider selected through LiteLLM `extra_body` in `backend/app/llm/chat.py`.
  - SDK/Client: indirect via `litellm`
  - Auth: inherited through `OPENROUTER_API_KEY`

**Market Data:**
- Massive / Polygon.io - Real stock snapshot polling for live prices in `backend/app/market/massive_client.py` and source selection in `backend/app/market/factory.py`.
  - SDK/Client: `massive`
  - Auth: `MASSIVE_API_KEY`

**Developer Automation:**
- Anthropic Claude GitHub Action - PR review and issue/comment automation in `.github/workflows/claude.yml` and `.github/workflows/claude-code-review.yml`.
  - SDK/Client: GitHub Actions `anthropics/claude-code-action@v1`
  - Auth: GitHub secret `CLAUDE_CODE_OAUTH_TOKEN`

## Data Storage

**Databases:**
- SQLite
  - Connection: `DB_PATH`
  - Client: standard `sqlite3` and async `aiosqlite` in `backend/app/db/init.py`
  - Schema: `backend/app/db/schema.py`
  - Files detected: `backend/db/finally.db`, `db/finally.db`

**File Storage:**
- Local filesystem only
  - Generated frontend assets live in `backend/static/`
  - Persistent SQLite volume is mounted at `/app/db` by `scripts/start_mac.sh`, `scripts/start_windows.ps1`, and `test/docker-compose.test.yml`

**Caching:**
- In-memory process-local price cache via `backend/app/market/cache.py`
  - No external Redis or managed cache detected

## Authentication & Identity

**Auth Provider:**
- None for end users
  - Implementation: no login, session, token issuance, or auth middleware detected in `backend/app/main.py` or route modules under `backend/app/routes/`

**Service Authentication:**
- Environment-variable based API keys for upstream services via `.env.example` and `backend/app/llm/chat.py`

## Monitoring & Observability

**Error Tracking:**
- None detected

**Logs:**
- Standard Python logging in `backend/app/main.py`, `backend/app/market/factory.py`, `backend/app/market/massive_client.py`, `backend/app/market/stream.py`, and `backend/app/llm/router.py`
- Docker/container logs are the default operational surface from `scripts/start_mac.sh` and `scripts/start_windows.ps1`

## CI/CD & Deployment

**Hosting:**
- Dockerized single-container deployment defined by `Dockerfile`
- FastAPI serves both APIs and static frontend assets from the same container in `backend/app/main.py`

**CI Pipeline:**
- GitHub Actions only
  - `.github/workflows/claude.yml`
  - `.github/workflows/claude-code-review.yml`
- No build/test CI for application code detected beyond Claude automation workflows

## Environment Configuration

**Required env vars:**
- `OPENROUTER_API_KEY` - Required for real LLM chat in `.env.example` and `README.md`
- `MASSIVE_API_KEY` - Optional real market data key in `.env.example` and `backend/app/market/factory.py`
- `LLM_MOCK` - Optional mock-mode switch in `.env.example`, `backend/app/llm/chat.py`, and `test/docker-compose.test.yml`
- `DB_PATH` - Optional database path override in `backend/app/main.py`, `Dockerfile`, and `test/docker-compose.test.yml`

**Secrets location:**
- Repo-root `.env` for local development, loaded by `backend/app/llm/chat.py`
- GitHub Actions secrets for CI automation in `.github/workflows/*.yml`

## Webhooks & Callbacks

**Incoming:**
- GitHub event triggers into Actions workflows in `.github/workflows/claude.yml` and `.github/workflows/claude-code-review.yml`
- Browser SSE clients connect to `/api/stream/prices` in `backend/app/market/stream.py`

**Outgoing:**
- HTTPS requests from `backend/app/llm/chat.py` to OpenRouter via LiteLLM
- HTTPS requests from `backend/app/market/massive_client.py` to Massive / Polygon.io

## Integration Boundaries

**Frontend/Backend Boundary:**
- FastAPI mounts the generated frontend export from `backend/static/` at `/` in `backend/app/main.py`
- The frontend consumes REST endpoints under `/api/*` and SSE at `/api/stream/prices`, based on route definitions in `backend/app/routes/`, `backend/app/llm/router.py`, `backend/app/market/prices.py`, and `backend/app/market/stream.py`

**Test Boundary:**
- `test/docker-compose.test.yml` composes the production-like app container with a Playwright runner container
- `test/specs/chat.spec.ts` depends on `LLM_MOCK=true`, so E2E tests avoid live OpenRouter calls

**Fallback Behavior:**
- If `MASSIVE_API_KEY` is absent, `backend/app/market/factory.py` routes market data to the in-process simulator in `backend/app/market/simulator.py`
- If `LLM_MOCK=true`, `backend/app/llm/chat.py` bypasses external LLM calls and returns deterministic mock responses

---

*Integration audit: 2026-04-10*
