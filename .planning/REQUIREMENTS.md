# Requirements: FinAlly

**Defined:** 2026-04-10
**Core Value:** Students should be able to start one app locally and immediately experience a convincing end-to-end AI trading workstation where live market data, trading, portfolio visibility, and AI-assisted actions all work together.

## v1 Requirements

### Platform

- [ ] **PLAT-01**: Student can start the full app with one documented command or provided platform script
- [ ] **PLAT-02**: App launches on a single local origin and serves both API and frontend from the same containerized runtime
- [ ] **PLAT-03**: App starts successfully with simulator defaults when optional external API keys are absent
- [ ] **PLAT-04**: Frontend served by the app is reproducible from source in this repository

### Market Data

- [ ] **MKT-01**: User can see a live-updating watchlist of default tickers after first launch
- [ ] **MKT-02**: User can see current price, previous price direction, and timestamp data for streamed tickers
- [ ] **MKT-03**: User can retrieve recent price history for a ticker to bootstrap charts after refresh
- [ ] **MKT-04**: User can see connection state for live market streaming
- [ ] **MKT-05**: App can use simulator data by default and switch to Massive-backed real market data when configured

### Watchlist

- [ ] **WL-01**: User can view the persisted watchlist with latest available prices
- [ ] **WL-02**: User can add a valid ticker to the watchlist manually
- [ ] **WL-03**: User can remove a ticker from the watchlist manually
- [ ] **WL-04**: Watchlist changes persist across browser refresh and app restart
- [ ] **WL-05**: Watchlist changes made through AI chat stay consistent with the active runtime price source

### Trading

- [ ] **TRD-01**: User can buy shares with a market order at the current available price
- [ ] **TRD-02**: User can sell shares with a market order at the current available price
- [ ] **TRD-03**: Trade execution updates cash balance, position quantity, average cost, and trade history consistently
- [ ] **TRD-04**: Trade execution rejects invalid orders such as unsupported side, non-positive quantity, insufficient cash, or overselling holdings
- [ ] **TRD-05**: Manual trades and AI-executed trades use the same canonical backend execution path

### Portfolio

- [ ] **PORT-01**: User can view current cash balance, total portfolio value, and unrealized P&L
- [ ] **PORT-02**: User can view a positions table with ticker, quantity, average cost, current price, unrealized P&L, and percent change
- [ ] **PORT-03**: User can view portfolio value history over time from persisted snapshots
- [ ] **PORT-04**: Portfolio history records one authoritative post-trade result per trade event
- [ ] **PORT-05**: Portfolio state remains correct after refresh and app restart

### Workstation UI

- [ ] **UI-01**: User can click a ticker and view a larger chart for the selected symbol
- [ ] **UI-02**: User can see sparkline or compact price-trend visuals for watchlist tickers
- [ ] **UI-03**: User can view a portfolio heatmap sized by position weight and colored by P&L
- [ ] **UI-04**: Workstation uses a desktop-first, dense terminal-style layout consistent with the product vision
- [ ] **UI-05**: Price updates visibly indicate upticks and downticks

### AI Assistant

- [ ] **AI-01**: User can send a chat message to an assistant grounded in current portfolio and watchlist state
- [ ] **AI-02**: Assistant can return useful analysis of holdings, cash, and watchlist context
- [ ] **AI-03**: Assistant can execute validated buy or sell actions on the user’s behalf
- [ ] **AI-04**: Assistant can add or remove watchlist tickers on the user’s behalf
- [ ] **AI-05**: Chat responses clearly report what actions were executed and their outcome
- [ ] **AI-06**: Chat failures return an explicit error signal that clients can distinguish from success

### Verification

