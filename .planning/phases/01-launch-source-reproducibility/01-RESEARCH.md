# Phase 01: Launch & Source Reproducibility - Research

**Researched:** 2026-04-10
**Domain:** Source-backed frontend restoration, static-export packaging, Docker-first launch reproducibility
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
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

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAT-01 | Student can start the full app with one documented command or provided platform script | Use one authoritative Docker-first script with explicit `.env` preflight, image build, run, and success/health verification. [VERIFIED: repo files] |
| PLAT-02 | App launches on a single local origin and serves both API and frontend from the same containerized runtime | Keep FastAPI as the only runtime entrypoint and continue serving generated static assets from the backend container. [VERIFIED: repo files] |
| PLAT-03 | App starts successfully with simulator defaults when optional external API keys are absent | Preserve `MASSIVE_API_KEY`-driven source selection and validate startup without `MASSIVE_API_KEY`. [VERIFIED: repo files] |
| PLAT-04 | Frontend served by the app is reproducible from source in this repository | Restore `frontend/`, build to Next static export `out/`, and copy that output into the runtime image and `backend/static/`-compatible serve path. [VERIFIED: repo files] [CITED: https://nextjs.org/docs/app/guides/static-exports] |
| MKT-05 | App can use simulator data by default and switch to Massive-backed real market data when configured | Keep the current factory-based source selection and add startup-path verification for both env modes. [VERIFIED: repo files] |
</phase_requirements>

## Summary

Phase 1 is not a library-upgrade phase; it is a contract-restoration phase. The repo already has the intended runtime shape: FastAPI owns startup, mounts API routes, and serves a static frontend from the same process, while Docker scripts provide the student-facing entrypoint. The break is that the authoritative frontend source tree is missing, so the documented Docker build cannot be reproduced from a fresh checkout even though a generated `backend/static/` artifact exists. [VERIFIED: repo files]

The planning implication is that Phase 1 must treat `frontend/` restoration, static-export wiring, and startup-script/doc alignment as one integrated deliverable, not three separate cleanups. The app should still launch through one Docker-first command for students, but contributors also need a secondary local workflow that does not redefine production architecture. The safest path is: restored `frontend/` source -> `next build` static export -> copied into FastAPI runtime image -> served at `/` by the backend. [VERIFIED: repo files] [CITED: https://nextjs.org/docs/app/guides/static-exports]

Validation for this phase should prove reproducibility, not just runtime health. Existing backend tests already cover simulator/Massive source selection and several API behaviors, but there is no automated proof that a fresh clone can rebuild the frontend from source and launch the workstation through the documented student path. That gap should be treated as Wave 0 validation work for the phase. [VERIFIED: repo files]

**Primary recommendation:** Plan Phase 1 around restoring a minimal but source-authoritative Next static-export app, then align `Dockerfile`, start scripts, `.env` handling, and E2E smoke coverage around that single-container build path. [VERIFIED: repo files] [CITED: https://nextjs.org/docs/app/guides/static-exports]

## Project Constraints (from CLAUDE.md)

- All project documentation is in `planning`. [VERIFIED: repo files]
- `planning/PLAN.md` is the key product contract and should be consulted when needed. [VERIFIED: repo files]
- The market data component is already completed and summarized in `planning/MARKET_DATA_SUMMARY.md`; Phase 1 should not re-open that domain beyond launch/runtime wiring. [VERIFIED: repo files]
- The remainder of the platform is still to be developed, so research should stay focused on what Phase 1 must unblock instead of exploring later-phase features. [VERIFIED: repo files]

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 15.5.3 [VERIFIED: npm search result] | Restore the missing frontend source and produce a static export in `out/`. [CITED: https://www.npmjs.com/package//next?activeTab=versions] | The product contract already specifies Next.js static export, and current docs support deploying the export on any static file server. [VERIFIED: repo files] [CITED: https://nextjs.org/docs/app/guides/static-exports] |
| React | 19.x [ASSUMED] | Runtime/UI library for the restored frontend. | Match the React major expected by the chosen Next.js version and lock it when the restored `frontend/package-lock.json` is created. [CITED: https://nextjs.org/docs/app/guides/static-exports] [ASSUMED] |
| FastAPI | 0.135.2 [VERIFIED: PyPI search result] | Single runtime entrypoint for API plus static file serving. [CITED: https://pypi.org/project/fastapi/0.123.2/] | The repo is already built around FastAPI app lifespan and route mounting; Phase 1 should preserve that architecture. [VERIFIED: repo files] |
| Docker | 28.2.2 locally available [VERIFIED: local command] | Authoritative student launch path. [VERIFIED: repo files] | The project contract requires one simple local start path and one container on one port. [VERIFIED: repo files] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Tailwind CSS | 4.1.12 [VERIFIED: npm search result] | Fast workstation-style UI scaffolding if the restored frontend keeps the README’s stated stack. [VERIFIED: repo files] [CITED: https://www.npmjs.com/package/tailwindcss?activeTab=readme] | Use only if the recreated frontend chooses to match the documented stack instead of plain CSS/modules. [ASSUMED] |
| `@playwright/test` | Keep npm package and Docker image pinned to the same release line. [CITED: https://playwright.dev/docs/docker] | Browser smoke and reproducibility checks for the documented launch path. [VERIFIED: repo files] | Use for Phase 1 smoke coverage after aligning the current mismatched versioning strategy. [VERIFIED: repo files] [CITED: https://playwright.dev/docs/docker] |
| Massive Python client | 2.4.0 [VERIFIED: PyPI search result] | Optional real-market data mode behind `MASSIVE_API_KEY`. [CITED: https://pypi.org/project/massive/] | Use only when the env key is present; simulator remains default. [VERIFIED: repo files] |
| `python-dotenv` | Keep existing backend usage but move env validation to startup. [VERIFIED: repo files] | Local developer convenience for backend-only runs. [VERIFIED: repo files] | Use in contributor workflow, not as a substitute for explicit startup validation in the student Docker path. [VERIFIED: repo files] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next static export served by FastAPI | Separate frontend dev/prod server | Conflicts with the locked single-container, single-origin architecture. [VERIFIED: repo files] |
| Rebuilding a fresh `frontend/` app | Reverse-engineering `backend/static/` | Faster short-term but violates D-01 and preserves an artifact-first workflow that caused the reproducibility break. [VERIFIED: repo files] |
| Docker-first student workflow | Local `uvicorn` + `next dev` as primary | Good for contributors, but wrong as the authoritative course-student path. [VERIFIED: repo files] |

**Installation:**
```bash
npm install next react react-dom typescript
```

**Version verification:** Official package pages show Next.js `15.5.3` and Tailwind CSS `4.1.12` at crawl time, while PyPI shows FastAPI `0.135.2` and Massive `2.4.0`. React should be locked to the React major supported by the chosen Next.js release when `frontend/package-lock.json` is created. Phase 1 itself should avoid opportunistic backend dependency upgrades unless they are required to restore reproducibility. [CITED: https://www.npmjs.com/package//next?activeTab=versions] [CITED: https://www.npmjs.com/package/tailwindcss?activeTab=readme] [CITED: https://pypi.org/project/fastapi/0.123.2/] [CITED: https://pypi.org/project/massive/] [ASSUMED]

## Architecture Patterns

### Recommended Project Structure
```text
frontend/                     # Restored Next.js source; authoritative editable UI source
backend/
├── app/                      # FastAPI runtime
└── static/                   # Generated export for local/backend-served runs, never hand-edited
scripts/
├── start_mac.sh              # Authoritative student Docker entrypoint
└── start_windows.ps1         # Authoritative student Docker entrypoint
test/
└── specs/                    # Phase smoke tests plus existing browser tests
```

### Pattern 1: Source-Authoritative Static Export
**What:** `frontend/` is the only editable frontend source, and `backend/static/` becomes a generated deployment artifact. [VERIFIED: repo files]
**When to use:** Always for this phase; it directly implements D-01 and D-02. [VERIFIED: repo files]
**Example:**
```ts
// Source: https://nextjs.org/docs/app/guides/static-exports
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
};

export default nextConfig;
```
[CITED: https://nextjs.org/docs/app/guides/static-exports]

### Pattern 2: Docker-First Student Workflow, Separate Contributor Workflow
**What:** One documented Docker command/script remains the authoritative student flow, while contributor mode may run backend and frontend separately. [VERIFIED: repo files]
**When to use:** Student onboarding and README quickstart use Docker; local source iteration uses backend reload plus frontend dev tooling. [VERIFIED: repo files]
**Example:**
```bash
# Student path
./scripts/start_mac.sh

# Contributor path
cd backend && uv run uvicorn app.main:app --reload --port 8000
cd frontend && npm run dev
```
[VERIFIED: repo files]

### Pattern 3: Explicit Startup Validation Before Container Run
**What:** Validate `.env` presence and required variables before `docker run`, instead of letting container startup fail opaquely. [VERIFIED: repo files]
**When to use:** In both macOS/Linux and Windows entry scripts. [VERIFIED: repo files]
**Example:**
```bash
# Source: Docker CLI env-file behavior + repo scripts
test -f "$PROJECT_DIR/.env" || {
  echo ".env is required. Copy .env.example and set OPENROUTER_API_KEY."
  exit 1
}
docker run --env-file "$PROJECT_DIR/.env" ...
```
[VERIFIED: repo files] [CITED: https://docs.docker.com/reference/cli/docker/container/run]

### Anti-Patterns to Avoid
- **Treating `backend/static/` as source:** This keeps the repo unrebuildable and makes code review of the frontend impossible. [VERIFIED: repo files]
- **Making local contributor mode the canonical path:** That would drift from the locked Docker-first student experience. [VERIFIED: repo files]
- **Restoring frontend features that require a Node server at runtime:** Next static export does not support server-only features such as cookies, redirects, rewrites, or default image optimization. [CITED: https://nextjs.org/docs/app/guides/static-exports]
- **Leaving Playwright package/image versions loosely coupled:** Playwright docs recommend pinning the Docker image and matching the project version, otherwise browser executables may not be found. [CITED: https://playwright.dev/docs/docker]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Frontend deployment format | Custom SPA asset copier or ad-hoc HTML bundle stitching | Next.js static export (`output: 'export'`) [CITED: https://nextjs.org/docs/app/guides/static-exports] | The framework already emits `out/` for static hosting and documents its unsupported feature set clearly. [CITED: https://nextjs.org/docs/app/guides/static-exports] |
| Student startup env loading | Custom shell env parser | `docker run --env-file` plus explicit file/required-key preflight [CITED: https://docs.docker.com/reference/cli/docker/container/run] | Docker already supports env files; the missing piece is user-friendly validation, not a new parser. [VERIFIED: repo files] |
| Browser validation harness | Bespoke curl-only smoke script | Playwright smoke tests plus Docker Compose harness [VERIFIED: repo files] | This phase needs proof that the workstation UI is actually reachable and rendered, not just that `/api/health` returns 200. [VERIFIED: repo files] |
| Market-source mode switching | Separate codepaths for simulator vs Massive runtime | Keep the existing factory + interface pattern [VERIFIED: repo files] | The backend already cleanly selects the source from `MASSIVE_API_KEY`; Phase 1 should verify that path, not redesign it. [VERIFIED: repo files] |

**Key insight:** The missing reproducibility is not caused by insufficient custom infrastructure; it is caused by the source-of-truth boundary being broken. Fix the boundary first. [VERIFIED: repo files]

## Common Pitfalls

### Pitfall 1: Restoring a frontend that cannot statically export
**What goes wrong:** The recreated app accidentally uses runtime-only Next features, so Docker builds succeed only in dev mode or fail during static export. [CITED: https://nextjs.org/docs/app/guides/static-exports]
**Why it happens:** Static export does not support several server-only features, and `next export` itself was removed in favor of `"output": "export"` starting in Next 14. [CITED: https://nextjs.org/docs/app/guides/static-exports]
**How to avoid:** Constrain the restored frontend to static-export-compatible routes/components from the start and add a build smoke test in Phase 1. [CITED: https://nextjs.org/docs/app/guides/static-exports]
**Warning signs:** Build errors referencing unsupported dynamic behavior, rewrites, cookies, or image optimization. [CITED: https://nextjs.org/docs/app/guides/static-exports]

### Pitfall 2: Docker scripts fail unclearly on a fresh checkout
**What goes wrong:** The student follows the documented script path but gets a Docker failure because `.env` is missing or the required chat key is unset. [VERIFIED: repo files]
**Why it happens:** The current scripts pass `--env-file "$PROJECT_DIR/.env"` directly and do no preflight validation. [VERIFIED: repo files]
**How to avoid:** Validate `.env` existence, validate `OPENROUTER_API_KEY` for the primary path, and print a single remediation message before build/run. [VERIFIED: repo files]
**Warning signs:** Docker exits before startup or the app launches without usable chat while docs promise a working assistant. [VERIFIED: repo files]

### Pitfall 3: Local contributor workflow drifts from production packaging
**What goes wrong:** Contributors can iterate in local dev mode, but the Docker runtime serves different assets or uses different env behavior than the source workflow. [VERIFIED: repo files]
**Why it happens:** The repo currently has a generated `backend/static/` artifact but no source tree, so production and development have already diverged once. [VERIFIED: repo files]
**How to avoid:** Make Docker build from `frontend/`, and make contributor docs explicitly describe how dev mode maps back to the static-export runtime. [VERIFIED: repo files] [CITED: https://nextjs.org/docs/app/guides/static-exports]
**Warning signs:** UI works in `next dev` but not after `next build`, or `backend/static/` stops matching the current frontend code. [VERIFIED: repo files]

### Pitfall 4: Playwright container drift hides launch failures
**What goes wrong:** Tests fail for browser/image reasons unrelated to the app, or pass locally while CI/container runs behave differently. [VERIFIED: repo files]
**Why it happens:** Current test config pins `@playwright/test` at `^1.40.0` and uses `mcr.microsoft.com/playwright:v1.40.0-jammy`; current docs recommend pinning the Docker image and keeping image/test versions aligned. [VERIFIED: repo files] [CITED: https://playwright.dev/docs/docker]
**How to avoid:** Upgrade later if needed, but in Phase 1 at minimum unify package and image pins and keep them intentional. [CITED: https://playwright.dev/docs/docker]
**Warning signs:** “browser executable not found” or container-specific launch failures after dependency updates. [CITED: https://playwright.dev/docs/docker]

## Code Examples

Verified patterns from official sources:

### Next Static Export Config
```ts
// Source: https://nextjs.org/docs/app/guides/static-exports
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
```
[CITED: https://nextjs.org/docs/app/guides/static-exports]

### Docker Env File Usage
```bash
# Source: https://docs.docker.com/reference/cli/docker/container/run
docker run --env-file ./.env my-image
```
[CITED: https://docs.docker.com/reference/cli/docker/container/run]

### Playwright Docker Version Alignment
```yaml
# Source: https://playwright.dev/docs/docker
image: mcr.microsoft.com/playwright:v1.58.2-noble
command: npx playwright test
```
[CITED: https://playwright.dev/docs/docker]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next export` CLI | `output: 'export'` in Next config | Next 14 removed `next export`. [CITED: https://nextjs.org/docs/app/guides/static-exports] | Phase 1 should restore the frontend using modern static-export configuration, not deprecated commands. [CITED: https://nextjs.org/docs/app/guides/static-exports] |
| Loosely matched Playwright image/package versions | Explicitly pin image version and keep project/tests aligned | Current Playwright Docker docs. [CITED: https://playwright.dev/docs/docker] | The test harness should be treated as part of reproducibility, not a floating dev-only helper. [CITED: https://playwright.dev/docs/docker] |

**Deprecated/outdated:**
- `next export`: removed in favor of `"output": "export"`. [CITED: https://nextjs.org/docs/app/guides/static-exports]
- Treating generated `backend/static/` as the frontend’s only source: outdated for this repo because it breaks fresh-clone rebuildability. [VERIFIED: repo files]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Tailwind CSS should remain part of the restored frontend stack because the current README documents it. [ASSUMED] | Standard Stack | Low; styling tool can be swapped without affecting the core launch architecture. |
| A2 | Keeping `backend/static/` available in the repo will still be useful for contributor/backend-served local runs after the source app is restored. [ASSUMED] | Architecture Patterns | Medium; if the team prefers fully generated artifacts only, local workflow tasks will differ. |
| A3 | React 19.x is the correct React major for the restored Next.js stack, and the exact pin should be resolved when `frontend/package-lock.json` is created. [ASSUMED] | Standard Stack | Low; the exact React pin is implementation detail as long as it matches the chosen Next.js release. |

## Open Questions (RESOLVED)

1. **Should generated `backend/static/` remain committed after `frontend/` is restored?**
   - Decision: Yes. Keep generated `backend/static/` committed in git for convenience and backend-served local/runtime flows, but treat it strictly as generated output from `frontend/`, never editable source.
   - Planning implication: Phase 1 plans should preserve `backend/static/` in the repo, add or retain deterministic sync/regeneration steps, and avoid any wording that implies artifact-only source ownership.

2. **How much UI fidelity is required in Phase 1 versus later UI phases?**
   - Decision: Phase 1 should match the currently shipped UI more closely while restoring source-backed reproducibility, but should not absorb the dense workstation polish and visual upgrades reserved for Phase 4.
   - Planning implication: Frontend restoration should target a faithful recreation of the current served UI shape and landmarks so launch/reproducibility verification is meaningful, while leaving major visual enhancement work to the later workstation-visuals phase.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Student launch path, image build | ✓ [VERIFIED: local command] | 28.2.2 [VERIFIED: local command] | — |
| Docker Compose | E2E harness | ✓ [VERIFIED: local command] | 2.37.1 [VERIFIED: local command] | Manual `docker build` + `docker run` for ad-hoc smoke checks. [VERIFIED: repo files] |
| Node.js | Restored frontend build, Playwright | ✓ [VERIFIED: local command] | 20.20.1 [VERIFIED: local command] | None for frontend work. |
| npm | Frontend and Playwright package install | ✓ [VERIFIED: local command] | 10.8.2 [VERIFIED: local command] | None for frontend work. |
| `uv` | Backend dev/test workflow | ✓ [VERIFIED: local command] | 0.11.3 [VERIFIED: local command] | Docker-only operation if contributor workflow is skipped temporarily. [VERIFIED: repo files] |
| Python 3 | Backend local workflow | ✓ [VERIFIED: local command] | 3.12.3 [VERIFIED: local command] | Docker-only operation if contributor workflow is skipped temporarily. [VERIFIED: repo files] |

**Missing dependencies with no fallback:**
- `frontend/` source tree is missing from the repository, and Phase 1 cannot satisfy PLAT-04 without restoring it. [VERIFIED: repo files]

**Missing dependencies with fallback:**
- None at the machine/tooling level; the blocking gap is repository state, not host tooling. [VERIFIED: local command] [VERIFIED: repo files]

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Pytest for backend behavior and Playwright for browser/runtime behavior. [VERIFIED: repo files] |
| Config file | `backend/pyproject.toml`, [test/playwright.config.ts](/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/test/playwright.config.ts) [VERIFIED: repo files] |
| Quick run command | `cd backend && uv run pytest tests/market/test_factory.py tests/test_routes.py -q` [VERIFIED: repo files] |
| Full suite command | `cd test && docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from playwright` [VERIFIED: repo files] |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAT-01 | One documented fresh-checkout launch path works | smoke/e2e | `./scripts/start_mac.sh` followed by Playwright smoke or scripted health/UI check [VERIFIED: repo files] | ❌ Wave 0 |
| PLAT-02 | Single origin serves both UI and API from one container | e2e | `cd test && npx playwright test specs/launch.spec.ts` [ASSUMED] | ❌ Wave 0 |
| PLAT-03 | Startup succeeds without `MASSIVE_API_KEY` | integration | `cd backend && uv run pytest tests/market/test_factory.py -q` plus container smoke without `MASSIVE_API_KEY` [VERIFIED: repo files] | Partial; backend ✓, container smoke ❌ |
| PLAT-04 | Frontend rebuilds from source in this repo | build/smoke | `docker build -t finally .` or equivalent CI build step [VERIFIED: repo files] | ❌ Wave 0 |
| MKT-05 | Simulator default; Massive when configured | unit/integration | `cd backend && uv run pytest tests/market/test_factory.py -q` [VERIFIED: repo files] | ✅ |

### Sampling Rate
- **Per task commit:** `cd backend && uv run pytest tests/market/test_factory.py tests/test_routes.py -q` for backend-safe changes, plus a frontend build smoke when touching `frontend/` or `Dockerfile`. [VERIFIED: repo files]
- **Per wave merge:** `cd test && docker compose -f docker-compose.test.yml up --abort-on-container-exit --exit-code-from playwright` after Playwright harness alignment. [VERIFIED: repo files]
- **Phase gate:** Fresh-clone-equivalent Docker build + one-command launch + browser smoke must pass before `/gsd-verify-work`. [VERIFIED: repo files]

### Wave 0 Gaps
- [ ] `test/specs/launch.spec.ts` — verifies `/` loads from the documented launch path and API is reachable from the same origin. [ASSUMED]
- [ ] `test/specs/reproducibility.spec.ts` or equivalent build smoke — proves restored `frontend/` builds into the container/runtime. [ASSUMED]
- [ ] Script-level preflight test coverage for missing `.env` / missing `OPENROUTER_API_KEY` user guidance. [ASSUMED]
- [ ] Playwright package/image pin audit — current harness is pinned to `1.40.0`; plan should explicitly confirm whether to keep or update it while preserving version match. [VERIFIED: repo files] [CITED: https://playwright.dev/docs/docker]

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no for this phase’s locked local single-user launch scope. [VERIFIED: repo files] | N/A in Phase 1 planning. |
| V3 Session Management | no for this phase’s locked local single-user launch scope. [VERIFIED: repo files] | N/A in Phase 1 planning. |
| V4 Access Control | no for this phase’s locked local single-user launch scope. [VERIFIED: repo files] | N/A in Phase 1 planning. |
| V5 Input Validation | yes [VERIFIED: repo files] | Keep existing Pydantic/request validation and add startup env validation. [VERIFIED: repo files] |
| V6 Cryptography | no new crypto work in this phase. [VERIFIED: repo files] | Do not hand-roll secret handling; rely on env vars and existing provider SDKs. [VERIFIED: repo files] |

### Known Threat Patterns for Launch/Reproducibility Stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Secret leakage via committed `.env` or overly verbose script errors | Information Disclosure | Keep `.env.example` only in git, validate presence without echoing secret values, and prefer `--env-file` over inline shell exports. [VERIFIED: repo files] [CITED: https://docs.docker.com/reference/cli/docker/container/run] |
| Serving stale or hand-edited generated frontend assets | Tampering | Make `frontend/` authoritative, generate `backend/static/` from build output, and add build smoke coverage. [VERIFIED: repo files] |
| Dependency/test harness drift causing false confidence | Tampering/Repudiation | Pin Playwright image versions and keep browser/runtime validation in CI or repeatable local commands. [CITED: https://playwright.dev/docs/docker] |

## Sources

### Primary (HIGH confidence)
- Repo inspection via `Dockerfile`, `README.md`, `backend/app/main.py`, `scripts/start_mac.sh`, `scripts/start_windows.ps1`, `test/` configs, `.planning/*`, and `planning/PLAN.md` - current runtime shape, missing `frontend/`, tests, and locked phase constraints. [VERIFIED: repo files]
- Next.js static exports docs - static export configuration, unsupported features, and version history for `output: 'export'`. <https://nextjs.org/docs/app/guides/static-exports>
- Playwright Docker docs - image pinning, version alignment, and container guidance. <https://playwright.dev/docs/docker>
- Playwright installation docs - current supported Node lines and update workflow. <https://playwright.dev/docs/intro>
- Docker CLI docs for `docker run --env-file`. <https://docs.docker.com/reference/cli/docker/container/run>

### Secondary (MEDIUM confidence)
- npm package page/search result for Next.js `15.5.3`. <https://www.npmjs.com/package//next?activeTab=versions>
- npm package page/search result for Tailwind CSS `4.1.12`. <https://www.npmjs.com/package/tailwindcss?activeTab=readme>
- PyPI page/search result for FastAPI `0.135.2`. <https://pypi.org/project/fastapi/0.123.2/>
- PyPI page/search result for Massive `2.4.0`. <https://pypi.org/project/massive/>

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - The core runtime stack is already fixed by the repo and product contract, and the static-export constraints are documented by official Next docs. [VERIFIED: repo files] [CITED: https://nextjs.org/docs/app/guides/static-exports]
- Architecture: HIGH - The current bootstrap/container/script behavior is directly observable in repo code. [VERIFIED: repo files]
- Pitfalls: HIGH - The main risks are already visible in the repo mismatch between missing `frontend/`, current scripts, and current test harness. [VERIFIED: repo files]

**Research date:** 2026-04-10
**Valid until:** 2026-05-10
