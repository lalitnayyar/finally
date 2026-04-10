# Phase 1: Launch & Source Reproducibility - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Restore a reliable, source-backed launch path for FinAlly so a student can start the product from a fresh checkout with one authoritative command, while contributors still have a clean local development workflow. This phase covers source restoration, build/runtime packaging, startup behavior, and environment/default handling for launch. It does not add new trading or UI capabilities beyond what is required to make the existing product reproducible and runnable.

</domain>

<decisions>
## Implementation Decisions

### Frontend source restoration
- **D-01:** Rebuild a fresh `frontend/` source app from the product contract in `planning/PLAN.md` and the shipped runtime behavior, rather than trying to preserve or reverse-engineer the old internal frontend structure.
- **D-02:** `backend/static/` should become the generated output of the restored `frontend/` source app, not the primary editable source of truth.

### Startup workflow
- **D-03:** Docker remains the authoritative student workflow for v1. The one-command path should be the main documented way course students launch FinAlly.
- **D-04:** Phase 1 should also preserve and document a clean local contributor workflow for running backend/frontend outside Docker, but that path is secondary to the student Docker flow.

### Environment and first-run behavior
- **D-05:** A real `OPENROUTER_API_KEY` is required for chat functionality in the intended Phase 1 launch path. Do not default students into disabled-chat or mock-chat startup as the primary experience.
- **D-06:** Simulator-first market data remains the default when `MASSIVE_API_KEY` is absent; Phase 1 should preserve that low-friction default while tightening launch reliability.

### Scope and quality bar
- **D-07:** Treat this phase as brownfield completion, not a redesign of product scope. The goal is reproducible launch and source-backed delivery, not introducing new features.
- **D-08:** Phase 1 should leave the repo in a state where the served frontend can be rebuilt from source and launched through the documented path from a fresh checkout.

### the agent's Discretion
- Exact folder structure inside `frontend/`
- Exact frontend toolchain details, as long as they remain compatible with the documented product contract and static-export deployment model
- Whether local contributor docs live mainly in `README.md`, `backend/README.md`, or both

</decisions>

<specifics>
## Specific Ideas

- Use `planning/PLAN.md` as the product reference instead of treating the checked-in `backend/static/` bundle as the canonical source design.
- Keep the single-container, single-port shape intact so students still launch FinAlly the simple way.
- Reproducibility matters more than preserving the previous internal frontend organization.

</specifics>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Product and scope
- `.planning/PROJECT.md` — project framing, constraints, and locked v1 boundaries for the brownfield completion effort
- `.planning/REQUIREMENTS.md` — Phase 1 requirements (`PLAT-01` to `PLAT-04`, `MKT-05`) and overall v1 traceability
- `.planning/ROADMAP.md` — Phase 1 goal, success criteria, and execution order
- `planning/PLAN.md` — authoritative product contract for the intended FinAlly experience

### Runtime and packaging
- `Dockerfile` — expected container build flow, including the missing `frontend/` build stage and static export copy into runtime
- `backend/app/main.py` — backend startup flow and static file mount behavior at `/`
- `scripts/start_mac.sh` — primary macOS/Linux Docker-first launch wrapper and `.env` handling
- `scripts/start_windows.ps1` — primary Windows Docker-first launch wrapper and `.env` handling
- `README.md` — current documented startup and development expectations that Phase 1 must reconcile with reality

### Codebase analysis
- `.planning/codebase/ARCHITECTURE.md` — current runtime architecture and served-static-frontend constraint
- `.planning/codebase/STRUCTURE.md` — repo layout, missing `frontend/` source, and key locations for launch-related work
- `.planning/codebase/CONCERNS.md` — brownfield reproducibility concerns, especially the missing `frontend/` source path

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `Dockerfile`: already encodes the intended two-stage shape where `frontend/` builds a static export copied into the Python runtime image
- `scripts/start_mac.sh` and `scripts/start_windows.ps1`: existing Docker-first student launch wrappers that can stay as the primary entry point
- `backend/app/main.py`: already serves static assets from `backend/static/` after API route registration, which preserves the single-origin runtime model

### Established Patterns
- The backend is already the single runtime entrypoint and should remain so
- The project is simulator-first for market data and single-user by design
- Docker-based launch already assumes `.env` at the repo root and a named volume for persisted SQLite data

### Integration Points
- Restored `frontend/` source must compile down to the static assets the runtime serves from `backend/static/`
- Launch scripts, `README.md`, and `Dockerfile` must align on the same canonical startup path
- Any local contributor workflow must coexist with, but not replace, the Docker-first student flow

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 01-launch-source-reproducibility*
*Context gathered: 2026-04-10*
