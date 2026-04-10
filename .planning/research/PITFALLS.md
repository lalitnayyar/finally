# Domain Pitfalls

**Domain:** Brownfield single-user AI trading workstation for course students
**Researched:** 2026-04-10
**Confidence:** HIGH

## Critical Pitfalls

### Pitfall 1: Shipping a baked artifact instead of a reproducible product

**What goes wrong:**
The repo appears complete because `backend/static/` exists, but students cannot rebuild or meaningfully modify the workstation from source. v1 becomes a demo snapshot rather than a teachable, repeatable project.

**Why it happens:**
Brownfield repos often keep generated frontend output after the source tree drifts or disappears. Teams then keep patching the backend around the artifact instead of restoring the actual build path.

**How to avoid:**
Make source-of-truth restoration an early blocking phase. Restore or recreate `frontend/`, wire it into the Docker build, and verify that the shipped static files are generated from the checked-in source during CI or test setup.

**Warning signs:**
- `README.md` and `Dockerfile` mention `frontend/`, but the tree is missing or stale
- UI changes require editing generated files under `backend/static/`
- Local startup "works" only because prebuilt assets were committed earlier
- E2E passes against old UI assets while source changes are not reflected

**Phase to address:**
Phase 1: Reproducible source build and asset pipeline restoration

---

### Pitfall 2: One-command startup that secretly depends on fragile host setup

**What goes wrong:**
Students run the advertised command and hit missing env vars, broken volume permissions, port conflicts, browser launch assumptions, or runtime differences across macOS/Windows. The course-friendly local experience fails before product value is visible.

**Why it happens:**
Developers test on a tuned machine and underweight first-run ergonomics. Brownfield repos also accumulate hidden assumptions about Docker, `.env`, database state, and OS-specific scripts.

**How to avoid:**
Treat first launch as a product feature. Support simulator-first and mock-friendly defaults, provide committed `.env.example`, harden scripts for both supported platforms, and ensure the app degrades cleanly when optional APIs are absent.

**Warning signs:**
- Startup requires manual edits beyond copying `.env.example`
- App crashes when `OPENROUTER_API_KEY` or `MASSIVE_API_KEY` is missing
- Scripts behave differently on Windows vs macOS/Linux
- First run produces an empty screen instead of a simulator-backed experience

**Phase to address:**
Phase 2: Local runtime hardening and student onboarding path

---

### Pitfall 3: AI actions diverge from live runtime state

**What goes wrong:**
The assistant says it added a ticker or executed a trade, but the visible watchlist, portfolio, or live price context does not match. This destroys trust faster than almost any visual defect.

**Why it happens:**
LLM action tooling is often bolted onto existing endpoints without a strict contract around idempotency, normalization, refresh behavior, or shared state with the active market source.

**How to avoid:**
Force all AI actions through the same backend service layer as manual actions. Normalize tickers once, return structured action results, refresh the same caches used by the UI, and make chat execution observable with explicit success/failure payloads.

**Warning signs:**
- Manual trade flow works, but chat-triggered trades create different history or balances
- AI-added watchlist symbols do not receive live prices until restart
- Chat claims success without a corresponding persisted state change
- Ticker casing or aliases behave differently across endpoints

**Phase to address:**
Phase 3: Shared action domain and AI/manual state consistency

---

### Pitfall 4: Portfolio math and snapshot history drift from reality

**What goes wrong:**
Cash, average cost, unrealized P&L, or portfolio history become inconsistent after buys, sells, or restart. The app still looks sophisticated, but students quickly notice impossible numbers.

**Why it happens:**
Trading demos often implement order execution first and treat accounting as presentation logic. Brownfield systems also duplicate history writes in multiple code paths, creating subtle snapshot errors.

**How to avoid:**
Centralize trade execution and snapshot creation in one transaction boundary. Define exact invariants for cash, positions, and history after each order, then lock them down with backend tests and E2E assertions.

**Warning signs:**
- Portfolio value jumps unexpectedly after API trades or page refresh
- Multiple snapshots are written for one trade
- Selling a full position leaves residue quantity or bad average cost
- Chat and REST trades produce different accounting outcomes

