# Codebase Concerns

**Analysis Date:** 2026-04-10

## Tech Debt

**Trade snapshot duplication:**
- Issue: A trade executed through the HTTP API records a snapshot inside `execute_trade()` and then records a second post-trade snapshot in the route handler.
- Files: `backend/app/db/portfolio.py`, `backend/app/routes/portfolio.py`
- Impact: `portfolio_snapshots` grows twice as fast for API trades, history charts can show duplicate timestamps for a single action, and analytics built on snapshot count will be wrong.
- Fix approach: Choose one snapshot responsibility boundary. Either keep snapshot writes inside `execute_trade()` only, or move all snapshot creation into the route/service layer and remove it from the DB helper.

**Chat-driven watchlist mutations bypass the market data source:**
- Issue: LLM actions update the `watchlist` table directly but do not call the active market source's `add_ticker()` or `remove_ticker()` methods.
- Files: `backend/app/llm/chat.py`, `backend/app/routes/watchlist.py`, `backend/app/market/interface.py`
- Impact: A ticker added through `/api/chat` can exist in the database without being seeded into the live cache or polling set; a removed ticker can remain in memory until restart.
- Fix approach: Pass the active source into the chat action executor or move watchlist mutation logic behind a shared service that updates both persistence and runtime state consistently.

**Frontend source is absent while generated static output is committed:**
- Issue: The repository root `README.md` and `Dockerfile` both assume a `frontend/` source tree, but this workspace contains only generated assets under `backend/static/`.
- Files: `README.md`, `Dockerfile`, `backend/static/index.html`, `backend/static/_next/static/XuHNFF37u25vN5SpDFMI9/_buildManifest.js`
- Impact: The UI cannot be reviewed, rebuilt, or modified from source in this checkout. Docker builds that rely on `COPY frontend/...` are not reproducible from the current tree.
- Fix approach: Restore the `frontend/` application source to version control or simplify the build/deploy story so the repo explicitly treats `backend/static/` as the only supported frontend artifact.

## Known Bugs

**Shared chat history leaks across requests and users:**
- Symptoms: `_conversation_history` is a module-global list, appended on every chat request and reused for later requests regardless of client identity.
- Files: `backend/app/llm/chat.py`, `backend/app/llm/router.py`
- Trigger: Multiple users, browser sessions, or tests use `/api/chat` against the same process.
- Workaround: Restart the process to clear the in-memory history. There is no request-scoped or user-scoped isolation in the current implementation.

**Chat endpoint reports failures as successful responses:**
- Symptoms: Exceptions in `/api/chat` are swallowed and converted into a fallback JSON body with HTTP 200 semantics.
- Files: `backend/app/llm/router.py`
- Trigger: LLM transport failures, schema parse errors, database failures, or runtime exceptions in chat action execution.
- Workaround: Inspect backend logs. Clients cannot distinguish degraded behavior from a successful request by status code alone.

**API trade history differs from direct DB trade history:**
- Symptoms: Database-level tests expect one new history row per trade, but API trades currently persist two rows because the route adds a second snapshot.
- Files: `backend/app/db/portfolio.py`, `backend/app/routes/portfolio.py`, `backend/tests/test_db.py`
- Trigger: Use `POST /api/portfolio/trade` instead of calling `execute_trade()` directly.
- Workaround: None in the public API. Consumers must tolerate duplicated adjacent portfolio history entries.

## Security Considerations

**Unauthenticated state-changing endpoints:**
- Risk: Any caller that can reach the service can buy/sell positions, edit the watchlist, and invoke LLM-driven actions without authentication, authorization, or rate limiting.
- Files: `backend/app/routes/portfolio.py`, `backend/app/routes/watchlist.py`, `backend/app/llm/router.py`, `backend/app/main.py`
- Current mitigation: None detected in the backend routing layer.
- Recommendations: Add authentication before all mutating routes, separate read and write permissions, and apply request throttling to `/api/chat` and trade endpoints.

**LLM endpoint can trigger real state changes from model output:**
- Risk: `/api/chat` can execute trades and watchlist mutations based on model-generated structured output, but there is no confirmation step, no audit policy layer, and only minimal ticker/quantity validation.
- Files: `backend/app/llm/router.py`, `backend/app/llm/chat.py`, `backend/app/llm/schema.py`
- Current mitigation: Regex validation for ticker symbols and numeric guardrails for quantity in `execute_llm_actions()`.
- Recommendations: Require explicit user confirmation for destructive actions, log structured audit records for model-issued trades, and isolate planning from execution.

**Environment loading at import time:**
- Risk: `load_dotenv()` runs when `backend/app/llm/chat.py` is imported, which couples secret loading to module import order and makes configuration less explicit.
- Files: `backend/app/llm/chat.py`
- Current mitigation: `.env.example` documents expected variables, and runtime scripts pass `--env-file`.
- Recommendations: Move environment loading to process startup, validate required settings once, and avoid implicit config mutation inside library modules.

## Performance Bottlenecks

**SSE broadcasts the full cache on each version change:**
- Problem: Every price update causes `_generate_events()` to serialize the entire ticker map and send it to each connected client.
- Files: `backend/app/market/stream.py`, `backend/app/market/cache.py`
- Cause: Change detection is global (`PriceCache.version`) rather than per ticker or per subscriber, and payload generation always includes `price_cache.get_all()`.
- Improvement path: Send deltas instead of the full cache, batch updates on a coarser interval, or move to a pub/sub stream with per-client backpressure handling.

**Trade execution performs multi-query read/modify/write sequences without a single transactional service boundary:**
- Problem: Each trade performs several selects, updates, inserts, snapshot calculations, and commits across separate statements.
- Files: `backend/app/db/portfolio.py`, `backend/app/routes/portfolio.py`
- Cause: Portfolio mutation, valuation, and history writes are interleaved procedurally in request code rather than encapsulated in a tighter transactional unit.
- Improvement path: Wrap trade execution and snapshot writes in one explicit transaction boundary and avoid recomputing portfolio state in a second connection after the trade.

