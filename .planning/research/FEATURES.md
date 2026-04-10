# Feature Research

**Domain:** Brownfield single-user AI trading workstation for course students
**Researched:** 2026-04-10
**Confidence:** HIGH

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| One-command local launch | The project promise is "run one app locally and start trading immediately." | MEDIUM | Must hide setup complexity behind Docker/start scripts and reliably serve frontend + backend on one port. |
| Live watchlist with streaming prices | A trading workstation without live prices is not credible. | MEDIUM | Depends on SSE stream stability, shared price cache, and sensible simulator defaults. |
| Persisted watchlist management | Students expect add/remove ticker workflows to survive refreshes and restarts. | LOW | Needs idempotent add/remove behavior and alignment between API, UI, and AI actions. |
| Manual simulated trading | Buying and selling positions is the core product interaction. | MEDIUM | Market orders only for v1. Must update cash, positions, trade log, and portfolio snapshots consistently. |
| Portfolio visibility | Users need current holdings, cash, total value, and unrealized P&L to trust the workstation. | MEDIUM | Includes positions table and backend-calculated portfolio summary. |
| Main chart for selected ticker | Clicking a ticker and seeing richer price context is baseline terminal behavior. | MEDIUM | Use rolling history endpoint plus live updates; do not depend only on session-accumulated frontend state. |
| Connection and runtime state visibility | Streaming apps need obvious connected/reconnecting/disconnected feedback. | LOW | Header status indicator is required to make SSE failures legible instead of silent. |
| Reliable core-flow E2E coverage | In this brownfield repo, "complete" is defined by reproducible working student flows, not partial code. | HIGH | Must cover launch, stream, manual trades, portfolio visuals, and AI-assisted actions. |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required in a generic paper trading app, but central to this course project's value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| AI chat assistant with portfolio-aware analysis | Converts the workstation from a static dashboard into an interactive AI copilot. | HIGH | Requires runtime portfolio/watchlist context injection and responses grounded in current state. |
| AI-executed trade actions | Lets students see structured agentic execution, not just text chat. | HIGH | Must validate quantities, prices, and side effects through the same backend trade path as manual orders. |
| AI-managed watchlist actions | Demonstrates natural-language control over workspace state. | MEDIUM | Must use the same canonical ticker normalization and watchlist mutation path as manual flows. |
| Bloomberg-inspired, data-dense terminal UI | The course deliverable is an AI trading workstation, not a CRUD demo. | MEDIUM | Includes dark terminal aesthetic, dense information layout, and price-change feedback animations. |
| Position heatmap and portfolio P&L history | Gives students a more convincing "workstation" feel than a plain positions table alone. | MEDIUM | Heatmap depends on accurate portfolio aggregation; P&L chart depends on snapshot integrity. |
| Simulator-first market data with optional real-data swap | Preserves zero-config local usability while leaving room for more realistic demos. | MEDIUM | Keep one interface for simulator and Massive-backed market data; simulator remains the default path. |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems for this v1.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Real-money brokerage integration | Feels more "real" and impressive. | Adds security, compliance, failure modes, and irreversible side effects far beyond a course v1. | Keep simulation-only trading with believable market data and portfolio behavior. |
| Multi-user accounts and auth | Common default assumption for web apps. | Conflicts with the explicit single-user architecture and adds state, permissions, and onboarding complexity. | Use one persisted default profile with no login. |
| Limit orders, stop orders, and order book logic | Traders recognize these features and may ask for them immediately. | Requires pending-order lifecycle, fill simulation rules, and more complex portfolio math. | Support instant-fill market orders only. |
| Mobile-first or native mobile app | Broadens perceived reach. | Dilutes effort away from the desktop workstation experience the product is explicitly targeting. | Build a desktop-first responsive web UI that remains functional on tablet. |
| Full chat history persistence and memory systems | Makes the assistant feel more advanced. | Adds storage design and context-management complexity without improving the core learning loop enough for v1. | Keep conversation history in memory per runtime session. |
| Advanced screening, backtesting, and strategy builders | Sounds like a "complete trading platform." | Explodes scope into quant tooling rather than delivering the promised workstation core. | Focus on live watchlist, charting, portfolio insight, and AI-assisted actions. |
| Multi-broker / multiple portfolios / account separation | Seems extensible for future growth. | Breaks the single-user, single-portfolio simplification that keeps SQLite and UX simple. | Maintain one portfolio and one watchlist for v1. |

