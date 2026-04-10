# Project Research Summary

**Project:** FinAlly
**Domain:** Brownfield single-user AI trading workstation for course students
**Researched:** 2026-04-10
**Confidence:** HIGH

## Executive Summary

FinAlly should be completed as a reproducible, single-user local trading workstation, not re-scoped into a larger platform. The research is consistent on the core shape: keep the current FastAPI monolith, SQLite, SSE, LiteLLM/OpenRouter, and single-container deployment model; restore the missing `frontend/` source as a static-exported Next.js app served by FastAPI; and treat the workstation as one coherent product with shared runtime state for prices, portfolio valuation, watchlist membership, and AI actions.

The recommended build path is sequential and opinionated. First restore source-backed frontend reproducibility and hardened one-command local startup. Then insert a thin backend service layer so manual actions and AI actions share the same mutation and read-model logic. Only after those contracts are stable should the frontend be rebuilt around dashboard hydration, SSE lifecycle handling, portfolio visuals, and chat-driven actions. This keeps the brownfield work focused on completion, not architecture churn.

The main risks are not scale or infrastructure. They are false completeness and trust failures: shipping stale generated assets instead of a rebuildable app, allowing AI mutations to diverge from visible runtime state, letting portfolio math or snapshots drift, and writing tests that prove pages render without proving the promised student flows. Mitigation is straightforward: restore the source build early, centralize domain logic in services, make runtime valuation authoritative, and make E2E tests assert persisted outcomes across refresh and restart.

## Key Findings

### Recommended Stack

The stack recommendation is conservative because the current product constraints are already correct. Keep Python 3.12, FastAPI, Uvicorn, SQLite with `aiosqlite`, SSE, LiteLLM, OpenRouter, `uv`, and the single-image Docker flow. The main stack change is not a migration; it is restoring the missing frontend source on a maintained Next.js + React + TypeScript line using static export, then pinning tested versions for reproducibility.

The stack should stay intentionally light. Avoid Postgres, Redis, WebSockets, Celery, ORM/migration overhead, and framework-heavy AI orchestration for v1. Use one charting library, keep model selection env-driven instead of hardcoded, and treat exact dependency pinning plus a healthy Docker build as roadmap items rather than cleanup.

**Core technologies:**
- Python 3.12 + FastAPI + Uvicorn: backend API, SSE, static serving, and app lifecycle with minimal churn.
- Next.js static export + React + TypeScript: restore the intended frontend architecture while preserving one origin and one container.
- SQLite + `aiosqlite`: durable single-user persistence without adding infrastructure.
- SSE with in-memory price cache: simplest correct transport for server-to-client market updates.
- LiteLLM + OpenRouter: provider abstraction for chat and structured actions without committing to one model vendor.
- `uv`, Docker, Playwright, Pytest: reproducible local setup plus backend and end-to-end verification.

### Expected Features

The product is only credible if core workstation flows work reliably from a fresh start. Table stakes are one-command local launch, a persisted live watchlist, streaming prices, manual market-order trading, portfolio visibility, a selected-ticker chart, visible connection state, and E2E coverage over those flows. If any of these are weak, the product will feel unfinished regardless of UI polish.

Differentiators should stay, but only on top of shared backend contracts. The important ones are portfolio-aware AI chat, AI-executed trade and watchlist actions, a data-dense terminal UI, and portfolio heatmap/P&L history views. The research is explicit that auth, real brokerage integration, advanced order types, persistent chat memory, screening/backtesting, and multi-portfolio scope should be deferred out of v1.

**Must have (table stakes):**
- One-command local launch with simulator-friendly defaults and single-port app startup.
- Live watchlist with streaming prices and persisted add/remove behavior.
- Manual buy/sell market orders with consistent cash, positions, trade log, and snapshots.
- Portfolio summary, positions, selected-ticker chart, and visible connection/runtime state.
- Reliable E2E coverage for launch, stream, trade, portfolio, and AI-assisted flows.

**Should have (competitive):**
- AI chat assistant grounded in current portfolio and watchlist state.
- AI-executed trade and watchlist actions through the same backend mutation path as manual actions.
- Bloomberg-inspired dense workstation UI with heatmap and P&L history visuals.
- Simulator-first data model with optional real-data swap behind one interface.