**Phase to address:**
Phase 4: Portfolio accounting correctness and history integrity

---

### Pitfall 5: Streaming UX that only works on a warm, happy-path session

**What goes wrong:**
The watchlist appears live during development, but fresh page loads show empty charts, reconnects lose context, or price flashes/connection status are unreliable. The workstation stops feeling "terminal-like" and starts feeling broken.

**Why it happens:**
Teams over-focus on the SSE endpoint existing and under-build the client lifecycle around bootstrap history, reconnect behavior, stale data indicators, and consistent chart hydration.

**How to avoid:**
Design the frontend around a full stream lifecycle: initial history bootstrap, live stream merge, reconnect/backoff handling, explicit connection state, and stale-data rendering rules. Validate with page refresh and simulated disconnect scenarios.

**Warning signs:**
- Sparklines stay empty until enough ticks accumulate
- Main chart resets on reconnect or ticker switch
- Header shows connected while prices are stale
- SSE errors are only visible in the browser console

**Phase to address:**
Phase 5: Live data UX resilience and chart hydration

---

### Pitfall 6: Prioritizing polish before proving the end-to-end student flows

**What goes wrong:**
Time goes into terminal aesthetics, animations, and layout details while launch, trade, AI action, and persistence flows remain flaky. The app demos well in screenshots but not in a classroom.

**Why it happens:**
The product brief is visually strong, so teams naturally chase the Bloomberg-inspired finish before establishing reliable behavior across the core flows.

**How to avoid:**
Gate visual polish behind a passing core-flow matrix: launch, seeded watchlist, live updates, manual trade, portfolio visualization, AI action, and restart persistence. Only after that should design polish consume significant effort.

**Warning signs:**
- UI review feedback dominates while backend correctness bugs remain open
- Heatmap or P&L charts exist, but their data source is mocked or partial
- Demo scripts avoid restart, refresh, or AI execution paths
- E2E scope is thinner than the advertised feature set

**Phase to address:**
Phase 6: Core-flow completion before visual polish

---

### Pitfall 7: E2E coverage that validates pages, not outcomes

**What goes wrong:**
Tests confirm that screens render or buttons click, but do not prove that prices stream, trades persist, AI actions mutate state, and the workstation survives restart. v1 looks tested while still failing real student usage.

**Why it happens:**
Brownfield projects often inherit shallow UI tests because they are easier to stabilize than true end-to-end stateful flows involving SSE, SQLite, and LLM tooling.

**How to avoid:**
Write E2E tests around externally visible outcomes, not component presence. Use `LLM_MOCK=true` for deterministic AI paths, assert persisted DB-backed state through the UI/API, and include restart-sensitive checks where feasible.

**Warning signs:**
- Tests stub or bypass the hardest product paths
- No test covers chat-driven mutation
- No test checks state after container restart or page refresh
- SSE assertions are timing-fragile and routinely quarantined

**Phase to address:**
Phase 7: Deterministic end-to-end verification of student flows

## Moderate Pitfalls

### Pitfall 1: Optional external integrations behaving like required dependencies

**What goes wrong:**
Real market data or real LLM inference becomes effectively mandatory, which turns demos into API-key setup exercises and introduces avoidable failure modes.

**Prevention:**
Keep simulator mode and `LLM_MOCK` as first-class execution paths. Make the absence of optional keys explicit in the UI and logs without blocking the local workstation.

**Warning signs:**
- Empty watchlist prices when `MASSIVE_API_KEY` is unset
- Chat pane fails hard instead of switching to a mock/test mode

**Phase to address:**
Phase 2: Local runtime hardening and student onboarding path

---

### Pitfall 2: Treating single-user scope as permission to ignore boundaries

**What goes wrong:**
Because there is only one user, logic gets smeared across routes, background tasks, and chat tooling. This speeds up short-term edits but makes the final brownfield completion unstable.

