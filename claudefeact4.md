# FinAlly — 10 Key Features

Extracted from README.md

1. **Live Price Streaming** — Streams real-time prices for 10 default tickers using Server-Sent Events (SSE), with the built-in market simulator active by default.

2. **Simulated Trading with Virtual Cash** — Users start with $10,000 in virtual cash and can execute market orders (buy/sell) with instant fill and no fees.

3. **Portfolio Heatmap** — A treemap visualization where each rectangle represents a position, sized by portfolio weight and colored by P&L (green = profit, red = loss).

4. **P&L Chart** — A line chart tracking total portfolio value over time, giving users a clear view of their performance history.

5. **Positions Table** — A tabular display of all holdings showing ticker, quantity, average cost, current price, unrealized P&L, and percentage change.

6. **Sparkline Mini-Charts** — Small inline price charts displayed alongside each ticker in the watchlist, accumulated progressively from the SSE stream.

7. **AI Chat Assistant** — An LLM-powered assistant (Cerebras via OpenRouter) that can discuss the user's portfolio, provide analysis, and answer questions.

8. **AI Trade Execution** — The AI assistant can execute trades automatically on the user's behalf through natural language commands, without any confirmation dialog.

9. **Real Market Data Support** — Optional integration with the Massive API for live real-world market data; falls back to the built-in simulator if no API key is provided.

10. **Single Docker Container Deployment** — The entire application (frontend + backend + database) runs in a single Docker container on port 8000, requiring just one command to start.
