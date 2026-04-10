# Technology Stack

**Project:** FinAlly
**Researched:** 2026-04-10
**Overall confidence:** HIGH
**Scope:** Brownfield single-user AI trading workstation for course students, preserving the current single-container, single-port local deployment model.

## Recommended Stack

### Core Framework

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| Python | 3.12.x | Backend runtime | Already in the repo and Dockerfile, modern enough for current FastAPI/Pydantic ecosystem, no reason to churn for v1. | HIGH |
| FastAPI | Keep current line, pin to a tested `0.12x` release | REST API, SSE endpoints, static file serving, lifespan orchestration | Fits the existing backend, supports lifespan + static mounts cleanly, and keeps API plus static frontend on one origin/port. | HIGH |
| Uvicorn | Keep current line, pin to a tested `0.3x` release | ASGI server | Standard runtime for FastAPI and already wired into the container. | HIGH |
| Next.js | Restore frontend source on current maintained major, using static export (`output: 'export'`) | Frontend application shell and UI composition | This preserves the intended architecture in `PLAN.md`: build once, export static assets, serve them from FastAPI, keep one container and no frontend server in production. | HIGH |
| React | Match restored Next.js major | UI rendering | Standard pairing with Next.js; no reason to replace it in a brownfield completion project. | HIGH |
| TypeScript | 5.x | Frontend typing | Standard for a course capstone with agent-driven edits; reduces UI regressions in the restored source tree. | HIGH |

### Database

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| SQLite | 3.x | Single-user persistence | The app is explicitly single-user, local-first, and containerized. SQLite keeps setup at one command and avoids inventing infrastructure students do not need. | HIGH |
| `aiosqlite` | Keep | Async DB access from FastAPI | Already used. It is enough for the current schema and avoids ORM/migration overhead for v1. | HIGH |

### Infrastructure

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| `uv` | Keep project workflow; pin current repo-compatible version | Python dependency, lockfile, and run workflow | Already present with `uv.lock`; matches the course direction and keeps Python setup reproducible. | HIGH |
| Docker multi-stage build | Keep single image pattern | Local deployment | The existing `Dockerfile` already models the right outcome: frontend build stage, backend runtime stage, static assets served by FastAPI. Fix the missing frontend source, do not replace the deployment model. | HIGH |
| SSE (`EventSource`) | Keep | Real-time market price streaming | Price updates are one-way server to client. SSE is materially simpler than WebSockets and matches the existing code and product contract. | HIGH |

### AI Layer

| Technology | Version | Purpose | Why | Confidence |
|------------|---------|---------|-----|------------|
| LiteLLM Python SDK | Keep current line, pin to tested release | Provider abstraction and structured output calls | Good fit for a course app that may swap models/providers without rewriting backend chat code. | HIGH |
| OpenRouter | Keep as provider gateway | Model access | Preserves the existing integration path and simplifies model swaps for students. | HIGH |
| Configured model via env var | Restore this as configuration instead of hardcoding a single model ID | Chat model selection | The current hardcoded model is too brittle for a brownfield v1. Keep LiteLLM/OpenRouter, but move model choice to env/config. | MEDIUM |

### Supporting Libraries

| Library | Version | Purpose | When to Use | Confidence |
|---------|---------|---------|-------------|------------|
| Tailwind CSS | Restore on current maintained major | Styling and terminal-like density | Keep if the missing `frontend/` source originally used it, as README indicates. It is pragmatic for a dense trading UI and faster than inventing custom CSS architecture from scratch. | MEDIUM |
| SWR | Current maintained major | Client-side fetch/cache for same-origin API reads | Use for watchlist/history/portfolio reads in static-exported client components. It aligns with Next.js static export guidance better than adding a heavier client data layer. | HIGH |
| Pydantic v2 | Via FastAPI dependency line | Request/response schemas and LLM output validation | Keep all API and chat action contracts strongly typed. This is already the right pattern in the backend. | HIGH |
| Apache ECharts | 5.x | Treemap, line chart, sparklines | Use one charting library that can cover treemap plus time series. Prefer this over mixing multiple chart libraries. | MEDIUM |
| Pytest + `pytest-asyncio` | Keep | Backend tests | Already present and correct for async FastAPI logic. | HIGH |
| Playwright | Upgrade from old `^1.40.0` to current maintained major when test suite is touched | E2E coverage | Keep Playwright as the core browser test runner; the current pinned version is old, but the tool choice is still correct. | HIGH |

## Prescriptive Recommendation

### Keep

- Keep FastAPI, Uvicorn, SQLite, `aiosqlite`, `uv`, SSE, LiteLLM, OpenRouter, and Playwright.
- Keep the single-container, single-port deployment model.
- Keep static file serving from FastAPI for the built frontend artifact.
- Keep direct SQL for v1. The schema is small, single-user, and already understandable.

### Restore

- Restore the missing `frontend/` source tree as a Next.js + React + TypeScript app that builds to static export.
- Restore the frontend build path expected by `Dockerfile`, `README.md`, and the product plan.
- Restore frontend styling with Tailwind if that was the shipped source stack; do not redesign the styling architecture while fixing the brownfield gap.
- Restore model/provider configuration to env-driven settings instead of a hardcoded model string in backend chat code.

