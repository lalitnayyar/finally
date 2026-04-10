# FinAlly Backend

FastAPI backend for the FinAlly AI Trading Workstation.

## Runtime Contract

- Student workflow: start the container from the repo root with `./scripts/start_mac.sh` or `.\scripts\start_windows.ps1`
- Contributor workflow: run `uv run uvicorn app.main:app --reload --port 8000` from `backend/`
- `OPENROUTER_API_KEY` is required for normal startup unless `LLM_MOCK=true`
- `MASSIVE_API_KEY` is optional; when missing, the backend uses the simulator by default

## Structure

- `app/` - Application code
  - `market/` - Market data subsystem
    - `models.py` - PriceUpdate dataclass
    - `cache.py` - Thread-safe price cache
    - `interface.py` - MarketDataSource abstract interface
    - `simulator.py` - GBM-based market simulator
    - `massive_client.py` - Massive/Polygon.io API client
    - `factory.py` - Data source factory
    - `stream.py` - SSE streaming endpoint
    - `seed_prices.py` - Default ticker prices and parameters

- `tests/` - Unit and integration tests
  - `market/` - Market data tests

## Running Tests

```bash
uv sync --dev

uv run pytest
```

## Environment Variables

- `OPENROUTER_API_KEY` - Required for live LLM chat during normal startup.
- `MASSIVE_API_KEY` - Optional. If set, use real market data from Massive API. If not set, use the built-in simulator.
- `LLM_MOCK` - Optional. Set to `true` for deterministic local or CI chat behavior.

## Development

```bash
uv sync --dev

# Run backend locally
uv run uvicorn app.main:app --reload --port 8000
```