**Prevention:**
Preserve clear service boundaries even in a single-user app: market data service, portfolio service, watchlist service, and AI tool orchestration should remain distinct.

**Warning signs:**
- Route handlers contain accounting logic directly
- Background tasks mutate persistence without going through domain services

**Phase to address:**
Phase 3: Shared action domain and AI/manual state consistency

## Minor Pitfalls

### Pitfall 1: Overbuilding for multi-user or production compliance too early

**What goes wrong:**
Auth, role systems, broker realism, or compliance workflows absorb roadmap time that should go to course-grade v1 completeness.

**Prevention:**
Enforce the single-user simulator-first boundary in planning and PR review. Reject work that does not improve the local workstation experience or core-flow verification.

**Warning signs:**
- New schema changes introduce unnecessary account separation
- Roadmap discussions drift toward production trading concerns

**Phase to address:**
Phase 0: Scope discipline and v1 guardrails

## Phase-Specific Warnings

| Phase Topic | Likely Pitfall | Mitigation |
|-------------|---------------|------------|
| Source restoration | Reusing stale `backend/static/` output as if it were source-backed | Require frontend source rebuild to reproduce shipped assets |
| Local startup | Hidden dependence on external keys or host quirks | Make simulator and mock modes the default happy path |
| AI action wiring | Chat tools bypass manual action services | Route both AI and manual mutations through shared domain logic |
| Portfolio engine | Duplicate snapshot writes and inconsistent trade invariants | Centralize post-trade snapshot creation and test invariants |
| Streaming UI | SSE exists but initial hydration/reconnect is weak | Build history bootstrap plus connection-state handling |
| Product completion | Visual polish masks incomplete flows | Use core-flow acceptance criteria before UI refinement |
| E2E verification | Tests assert rendering instead of persisted outcomes | Make tests prove state transitions and restart behavior |

## "Looks Done But Isn't" Checklist

- [ ] **Launch flow:** Fresh clone plus one documented startup command produces seeded data and a usable UI without optional API keys.
- [ ] **Frontend source:** The checked-in source can regenerate the static assets actually served by FastAPI.
- [ ] **Live market UX:** Watchlist prices, sparklines, detailed chart, and connection indicator all survive refresh and reconnect.
- [ ] **Manual trading:** Buy and sell operations update cash, positions, P&L, and history consistently.
- [ ] **AI actions:** Chat analysis and trade/watchlist execution mutate the same state the manual UI exposes.
- [ ] **Persistence:** Restart preserves SQLite-backed portfolio/watchlist state and reseeds only when appropriate.
- [ ] **Tests:** Automated E2E coverage exercises the exact student flows promised in the plan.

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Shipping a baked artifact instead of a reproducible product | Phase 1: Reproducible source build and asset pipeline restoration | Rebuild frontend assets from source and serve them through the app in a clean environment |
| One-command startup that secretly depends on fragile host setup | Phase 2: Local runtime hardening and student onboarding path | Fresh-machine style run with simulator defaults succeeds on supported platforms |
| AI actions diverge from live runtime state | Phase 3: Shared action domain and AI/manual state consistency | Manual and chat actions produce identical persisted outcomes for the same inputs |
| Portfolio math and snapshot history drift from reality | Phase 4: Portfolio accounting correctness and history integrity | Trade invariant tests and E2E assertions pass for buy, partial sell, full sell, and restart |
| Streaming UX that only works on a warm, happy-path session | Phase 5: Live data UX resilience and chart hydration | Refresh/reconnect scenarios keep prices, charts, and status indicators coherent |
| Prioritizing polish before proving the end-to-end student flows | Phase 6: Core-flow completion before visual polish | Acceptance matrix for launch, stream, trade, portfolio, and AI flows passes before design polish work |
| E2E coverage that validates pages, not outcomes | Phase 7: Deterministic end-to-end verification of student flows | Test suite proves persisted behavior, not just rendered elements |

## Sources

- `/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/PROJECT.md` — primary brownfield scope, existing gaps, and course constraints
- `/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md` — v1 UX contract, architecture, and local setup expectations