## Fragile Areas

**Portfolio mutation logic under concurrent requests:**
- Files: `backend/app/db/portfolio.py`, `backend/app/routes/portfolio.py`, `backend/app/db/init.py`
- Why fragile: `execute_trade()` reads balances and positions, computes derived values in Python, then writes updates later. Concurrent requests can race and overspend cash or oversell positions because no optimistic locking, row-version check, or serialized transaction strategy is present.
- Safe modification: Centralize all trade mutations in one transaction-aware service and add concurrency tests before changing portfolio logic.
- Test coverage: `backend/tests/test_db.py` covers happy paths and basic validation but does not cover concurrent trade requests.

**Process-local runtime state:**
- Files: `backend/app/main.py`, `backend/app/market/cache.py`, `backend/app/llm/chat.py`
- Why fragile: Watchlist prices, SSE state, and chat history live entirely in memory on one process. Restarting the service drops price history and chat context; running more than one backend instance would create divergent state across replicas.
- Safe modification: Treat `PriceCache` and conversation state as ephemeral caches only, or move shared state to a durable store/message bus before scaling deployment.
- Test coverage: `backend/tests/market/test_stream.py` and `backend/tests/test_chat.py` cover single-process behavior only.

**Backend test lifecycle cleanup:**
- Files: `backend/tests/test_routes.py`, `backend/tests/test_chat.py`, `backend/tests/market/test_simulator_source.py`
- Why fragile: Tests manually start background market-data tasks and stop them in fixture teardown. In this workspace, `backend/.venv/bin/pytest backend/tests -q` prints progress and then does not terminate cleanly, which points to cleanup sensitivity around async tasks.
- Safe modification: Use app lifespan-aware test clients, ensure all created tasks are awaited/cancelled deterministically, and add explicit timeout/assertion coverage around shutdown.
- Test coverage: The suite exercises the happy path but does not include a dedicated shutdown/leak detection test.

## Scaling Limits

**Single-process cache and SQLite design:**
- Current capacity: Suitable for one local process with a small ticker set and a small number of connected SSE clients.
- Limit: Horizontal scaling breaks cache consistency, chat history continuity, and likely produces divergent watchlists/price streams per instance. SQLite also becomes a contention point for write-heavy trading workloads.
- Scaling path: Move persistent state to a server database, move price fan-out to a shared pub/sub layer, and eliminate module-global/request-process state before adding replicas.

**Committed static frontend artifact flow:**
- Current capacity: The service can serve the checked-in static bundle in `backend/static/`.
- Limit: Any UI change requires an external, currently missing build source tree. The current repo shape does not support normal frontend iteration or reliable rebuilds.
- Scaling path: Restore the frontend source and automated build pipeline, or formally collapse the app into a backend-only project with static assets managed elsewhere.

## Dependencies at Risk

**Massive integration is thinly wrapped and lacks resilience controls:**
- Risk: Real market data polling catches exceptions and logs them, but there is no circuit breaker, no retry policy metadata, no stale-data marker, and no health surface for degraded external data.
- Impact: The system can silently serve frozen prices while reporting healthy HTTP status.
- Migration plan: Add provider health reporting around `backend/app/market/massive_client.py`, expose stale-cache metadata through the API, and consider isolating provider logic behind a richer adapter contract in `backend/app/market/interface.py`.

## Missing Critical Features

**Source-controlled frontend implementation:**
- Problem: The repository contains generated UI output in `backend/static/` but no corresponding `frontend/` source tree even though `README.md` and `Dockerfile` assume it exists.
- Blocks: Rebuilding the UI, code-reviewing frontend logic, fixing frontend bugs from source, and producing reproducible container builds from the current checkout.

**Access control and audit trail for trading actions:**
- Problem: Mutating routes and chat-driven trade execution have no user identity, no permission model, and no durable audit log beyond raw trade rows.
- Blocks: Safe multi-user use, externally exposed deployment, and trustworthy review of who initiated which action.

## Test Coverage Gaps

**Real chat integration behavior:**
- What's not tested: Real `litellm`/OpenRouter behavior, malformed structured outputs, timeout handling, and confirmation-safe execution semantics.
- Files: `backend/app/llm/chat.py`, `backend/app/llm/router.py`, `backend/tests/test_chat.py`
- Risk: Production chat behavior can diverge materially from the mocked test path.
- Priority: High

**Trade concurrency and transactional integrity:**
- What's not tested: Parallel buy/sell requests against the same cash balance and position state.
- Files: `backend/app/db/portfolio.py`, `backend/app/routes/portfolio.py`, `backend/tests/test_db.py`, `backend/tests/test_routes.py`
- Risk: Race conditions can corrupt balances and positions without being caught in CI.
- Priority: High

**Frontend build reproducibility:**
- What's not tested: Existence of the `frontend/` source tree, successful Docker frontend build, or consistency between generated assets and documented build commands.
- Files: `Dockerfile`, `README.md`, `backend/static/index.html`, `test/docker-compose.test.yml`
- Risk: Deployment can fail or become impossible to reproduce from source control.
- Priority: High

**Provider degradation and stale market data signaling:**
- What's not tested: Recovery behavior after repeated Massive API failures, stale-cache surfacing, or health signal changes when market polling stops updating prices.
- Files: `backend/app/market/massive_client.py`, `backend/app/routes/health.py`, `backend/tests/market/test_massive.py`
- Risk: The service can look healthy while serving outdated prices.
- Priority: Medium

---

*Concerns audit: 2026-04-10*
