# Roadmap: FinAlly

## Overview

FinAlly reaches v1 by turning the current brownfield backend-heavy repo into a reproducible single-command workstation with trustworthy live state, reliable trade and portfolio behavior, a dense frontend rebuilt from source, grounded AI actions, and proof through core-flow end-to-end tests.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [ ] **Phase 1: Launch & Source Reproducibility** - Restore a fresh-clone build path and dependable one-command startup.
- [ ] **Phase 2: Live Market & Watchlist Runtime** - Make streaming prices, watchlist persistence, and runtime state coherent.
- [ ] **Phase 3: Trading & Portfolio Integrity** - Make trading, valuation, and history trustworthy through one canonical execution path.
- [ ] **Phase 4: Workstation Experience & Visuals** - Deliver the dense desktop workstation UI and portfolio visuals against stable contracts.
- [ ] **Phase 5: AI Assistant Actions** - Ground chat in live state and route AI actions through the same validated backend paths.
- [ ] **Phase 6: Core-Flow Verification** - Prove the student journey with deterministic E2E coverage and final hardening.

## Phase Details

### Phase 1: Launch & Source Reproducibility
**Goal**: Students can start a source-backed FinAlly workstation locally with one reliable command and sensible simulator-first defaults.
**Depends on**: Nothing (first phase)
**Requirements**: PLAT-01, PLAT-02, PLAT-03, PLAT-04, MKT-05
**Success Criteria** (what must be TRUE):
  1. Student can start the full app with one documented command or provided script from a fresh local checkout.
  2. The app serves the frontend and API from one local origin in the intended single-container runtime.
  3. The workstation launches successfully with simulator defaults when optional external API keys are not present.
  4. The frontend served by the app can be rebuilt from source in this repository and reopened as the same local workstation.
**Plans**: TBD

### Phase 2: Live Market & Watchlist Runtime
**Goal**: Users can rely on live market streaming and persisted watchlist behavior as the workstation's shared runtime foundation.
**Depends on**: Phase 1
**Requirements**: MKT-01, MKT-02, MKT-03, MKT-04, WL-01, WL-02, WL-03, WL-04
**Success Criteria** (what must be TRUE):
  1. User can launch the workstation and immediately see a default watchlist populated with live-updating ticker prices.
  2. User can see current price, last-price direction, timestamp, and explicit connection state for streamed tickers.
  3. User can add and remove valid tickers manually and see those watchlist changes persist across refresh and app restart.
  4. User can reload the workstation and retrieve recent ticker price history needed to bootstrap charts after refresh.
**Plans**: TBD
**UI hint**: yes

### Phase 3: Trading & Portfolio Integrity
**Goal**: Users can trade confidently because execution, valuation, and portfolio history stay correct through refreshes and restarts.
**Depends on**: Phase 2
**Requirements**: TRD-01, TRD-02, TRD-03, TRD-04, TRD-05, PORT-01, PORT-02, PORT-03, PORT-04, PORT-05
**Success Criteria** (what must be TRUE):
  1. User can buy and sell shares with market orders at the current available price.
  2. Invalid orders are rejected clearly without corrupting cash, holdings, or trade history.
  3. After each trade, user sees cash balance, position quantities, average cost, current value, and unrealized P&L update consistently.
  4. Portfolio history shows one authoritative post-trade result per trade event and remains correct after refresh or app restart.
**Plans**: TBD

### Phase 4: Workstation Experience & Visuals
**Goal**: Users can navigate a dense desktop trading workstation that makes market and portfolio state visually legible at a glance.
**Depends on**: Phase 3
**Requirements**: UI-01, UI-02, UI-03, UI-04, UI-05
**Success Criteria** (what must be TRUE):
  1. User can work inside a desktop-first, terminal-style workstation layout that feels consistent with the product vision.
  2. User can click a ticker and view a larger chart for the selected symbol while still seeing compact trend visuals in the watchlist.
  3. User can see visible uptick and downtick cues on price updates throughout the workstation.
  4. User can view a portfolio heatmap sized by position weight and colored by P&L.
**Plans**: TBD
**UI hint**: yes

### Phase 5: AI Assistant Actions
**Goal**: Users can use chat for grounded analysis and reliable trade or watchlist actions that stay aligned with visible runtime state.
**Depends on**: Phase 4
**Requirements**: WL-05, AI-01, AI-02, AI-03, AI-04, AI-05, AI-06
**Success Criteria** (what must be TRUE):
  1. User can send a chat message and receive analysis grounded in the current portfolio and watchlist state.
  2. User can ask the assistant to execute validated buy or sell actions and see the same resulting state as manual trading flows.
  3. User can ask the assistant to add or remove watchlist tickers and see those changes stay consistent with the active runtime price source.
  4. Chat responses clearly report executed actions and outcomes, and failures return an explicit signal that clients can distinguish from success.
**Plans**: TBD
**UI hint**: yes

### Phase 6: Core-Flow Verification
**Goal**: Students and maintainers can trust FinAlly v1 because the promised workstation flows are proven automatically end to end.
**Depends on**: Phase 5
**Requirements**: VER-01, VER-02, VER-03, VER-04, VER-05, VER-06
**Success Criteria** (what must be TRUE):
  1. Automated E2E tests verify first launch and successful workstation availability.
  2. Automated E2E tests verify live streaming behavior, including reconnect-visible price updates where applicable.
  3. Automated E2E tests verify manual buy and sell flows with persisted portfolio outcomes across refresh or restart.
  4. Automated E2E tests verify the required portfolio visuals and AI-assisted trade and watchlist flows.
**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Launch & Source Reproducibility | 0/TBD | Not started | - |
| 2. Live Market & Watchlist Runtime | 0/TBD | Not started | - |
| 3. Trading & Portfolio Integrity | 0/TBD | Not started | - |
| 4. Workstation Experience & Visuals | 0/TBD | Not started | - |
| 5. AI Assistant Actions | 0/TBD | Not started | - |
| 6. Core-Flow Verification | 0/TBD | Not started | - |
