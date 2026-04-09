# FinAlly

## What This Is

FinAlly is a single-user AI trading workstation for students in the course: a Bloomberg-inspired web app that streams market data, lets the user manage a simulated portfolio, and provides an AI chat assistant that can analyze positions and execute trade or watchlist actions. This brownfield repo already contains a working FastAPI backend, persisted portfolio/watchlist data, live market streaming, and a shipped static frontend artifact, but it still needs to be completed and tightened so the full product in `planning/PLAN.md` is actually delivered from source with reliable core-flow coverage.

## Core Value

Students should be able to start one app locally and immediately experience a convincing end-to-end AI trading workstation where live market data, trading, portfolio visibility, and AI-assisted actions all work together.

## Requirements

### Validated

- ✓ Live market prices stream through a single FastAPI app via SSE for the watchlist and chart consumers — existing
- ✓ Users can manage a persisted watchlist of tickers and enrich it with live price data — existing
- ✓ Users can buy and sell a simulated portfolio backed by SQLite with cash, positions, trades, and portfolio history — existing
- ✓ Users can chat with an LLM-backed assistant that can analyze portfolio state and issue structured trade/watchlist actions — existing
- ✓ The app is designed as a single-container, single-port local experience for course use — existing

### Active

- [ ] Deliver the complete FinAlly v1 experience described in `planning/PLAN.md`, not just partial backend functionality
- [ ] Ensure one-command startup reliably produces the intended workstation UX for students
- [ ] Close brownfield gaps that currently prevent the repo from being a complete, reproducible implementation of the intended product
- [ ] Make AI-assisted trading and watchlist execution reliable and consistent with the live runtime state
- [ ] Pass E2E coverage for the core student flows: launch, streaming data, manual trading, portfolio visuals, and AI-assisted actions

### Out of Scope

- Real-money brokerage integration — simulated trading only for v1
- Multi-user authentication or account separation — this version is intentionally single-user
- Mobile apps — desktop-first web experience is the target
- Limit orders or options trading — market-order equity simulation keeps the domain manageable
- Production-grade compliance features — not required for the course capstone version

## Context

This is a brownfield codebase centered on `backend/app/` with FastAPI serving both `/api/*` endpoints and a prebuilt static frontend from `backend/static/`. The backend already includes SQLite persistence, SSE price streaming, a simulator-plus-Massive market data abstraction, and LiteLLM/OpenRouter chat integration. The checked-in repo also includes backend unit tests and Playwright E2E tests.

The biggest implementation reality to carry forward is that the repo is not yet a cleanly reproducible "finished" product: the generated frontend artifact is present, but the source `frontend/` tree referenced by `README.md` and `Dockerfile` is missing from this checkout; chat-driven watchlist mutations are inconsistent with the active market source; trade snapshot history is duplicated for API trades; and several core risks remain around runtime state, error signaling, and end-to-end completeness.

The intended audience is students in the course. "Done" for v1 means one-command startup, live market stream, trading, portfolio visuals, AI chat that can analyze and execute trades, and passing E2E coverage for the core flows.

## Constraints

- **Audience**: Course students — setup and usage must stay approachable and local-first
- **Architecture**: Single-container, single-port app — preserve the simple startup/deployment model in `planning/PLAN.md`
- **Scope**: Brownfield completion, not greenfield reinvention — build from the existing backend/runtime and close the gaps intentionally
- **Data Model**: Single-user simulated portfolio — avoid introducing multi-user or real brokerage complexity into v1
- **Runtime**: Live market data must work with simulator by default and Massive API when configured — optional external integration, sensible local defaults
- **Verification**: Core flows require reliable automated E2E coverage — "works on my machine" is not enough for completion

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Treat this as a brownfield completion project, not a new build | The repo already contains substantial backend functionality and a shipped static frontend artifact | — Pending |
| Use `planning/PLAN.md` as the authoritative product contract for v1 scope | The user explicitly wants the full project built as described there | — Pending |
| Keep the product single-user and simulator-first | This matches the course use case and avoids unnecessary infrastructure/auth complexity | — Pending |
| Define v1 completion around end-to-end student experience and core-flow test coverage | The user's success definition is experiential, not just code presence | — Pending |
| Exclude real-money brokerage, multi-user auth, mobile apps, limit/orders options, and compliance-heavy features from v1 | These add substantial complexity without serving the capstone goal | ✓ Good |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-10 after initialization*
