---
phase: 01
slug: launch-source-reproducibility
status: draft
nyquist_compliant: false
wave_0_complete: false
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
| 01-01-01 | 01 | 0 | PLAT-04 | T-01-01 | Frontend source is restored without relying on hand-edited generated assets | build/smoke | `docker build -t finally .` | ❌ W0 | ⬜ pending |
| 01-01-02 | 01 | 0 | PLAT-01 | T-01-02 | Student launch path validates `.env` without exposing secret values | smoke | `./scripts/start_mac.sh` plus launch smoke | ❌ W0 | ⬜ pending |
| 01-02-01 | 02 | 1 | PLAT-02 | T-01-03 | UI and API are served from the same containerized origin | e2e | `cd test && npx playwright test specs/launch.spec.ts` | ❌ W0 | ⬜ pending |
| 01-02-02 | 02 | 1 | PLAT-03 | T-01-04 | App boots successfully with simulator defaults when `MASSIVE_API_KEY` is absent | integration | `cd backend && uv run pytest tests/market/test_factory.py -q` | ✅ | ⬜ pending |
| 01-03-01 | 03 | 1 | MKT-05 | T-01-05 | Market source selection stays env-driven: simulator by default, Massive when configured | integration | `cd backend && uv run pytest tests/market/test_factory.py -q` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `test/specs/launch.spec.ts` — smoke test for the documented launch path, same-origin UI/API availability, and first-load workstation reachability
- [ ] `test/specs/reproducibility.spec.ts` or equivalent build smoke coverage — proves restored `frontend/` builds into the runtime path
- [ ] Script-level validation coverage for missing `.env` / missing `OPENROUTER_API_KEY` guidance
- [ ] Playwright package/image version alignment review in `test/package.json` and `test/docker-compose.test.yml`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Contributor local-dev workflow remains documented and usable beside the Docker-first student path | PLAT-01 | The phase may choose documentation and command layout that automated tests do not fully exercise | Follow the contributor workflow from the updated docs, start backend and frontend locally, and verify the documented commands match the repo layout |
| Chat-key requirement is explained clearly to students during first-run setup | PLAT-01 | Error-message quality and onboarding clarity are hard to judge from a pass/fail harness alone | Start from a fresh checkout with no `.env` or missing `OPENROUTER_API_KEY` and verify the remediation message is explicit and actionable |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
