---
phase: 01-launch-source-reproducibility
plan: 01
subsystem: ui
tags: [nextjs, static-export, docker, fastapi]
requires: []
provides:
  - source-controlled Next.js frontend under `frontend/`
  - reproducible static export synced into `backend/static/`
  - Docker build path that rebuilds the UI from repository source
affects: [phase-01, frontend, launch, docker]
tech-stack:
  added: [nextjs, react, typescript]
  patterns: [backend-served static export, source-authoritative frontend, generated-static-artifact]
key-files:
  created: [frontend/package.json, frontend/package-lock.json, frontend/app/page.tsx, frontend/scripts/sync-static.mjs]
  modified: [backend/static/index.html]
key-decisions:
  - "Rebuilt the frontend from the product contract and shipped behavior instead of trying to recover an old internal bundle layout."
  - "Kept `backend/static/` committed, but only as generated output from `frontend/out`."
patterns-established:
  - "Frontend source of truth lives in `frontend/`; `backend/static/` is generated."
  - "Static export must remain rebuildable through both local npm commands and the Docker image."
requirements-completed: [PLAT-04]
duration: 1h 10m
completed: 2026-04-10
---

# Phase 1: Launch & Source Reproducibility Summary

**Next.js frontend source now rebuilds the served FinAlly workstation and regenerates the committed static bundle consumed by FastAPI and Docker**

## Performance

- **Duration:** 1h 10m
- **Started:** 2026-04-10T17:55:00+04:00
- **Completed:** 2026-04-10T19:06:01+04:00
- **Tasks:** 2
- **Files modified:** 18

## Accomplishments
- Restored a source-controlled `frontend/` app with a workstation shell that matches the shipped Phase 1 UI shape.
- Added a `sync:static` flow so `backend/static/` is regenerated instead of hand-edited.
- Verified the frontend export builds successfully and is copied into the backend runtime image.

## Task Commits

Each task was committed atomically:

1. **Task 1: Restore the frontend source tree and static-export contract** - `cc2216d` (feat)
2. **Task 2: Regenerate backend static assets and keep Docker source-backed** - `cc2216d` (feat)

**Plan metadata:** `cc2216d` (feat: restore source-backed frontend export)

## Files Created/Modified
- `frontend/package.json` - Frontend dependency manifest and build scripts.
- `frontend/package-lock.json` - Locked frontend dependency graph for deterministic installs.
- `frontend/app/page.tsx` - Source-backed workstation shell for the served UI.
- `frontend/app/globals.css` - Workstation layout and visual styling.
- `frontend/scripts/sync-static.mjs` - Clears stale output and copies `frontend/out` into `backend/static/`.
- `backend/static/index.html` - Generated export now produced from the new frontend source tree.

## Decisions Made
- Rebuilt the editable frontend from the product contract and live runtime behavior instead of reverse-engineering the previous generated bundle internals.
- Kept the repo’s committed `backend/static/` policy, but made it a generated artifact driven by `frontend/out`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- `npm install` required escalated network access to generate the new lockfile and build the frontend.

## User Setup Required

None - no external service configuration required beyond the existing `.env` contract.

## Next Phase Readiness

- The Docker image and backend runtime now rebuild the frontend from repository-contained source.
- Phase 01 runtime hardening and launch-path verification can build on a source-backed UI instead of a static artifact-only tree.

---
*Phase: 01-launch-source-reproducibility*
*Completed: 2026-04-10*
