# FinAlly — Feature List

A summary of the 10 key features of the FinAlly AI Trading Workstation.

---

## 1. Live Price Streaming via Server-Sent Events (SSE)

Prices for all watched tickers are pushed to the browser in real time over a persistent SSE connection (`GET /api/stream/prices`). Each event carries the ticker symbol, current price, previous price, timestamp, absolute change, percentage change, and direction (`up` / `down` / `flat`). The browser's native `EventSource` API handles automatic reconnection.

## 2. GBM Market Simulator (Default Data Source)

When no real-data API key is configured, a built-in Geometric Brownian Motion (GBM) simulator generates realistic price action every 500 ms. Prices start from realistic seed values (e.g. AAPL ≈ $190, NVDA ≈ $430) and evolve with per-ticker drift and volatility parameters. Sector-correlated moves are produced via Cholesky decomposition, and occasional random "shock" events (2–5 % moves) add visual drama.

## 3. Real Market Data via Massive / Polygon.io API

Setting the `MASSIVE_API_KEY` environment variable switches the data source from the simulator to a live REST polling client backed by Polygon.io. Both sources implement the same abstract `MarketDataSource` interface, so all downstream code (cache, SSE, trade execution) is source-agnostic. Polling interval is configurable to respect free-tier rate limits (≤ 5 calls/min).

## 4. Thread-Safe In-Memory Price Cache with History

A central `PriceCache` stores the latest `PriceUpdate` for every ticker and maintains a rolling history of the last 200 price points. A version counter enables efficient change detection — the SSE endpoint only pushes a new event when the cache version advances, avoiding redundant network traffic. The history is accessible via `GET /api/prices/{ticker}/history` to bootstrap charts on page load.

## 5. Virtual Portfolio with $10,000 Starting Cash

Each user begins with $10,000 in virtual cash. They can execute market-order trades (buy / sell) at the current live price with instant fill and no fees. Positions are stored in SQLite (`positions` table) with per-ticker quantity and average cost. Cash is updated atomically with each trade, and a trade history log (`trades` table) records every execution for audit purposes.

## 6. Portfolio Heatmap & P&L Charting

A treemap heatmap visualises current positions sized by portfolio weight and colour-coded by unrealized P&L (green = profit, red = loss). A separate P&L line chart tracks total portfolio value over time using the `portfolio_snapshots` table, which is updated after every trade and on backend startup.

## 7. AI Chat Assistant (LLM-Powered Trade Execution)

An integrated chat panel connects to Cerebras (via LiteLLM → OpenRouter) for fast inference. The assistant can answer questions about the portfolio, explain market moves, and — through structured LLM output — execute trades and manage the watchlist on the user's behalf via natural language commands (e.g. "Buy 5 shares of NVDA" or "Add AMZN to my watchlist").

## 8. Dynamic Watchlist Management

The watchlist starts with 10 default tickers (AAPL, GOOGL, MSFT, AMZN, TSLA, NVDA, META, JPM, V, NFLX). Users can add or remove tickers at any time — both manually through the UI and via the AI assistant. When a ticker is added, the market data source and price cache are updated immediately so streaming begins without a page reload.

## 9. Single-Container Deployment (Docker)

The entire application ships as a single Docker container on port 8000. A multi-stage Dockerfile builds the Next.js frontend (static export), then packages it with the FastAPI backend. Start/stop convenience scripts are provided for macOS/Linux and Windows. The SQLite database file is persisted via a Docker volume — no external services or databases required.

## 10. Zero-Setup Database with Lazy Initialization

The SQLite database is created and seeded automatically on first run — no migration commands, no manual schema setup. On startup the backend checks for the database file; if it is missing or empty, it creates the schema and inserts default seed data (user profile, watchlist, initial portfolio snapshot). This keeps onboarding to a single command and makes fresh environments reproducible.