**Defer (v2+):**
- Authentication and multi-user account separation.
- Real-money brokerage integrations.
- Limit/stop orders, screening, backtesting, and strategy tooling.
- Persistent chat memory and broader multi-portfolio complexity.

### Architecture Approach

The architecture guidance is the clearest and most important roadmap input: keep the FastAPI monolith, but add an explicit application-service layer between routes and persistence/runtime systems. The major missing piece is not another service; it is disciplined boundaries so the same workstation read model and mutation paths power manual UI flows, AI flows, and portfolio history.

**Major components:**
1. Static frontend: renders the workstation, hydrates from REST, and maintains SSE-driven UI state.
2. API routers: transport-only validation and response shaping.
3. Workstation query service: one canonical read model for dashboard and chat context.
4. Portfolio service: executes manual and AI trades and enforces accounting rules.
5. Watchlist service: keeps SQLite, runtime subscriptions, and cache membership aligned.
6. Snapshot service: records one authoritative post-trade and historical valuation path.
7. LLM orchestration: builds context, validates structured outputs, and delegates actions to services.
8. Price cache and market source: hold live prices/history in memory and manage simulator or real-data feeds.

### Critical Pitfalls

1. **Shipping generated assets instead of a reproducible product**: restore or recreate `frontend/` early and require that served static assets can be regenerated from source.
2. **Fragile one-command startup**: default to simulator and mock-friendly modes, ship `.env.example`, and make missing optional keys non-fatal.
3. **AI actions diverging from runtime state**: force AI and manual mutations through the same services, normalization rules, and cache refresh paths.
4. **Portfolio math and snapshot drift**: centralize execution and snapshot ownership, then lock invariants down with backend and E2E tests.
5. **Streaming UX working only on happy-path sessions**: build explicit bootstrap, reconnect, stale-data, and connection-state handling instead of relying on SSE existence alone.

## Implications for Roadmap

Based on the combined research, the roadmap should follow dependency order rather than visual or feature excitement.

### Phase 1: Reproducible Source Build and Launch Hardening
**Rationale:** The repo cannot be treated as complete while the frontend source path is missing or stale, and first-run startup is a product requirement.
**Delivers:** Restored or recreated `frontend/`, static export integrated with FastAPI/Docker, env-driven model config, simulator-first defaults, and a fresh-clone launch path that works without optional keys.
**Addresses:** One-command local launch, frontend reproducibility, and baseline workstation hydration.
**Avoids:** Shipping a baked artifact and fragile host-dependent startup.

### Phase 2: Shared Domain Services and Canonical Contracts
**Rationale:** Backend consistency must exist before UI rebuild and richer AI behavior, or manual and AI flows will keep drifting.
**Delivers:** `services/` layer for workstation reads, trades, watchlist mutations, snapshots, and chat action application; routes become transport-only; response contracts stabilize.
**Addresses:** Persisted watchlist management, manual trading, portfolio visibility, and AI/manual state consistency.
**Uses:** FastAPI, SQLite, `aiosqlite`, in-memory market cache, LiteLLM/OpenRouter.
**Avoids:** Route-level business-logic duplication and AI actions bypassing canonical state paths.

### Phase 3: Portfolio Correctness and Snapshot Integrity
**Rationale:** Portfolio visuals and AI guidance are only trustworthy if holdings, cash, valuation, and history are correct.
**Delivers:** Single trade execution boundary, singular snapshot ownership, tested buy/partial-sell/full-sell invariants, and reliable portfolio/history endpoints.
**Addresses:** Portfolio summary, trade log integrity, P&L history, and heatmap data quality.
**Avoids:** Snapshot duplication, inconsistent average-cost math, and drift between chat and REST trades.

### Phase 4: Live Data UX and Frontend Workstation Rebuild
**Rationale:** Once contracts are stable, the frontend can be rebuilt against known APIs instead of inventing them ad hoc.
**Delivers:** Watchlist grid, selected-ticker chart, connection indicator, SSE bootstrap/reconnect handling, and a dense terminal-style layout served from static export.
**Addresses:** Live watchlist, charting, connection-state visibility, and resilient refresh/reconnect behavior.
**Uses:** Next.js static export, React, TypeScript, SWR, Tailwind if aligned with restored source, and one charting library.
**Avoids:** Frontend-defined API churn and happy-path-only streaming UX.