## Feature Dependencies

```text
One-command local launch
    -> Frontend artifact serving
    -> Backend API startup
    -> Database lazy initialization

Live watchlist with streaming prices
    -> Shared price cache
    -> SSE endpoint stability
    -> Watchlist persistence

Main chart for selected ticker
    -> Price history cache
    -> History endpoint
    -> Live stream updates

Manual simulated trading
    -> Current price availability
    -> Portfolio persistence
    -> Trade log writes
    -> Portfolio snapshot recording

Portfolio visibility
    -> Manual simulated trading
    -> Current price availability
    -> Snapshot integrity

AI portfolio analysis
    -> Portfolio visibility
    -> Runtime state serialization

AI-executed trade actions
    -> AI portfolio analysis
    -> Manual simulated trading

AI-managed watchlist actions
    -> Persisted watchlist management
    -> Ticker validation/normalization

Position heatmap and P&L history
    -> Portfolio visibility
    -> Portfolio snapshot recording
```

### Dependency Notes

- **AI-executed trade actions require manual simulated trading:** AI must call the same canonical execution path or behavior will diverge from manual trades.
- **Portfolio visibility requires current price availability:** holdings without live or cached prices cannot produce trustworthy value and P&L outputs.
- **Main chart requires history bootstrap plus streaming:** relying only on frontend-accumulated SSE data makes refresh and reload behavior feel broken.
- **Reliable E2E coverage sits across every table-stakes flow:** it is not a late polish item; it is how this brownfield v1 proves completeness.

## MVP Definition

### Launch With (v1)

- [ ] One-command local launch with single-port app startup
- [ ] Live streaming watchlist with default tickers and connection status
- [ ] Manual buy/sell market orders with persisted cash, positions, and trade history
- [ ] Portfolio summary, positions table, and selected-ticker chart
- [ ] AI chat assistant that can analyze current state and execute validated trade/watchlist actions
- [ ] Portfolio heatmap and P&L history visualization
- [ ] Automated E2E coverage for launch, streaming, manual trading, portfolio visuals, and AI-assisted actions

### Add After Validation (v1.x)

- [ ] Better AI explanations and trade rationale rendering once core execution is reliable
- [ ] More chart controls or richer time-window presets once the base chart flow is stable
- [ ] Optional Massive-backed real market mode polish after simulator-first UX is solid

### Future Consideration (v2+)

- [ ] Auth and multi-user separation if the product stops being single-user courseware
- [ ] Persistent chat memory if there is a real need for long-lived assistant context
- [ ] Advanced order types, screening, or backtesting only after the workstation core proves useful

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| One-command local launch | HIGH | MEDIUM | P1 |
| Live watchlist with streaming prices | HIGH | MEDIUM | P1 |
| Manual simulated trading | HIGH | MEDIUM | P1 |
| Portfolio visibility | HIGH | MEDIUM | P1 |
| AI-executed trade/watchlist actions | HIGH | HIGH | P1 |
| Main chart for selected ticker | MEDIUM | MEDIUM | P1 |
| Connection status indicator | MEDIUM | LOW | P1 |
| Reliable core-flow E2E coverage | HIGH | HIGH | P1 |
| Position heatmap and P&L history | MEDIUM | MEDIUM | P2 |
| Bloomberg-inspired visual polish | MEDIUM | MEDIUM | P2 |
| Massive-backed real-data mode polish | LOW | MEDIUM | P3 |

## Sources

- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/PROJECT.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/PROJECT.md)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.codex/get-shit-done/templates/research-project/FEATURES.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.codex/get-shit-done/templates/research-project/FEATURES.md)

---
*Feature research for: FinAlly*
*Researched: 2026-04-10*
