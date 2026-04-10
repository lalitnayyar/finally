---
phase: 01-launch-source-reproducibility
plan: 02
subsystem: infra
tags: [docker, startup-scripts, env, fastapi, tests]
requires: []
provides:
  - preflight-checked student start scripts
  - explicit backend startup env validation
  - aligned student and contributor documentation
affects: [phase-01, runtime, documentation, startup]
tech-stack:
  added: []
  patterns: [fail-fast-startup, startup-preflight, runtime-env-validation]
key-files:
  created: [scripts/test_startup_preflight.py]
  modified: [scripts/start_mac.sh, scripts/start_windows.ps1, backend/app/main.py, backend/app/llm/chat.py, README.md]
key-decisions:
  - "Required `OPENROUTER_API_KEY` at startup unless `LLM_MOCK=true`, matching the Phase 1 launch decision."
  - "Kept simulator mode as the default whenever `MASSIVE_API_KEY` is blank or absent."
patterns-established:
  - "Launch scripts validate `.env` and `OPENROUTER_API_KEY` before invoking Docker."
  - "Backend env loading happens at startup, not as an import side effect."
requirements-completed: [PLAT-01, PLAT-03, MKT-05]
duration: 55m
completed: 2026-04-10
---

# Phase 1: Launch & Source Reproducibility Summary

**The Docker-first student launch path now fails fast with non-leaky env guidance, while backend startup enforces the same runtime contract and keeps simulator mode as the market-data default**

## Performance

- **Duration:** 55m
- **Started:** 2026-04-10T18:10:00+04:00
- **Completed:** 2026-04-10T19:06:08+04:00
- **Tasks:** 2
- **Files modified:** 13

## Accomplishments
- Hardened both student start scripts to block missing `.env` and blank `OPENROUTER_API_KEY` before Docker runs.
- Moved chat configuration validation to backend startup/runtime boundaries instead of import-time dotenv mutation.
- Rewrote the docs around one primary Docker flow and one secondary contributor workflow.

## Task Commits

Each task was committed atomically:

1. **Task 1: Harden startup scripts and runtime env handling for the student launch path** - `ea2be0b` (feat)
2. **Task 2: Align student and contributor documentation around the same runtime contract** - `ea2be0b` (feat)

**Plan metadata:** `ea2be0b` (feat: harden startup and runtime configuration)

## Files Created/Modified
- `scripts/start_mac.sh` - Adds repo-root `.env` and `OPENROUTER_API_KEY` preflight validation.
- `scripts/start_windows.ps1` - Mirrors the same preflight contract for PowerShell users.
- `scripts/test_startup_preflight.py` - Verifies preflight failures happen before Docker is invoked.
- `backend/app/main.py` - Loads `.env` at startup, validates chat config, and logs simulator vs Massive runtime mode.
- `backend/app/llm/chat.py` - Removes import-time dotenv loading and enforces explicit chat env validation.
- `README.md` - Documents the Docker-first student path, secondary contributor path, and rebuild flow.

## Decisions Made
- Normal startup now requires `OPENROUTER_API_KEY`; only `LLM_MOCK=true` bypasses that for test/dev verification.
- `MASSIVE_API_KEY` remains optional and drives real-market mode only when populated.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Backend pytest verification required escalated permissions because `uv` needed to write to its cache outside the sandbox.

## User Setup Required

None - no external service configuration required beyond adding env values to the existing `.env` file.

## Next Phase Readiness

- The documented student workflow, backend startup behavior, and automated env-contract tests now agree on one runtime contract.
- Phase 01 launch verification can safely test the success path without ambiguity about missing-key behavior.

---
*Phase: 01-launch-source-reproducibility*
*Completed: 2026-04-10*