### Do Not Use For V1

| Avoid | Why | Use Instead | Confidence |
|-------|-----|-------------|------------|
| Postgres | Adds a service, setup burden, and migration surface with no v1 benefit in a single-user local app. | SQLite | HIGH |
| Redis | No current need for shared cache, queueing, or fan-out. | In-process cache + SQLite | HIGH |
| WebSockets | More moving parts for no product gain because updates are server-to-client only. | SSE | HIGH |
| Celery / background worker stack | Breaks the simple one-container student experience. | FastAPI lifespan/background task pattern | HIGH |
| LangChain / agent frameworks | The app needs a narrow structured action layer, not a framework-heavy agent runtime. | LiteLLM + explicit Pydantic schemas | HIGH |
| SQLAlchemy ORM / Alembic migration stack | Too much abstraction for a tiny single-user schema and would slow brownfield completion. | `aiosqlite` + explicit SQL + simple init/seed logic | HIGH |
| Redux / Zustand-first global state architecture | Premature for this UI size and adds state complexity during frontend restoration. | Local component state + SWR | MEDIUM |
| Multi-container production-style orchestration as the default student path | Violates the product constraint and makes launch/debug harder for course users. | One Docker image on port 8000 | HIGH |
| Vite rewrite | Technically viable, but switching frontend stack while the repo already expects Next static export is avoidable churn. | Restore Next.js static export source | MEDIUM |

## Alternatives Considered

| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Backend | FastAPI | Django / Django REST | Too much framework surface for the existing lightweight API and SSE-first backend. |
| Frontend | Next.js static export | Vite SPA | Would work, but it conflicts with the plan, README, and Dockerfile expectations and adds rewrite risk. |
| Persistence | SQLite | Postgres | Unnecessary operational overhead for single-user local state. |
| Realtime | SSE | WebSockets | Bidirectional transport is not required. |
| AI integration | LiteLLM + OpenRouter | Direct provider SDKs | Harder to swap models/providers cleanly in a course environment. |
| Data access | Raw `aiosqlite` | ORM stack | The schema is too small to justify the added abstraction. |

## Versioning Guidance

- **Backend:** pin exact versions after the next passing test run, not broad minimums only. The current `backend/pyproject.toml` uses lower bounds; v1 should move to reproducible tested pins.
- **Frontend:** restore on one maintained Next.js major and pin lockfile output. Do not leave the rebuilt frontend floating across majors.
- **Playwright:** upgrade deliberately when the test harness is touched, because `@playwright/test@^1.40.0` is older than current maintained releases.
- **Docker base images:** keep `python:3.12-slim`; keep Node on an LTS image compatible with the restored Next.js version. Do not optimize this further until the source frontend is back.

## Pragmatic Install Baseline

```bash
# Backend
cd backend
uv sync --dev

# Frontend restore baseline
cd ../frontend
npm install next react react-dom typescript
npm install swr echarts
npm install -D tailwindcss

# E2E tests
cd ../test
npm install
```

## Brownfield Notes For Roadmap Creation

- The highest-leverage stack task is not a migration. It is restoring the missing frontend source in the stack already implied by `PLAN.md`, `README.md`, and `Dockerfile`.
- The second highest-leverage stack task is tightening reproducibility: exact dependency pins, env-driven model config, and keeping the one-container build healthy.
- Do not spend roadmap phases introducing infrastructure. Spend them completing the intended workstation and stabilizing tests.

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Backend stack | HIGH | Directly verified from repo plus official FastAPI/uv docs. |
| Deployment model | HIGH | Strongly supported by current project context and Dockerfile. |
| Frontend stack restore | HIGH | `PLAN.md`, `README.md`, and Dockerfile all converge on Next.js static export. |
| AI provider layer | HIGH | Directly verified in code and official LiteLLM/OpenRouter docs. |
| Charting/UI support choices | MEDIUM | Recommendation is pragmatic and standard, but less constrained by official project artifacts than the core stack. |

## Sources

- Project context: `/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/.planning/PROJECT.md`
- Product contract: `/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/planning/PLAN.md`
- Repo state: `/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/Dockerfile`
- Repo state: `/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/backend/pyproject.toml`
- Repo state: `/home/lnayyar/projects/CourseAIVibeCodeUdmey/finally/README.md`
- Next.js static export docs: https://nextjs.org/docs/app/guides/static-exports
- FastAPI static files docs: https://fastapi.tiangolo.com/tutorial/static-files/
- FastAPI lifespan docs: https://fastapi.tiangolo.com/advanced/events/
- uv project docs: https://docs.astral.sh/uv/concepts/projects/
- uv locking/sync docs: https://docs.astral.sh/uv/concepts/projects/sync/
- LiteLLM docs: https://docs.litellm.ai/
- OpenRouter structured outputs docs: https://openrouter.ai/docs/features/structured-outputs
- Playwright docs: https://playwright.dev/docs/intro
