# FinAlly — AI Trading Workstation

An AI-powered trading workstation with live market data, a simulated portfolio, and an LLM chat assistant that can analyze positions and execute trades. Built as a capstone project for an agentic AI coding course.

## What It Does

- Streams live prices for 10 default tickers (simulated by default, real data via Massive API)
- $10,000 virtual cash to trade with — buy/sell with market orders, instant fill
- Portfolio heatmap, P&L chart, positions table, and sparkline mini-charts
- AI chat assistant (powered by Cerebras via OpenRouter) that can discuss your portfolio and execute trades

## Stack

- **Frontend**: Next.js (TypeScript, static export)
- **Backend**: FastAPI (Python, managed by `uv`), SQLite
- **Real-time**: Server-Sent Events (SSE)
- **AI**: LiteLLM → OpenRouter → Cerebras (`openai/gpt-oss-120b`)
- **Deployment**: Single Docker container on port 8000

## Student Launch

This is the authoritative v1 path for students.

1. Copy `.env.example` to `.env`.
2. Set `OPENROUTER_API_KEY` in `.env`.
3. Optionally set `MASSIVE_API_KEY` if you want live market data instead of the default simulator.
4. Start the app:

```bash
# macOS/Linux
./scripts/start_mac.sh
```

```powershell
# Windows PowerShell
.\scripts\start_windows.ps1
```

The startup scripts stop before `docker run` if `.env` is missing or `OPENROUTER_API_KEY` is blank. They tell you to use `.env.example` and never print secret values.

Open `http://localhost:8000`.

## Contributor Workflow

Docker remains the primary student path. Use this local workflow only for source-level development.

```bash
cd backend
uv sync --dev
uv run uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

## Start And Stop

```bash
# macOS/Linux
./scripts/start_mac.sh
./scripts/stop_mac.sh
```

```powershell
# Windows PowerShell
.\scripts\start_windows.ps1
.\scripts\stop_windows.ps1
```

Use `--build` with the start scripts when you need a fresh Docker image rebuild.

## Frontend Rebuilds

`backend/static/` is committed generated output from the `frontend/` source tree. After changing the frontend source, rebuild and resync before rebuilding Docker:

```bash
cd frontend
npm run build:sync
cd ..
./scripts/start_mac.sh --build
```

On Windows:

```powershell
cd frontend
npm run build:sync
cd ..
.\scripts\start_windows.ps1 --build
```

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | Required for startup and the live AI assistant |
| `MASSIVE_API_KEY` | No | Optional real market data; omit to use simulator mode |
| `LLM_MOCK` | No | Set `true` only for deterministic testing/development chat |

## Testing

```bash
# Startup preflight contract
python3 scripts/test_startup_preflight.py
```

```bash
# Backend unit tests
cd backend && uv run pytest tests/ -v
```

```bash
# E2E tests (requires Docker)
cd test && docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from playwright
```

## Troubleshooting

If startup exits immediately, check these first:

- `.env` exists at the repo root
- `OPENROUTER_API_KEY` is set in `.env`
- Docker is installed and running

If the frontend looks stale after a source edit, rebuild the export and resync `backend/static/`:

```bash
cd frontend && npm run build:sync
```

If `MASSIVE_API_KEY` is unset, blank, or removed, FinAlly intentionally falls back to the simulator.