### Phase 5: AI Assistant and Action Execution
**Rationale:** AI becomes valuable only after the workstation state and mutation paths are trustworthy.
**Delivers:** Portfolio-aware chat context, structured AI outputs, validated trade/watchlist actions through shared services, and explicit execution feedback in the UI.
**Addresses:** AI analysis, AI-executed trades, and AI-managed watchlist actions.
**Avoids:** Chat claims that do not match visible state or persisted changes.

### Phase 6: Deterministic End-to-End Verification and Targeted Polish
**Rationale:** The product should prove the full student journey before spending heavily on surface refinement.
**Delivers:** Outcome-based Playwright coverage for launch, stream, refresh, reconnect, manual trade, AI trade/watchlist actions, persistence, and restart; then targeted visual polish where flows are already proven.
**Addresses:** Reliable core-flow E2E coverage plus final workstation credibility.
**Avoids:** Screenshot-grade polish masking flaky or incomplete behavior.

### Phase Ordering Rationale

- Reproducibility and startup come first because every later phase depends on a real source-backed app and a dependable local run path.
- Service boundaries come before UI rebuild so the new frontend targets stable contracts instead of cementing duplicated backend logic.
- Portfolio correctness precedes advanced visuals and AI execution because both depend on trustworthy valuation and history.
- Streaming UI work and AI work are split so live-state resilience is solved before natural-language mutation complexity is added.
- Verification is continuous, but a dedicated hardening phase is still warranted because the research flags shallow E2E as a major brownfield failure mode.

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 1:** Frontend restoration details may need repo-specific investigation if the original source cannot be recovered cleanly.
- **Phase 4:** Charting and SSE hydration details may need focused implementation research once the exact frontend rebuild path is chosen.
- **Phase 5:** Structured AI action and provider-behavior details may need phase-level research if model/tooling behavior proves inconsistent.

Phases with standard patterns (skip research-phase):
- **Phase 2:** Service-layer extraction inside a FastAPI monolith is a standard refactor pattern.
- **Phase 3:** Portfolio invariants and single snapshot ownership are domain decisions more than open research questions.
- **Phase 6:** Deterministic Playwright plus mock-driven outcome verification follows established testing patterns.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | Strongly grounded in current repo structure, Docker/build expectations, and official docs. |
| Features | HIGH | Clear convergence between product promise, brownfield scope, and feature dependencies. |
| Architecture | HIGH | The service-layer recommendation fits the existing code seams and directly addresses observed integration risks. |
| Pitfalls | HIGH | Risks are concrete, repo-specific, and tied to visible failure modes rather than abstract concerns. |

**Overall confidence:** HIGH

### Gaps to Address

- Frontend recovery path: confirm whether the original `frontend/` source can be restored or must be recreated against the documented product contract.
- Exact API contract audit: validate current backend endpoints against the proposed unified workstation read model before frontend rebuild begins.
- Market data adapter behavior: verify how simulator and optional real-data mode differ in history/bootstrap semantics so the UI contract stays stable.
- AI model configuration: confirm the final env-driven model/provider defaults and deterministic mock mode used for local development and E2E.

## Sources

### Primary
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/research/STACK.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/research/STACK.md)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/research/FEATURES.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/research/FEATURES.md)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/research/ARCHITECTURE.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/research/ARCHITECTURE.md)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/research/PITFALLS.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/research/PITFALLS.md)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/PROJECT.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/PROJECT.md)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md)

### Supporting
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/Dockerfile](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/Dockerfile)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/backend/pyproject.toml](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/backend/pyproject.toml)
- [/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/README.md](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/README.md)
- https://nextjs.org/docs/app/guides/static-exports
- https://fastapi.tiangolo.com/tutorial/static-files/
- https://fastapi.tiangolo.com/advanced/events/
- https://docs.astral.sh/uv/concepts/projects/
- https://docs.litellm.ai/
- https://openrouter.ai/docs/features/structured-outputs
- https://playwright.dev/docs/intro

---
*Research completed: 2026-04-10*
*Ready for roadmap: yes*
