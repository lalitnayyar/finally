# FinAlly — AI Trading Workstation

An AI-powered trading workstation with live market data, a simulated portfolio, and an LLM chat assistant that can analyze positions and execute trades. Built as a capstone project for an agentic AI coding course.

## What It Does

- Streams live prices for 10 default tickers (simulated by default, real data via Massive API)
- $10,000 virtual cash to trade with — buy/sell with market orders, instant fill
- Portfolio heatmap, P&L chart, positions table, and sparkline mini-charts
- AI chat assistant (powered by Cerebras via OpenRouter) that can discuss your portfolio and execute trades

## Stack

- **Frontend**: Next.js (TypeScript, static export), Tailwind CSS
- **Backend**: FastAPI (Python, managed by `uv`), SQLite
- **Real-time**: Server-Sent Events (SSE)
- **AI**: LiteLLM → OpenRouter → Cerebras (`openai/gpt-oss-120b`)
- **Deployment**: Single Docker container on port 8000

## Setup

1. Copy `.env.example` to `.env` and add your API key:
   ```
   OPENROUTER_API_KEY=your-key-here
   ```

2. Start:
   ```bash
   # macOS/Linux
   ./scripts/start_mac.sh

   # Windows
   .\scripts\start_windows.ps1
   ```

3. Open `http://localhost:8000`

## Troubleshooting

**UI changes not visible after `start_mac.sh` / Docker**

The FastAPI app serves the prebuilt Next.js export from `backend/static/`. That folder is copied into the image at build time. After you change the frontend, rebuild the static files, sync them into `backend/static/`, then rebuild the Docker image:

```bash
cd frontend && npm run build:sync
cd .. && ./scripts/start_mac.sh --build
```

On Windows: `.\scripts\start_windows.ps1 --build`

**Wrong `rsync` paths**

From the repo root, use `rsync -a frontend/out/ backend/static/`. From inside `frontend/`, use `npm run sync:static` (see `frontend/package.json`) so paths resolve correctly.

**Docker: “BuildKit is enabled but the buildx component is missing”**

The start scripts run `docker build` with the **classic** builder (`DOCKER_BUILDKIT=0`) so a normal Docker install works without the **buildx** plugin. If you prefer BuildKit, install [buildx](https://docs.docker.com/go/buildx/) and you can run builds with `DOCKER_BUILDKIT=1 docker build ...` yourself.

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `OPENROUTER_API_KEY` | Yes | OpenRouter key for LLM chat |
| `MASSIVE_API_KEY` | No | Real market data (omit to use simulator) |
| `LLM_MOCK` | No | Set `true` for deterministic mock responses (testing) |

## Development

```bash
cd backend
uv venv && uv pip install -e .
uv run uvicorn app.main:app --reload --port 8000
```

```bash
cd frontend
npm install && npm run dev
```

## Testing

```bash
# Backend unit tests
cd backend && uv run pytest tests/ -v

# E2E tests (requires Docker)
cd test && docker compose -f docker-compose.test.yml up
```