- [ ] **VER-01**: Automated E2E tests verify first launch and workstation availability
- [ ] **VER-02**: Automated E2E tests verify live streaming or reconnect-visible price updates
- [ ] **VER-03**: Automated E2E tests verify manual buy and sell flows with persisted portfolio outcomes
- [ ] **VER-04**: Automated E2E tests verify core portfolio visuals needed for v1
- [ ] **VER-05**: Automated E2E tests verify AI-assisted trade and watchlist flows
- [ ] **VER-06**: Automated E2E tests verify key state survives refresh or restart where applicable

## v2 Requirements

### AI Enhancements

- **AIX-01**: Assistant retains durable conversation history across app restarts
- **AIX-02**: Assistant explains trade rationale with richer strategy-style output

### Market And Trading

- **TRDX-01**: User can place advanced order types such as limit or stop orders
- **TRDX-02**: User can access screening, backtesting, or strategy tooling
- **TRDX-03**: Real-market mode includes richer production-grade resilience and observability

### Product Expansion

- **PROD-01**: User can authenticate and access separate personal accounts
- **PROD-02**: User can manage multiple portfolios or account contexts
- **PROD-03**: User can use a dedicated mobile application experience

## Out of Scope

| Feature | Reason |
|---------|--------|
| Real-money brokerage integration | Conflicts with simulator-first course scope and adds compliance/security burden |
| Multi-user auth for v1 | Explicitly excluded to preserve single-user architecture and fast onboarding |
| Mobile apps | Desktop-first workstation is the intended experience for this version |
| Limit orders and options trading | Adds major domain complexity beyond the v1 market-order simulator goal |
| Production-grade compliance features | Not required for the course capstone version |
| Persistent chat memory in v1 | Not necessary to deliver the core workstation experience |
| Screening/backtesting/strategy tooling | Dilutes effort away from the defined workstation core |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PLAT-01 | Phase 1 | Pending |
| PLAT-02 | Phase 1 | Pending |
| PLAT-03 | Phase 1 | Pending |
| PLAT-04 | Phase 1 | Pending |
| MKT-01 | Phase 2 | Pending |
| MKT-02 | Phase 2 | Pending |
| MKT-03 | Phase 2 | Pending |
| MKT-04 | Phase 2 | Pending |
| MKT-05 | Phase 1 | Pending |
| WL-01 | Phase 2 | Pending |
| WL-02 | Phase 2 | Pending |
| WL-03 | Phase 2 | Pending |
| WL-04 | Phase 2 | Pending |
| WL-05 | Phase 5 | Pending |
| TRD-01 | Phase 3 | Pending |
| TRD-02 | Phase 3 | Pending |
| TRD-03 | Phase 3 | Pending |
| TRD-04 | Phase 3 | Pending |
| TRD-05 | Phase 3 | Pending |
| PORT-01 | Phase 3 | Pending |
| PORT-02 | Phase 3 | Pending |
| PORT-03 | Phase 3 | Pending |
| PORT-04 | Phase 3 | Pending |
| PORT-05 | Phase 3 | Pending |
| UI-01 | Phase 4 | Pending |
| UI-02 | Phase 4 | Pending |
| UI-03 | Phase 4 | Pending |
| UI-04 | Phase 4 | Pending |
| UI-05 | Phase 4 | Pending |
| AI-01 | Phase 5 | Pending |
| AI-02 | Phase 5 | Pending |
| AI-03 | Phase 5 | Pending |
| AI-04 | Phase 5 | Pending |
| AI-05 | Phase 5 | Pending |
| AI-06 | Phase 5 | Pending |
| VER-01 | Phase 6 | Pending |
| VER-02 | Phase 6 | Pending |
| VER-03 | Phase 6 | Pending |
| VER-04 | Phase 6 | Pending |
| VER-05 | Phase 6 | Pending |
| VER-06 | Phase 6 | Pending |

**Coverage:**
- v1 requirements: 41 total
- Mapped to phases: 41
- Unmapped: 0 ✓

---
*Requirements defined: 2026-04-10*
*Last updated: 2026-04-10 after roadmap creation*
