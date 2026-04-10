---
phase: 01
slug: launch-source-reproducibility
status: ready
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-10
---

# Phase 01 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Pytest for backend/runtime behavior and Playwright for browser/runtime behavior |
| **Config file** | `backend/pyproject.toml`, `test/playwright.config.ts` |
| **Quick run command** | `cd backend && uv run pytest tests/market/test_factory.py tests/test_routes.py -q` |
| **Full suite command** | `cd test && docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from playwright` |
| **Estimated runtime** | ~120 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd backend && uv run pytest tests/market/test_factory.py tests/test_routes.py -q`
- **After every plan wave:** Run `cd test && docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from playwright`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 01-01-01 | 01 | 1 | PLAT-04 | T-01-01 | Frontend source is restored without relying on hand-edited generated assets | build/smoke | `cd frontend && npm ci --no-audit --no-fund && npm run build` | Planned in 01-01 | ⬜ pending |
| 01-01-02 | 01 | 1 | PLAT-04 | T-01-01 | Generated backend-served assets are recreated from source and Docker rebuilds them deterministically | build/smoke | `cd frontend && npm run build && npm run sync:static && cd .. && docker build -t finally-phase1-repro .` | Planned in 01-01 | ⬜ pending |
| 01-02-01 | 02 | 1 | PLAT-01 | T-01-04 | Student launch path validates `.env` and `OPENROUTER_API_KEY` without exposing secret values | smoke/integration | `cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/finally && python3 scripts/test_startup_preflight.py && cd backend && uv run pytest tests/market/test_factory.py tests/test_chat.py -q` | Planned in 01-02 | ⬜ pending |
| 01-02-02 | 02 | 1 | PLAT-01 | T-01-06 | Student and contributor docs stay aligned with the same runtime contract and exact start/stop commands | doc/grep | `cd /home/lnayyar/projects/CourseAIVibeCodeUdmey/finally && rg -n "start_mac\\.sh|start_windows\\.ps1|OPENROUTER_API_KEY|MASSIVE_API_KEY|uv run uvicorn|npm run dev" README.md backend/README.md scripts/stop_mac.sh scripts/stop_windows.ps1` | Planned in 01-02 | ⬜ pending |
| 01-03-01 | 03 | 2 | PLAT-02 | T-01-09 | UI and API are served from the same containerized origin | e2e | `cd test && npx playwright test specs/launch.spec.ts specs/reproducibility.spec.ts` | Planned in 01-03 | ⬜ pending |
| 01-03-02 | 03 | 2 | MKT-05 | T-01-10 | The launch harness runs against the rebuilt Docker runtime and preserves env-driven simulator/Massive behavior under the documented app startup path | e2e/full | `cd test && docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from playwright` | Planned in 01-03 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] `test/specs/launch.spec.ts` — planned in `01-03-01`
- [x] `test/specs/reproducibility.spec.ts` or equivalent build smoke coverage — planned in `01-03-01`
- [x] Script-level validation coverage for missing `.env` / missing `OPENROUTER_API_KEY` guidance — planned in `01-02-01` via `scripts/test_startup_preflight.py`
- [x] Playwright package/image version alignment review in `test/package.json` and `test/docker-compose.test.yml` — planned in `01-03-02`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Contributor local-dev workflow remains documented and usable beside the Docker-first student path | PLAT-01 | The phase may choose documentation and command layout that automated tests do not fully exercise | Follow the contributor workflow from the updated docs, start backend and frontend locally, and verify the documented commands match the repo layout |
| Chat-key requirement is explained clearly to students during first-run setup | PLAT-01 | Error-message quality and onboarding clarity are hard to judge from a pass/fail harness alone | Start from a fresh checkout with no `.env` or missing `OPENROUTER_API_KEY` and verify the remediation message is explicit and actionable |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-10
