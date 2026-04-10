# Architecture Patterns

**Domain:** Brownfield single-user AI trading workstation for course students
**Researched:** 2026-04-10
**Confidence:** HIGH

## Recommended Architecture

Keep the existing single-process FastAPI monolith and make the missing product pieces integrate through a thin application-service layer rather than through route-to-DB shortcuts. This project does not need new infrastructure. It needs one authoritative runtime model for prices, portfolio valuation, watchlist membership, chat actions, and UI hydration.

### System Overview

```text
┌────────────────────────────────────────────────────────────────────┐
│                      Static Frontend (served by FastAPI)           │
│  Header/status │ Watchlist grid │ Main chart │ Portfolio │ Chat   │
└───────────────────────────────┬────────────────────────────────────┘
                                │ GET/POST + EventSource
┌───────────────────────────────┴────────────────────────────────────┐
│                         FastAPI App Boundary                        │
│  REST routers        SSE router         Static file mount          │
└──────────────┬───────────────┬───────────────────────┬─────────────┘
               │               │                       │
┌──────────────┴───────┐ ┌─────┴────────────────┐ ┌────┴──────────────┐
│ Application Services │ │ Runtime Market State │ │ LLM Orchestration │
│ portfolio service    │ │ price cache          │ │ prompt builder     │
│ watchlist service    │ │ ticker registry      │ │ structured parser  │
│ workstation query    │ │ history buffers      │ │ action executor    │
│ snapshot service     │ │ source lifecycle     │ │ conversation store │
└──────────────┬───────┘ └─────┬────────────────┘ └────┬──────────────┘
               │               │                       │
┌──────────────┴────────────────┴───────────────────────┴─────────────┐
│                           Persistence / External                     │
│ SQLite: profile, watchlist, positions, trades, portfolio_snapshots  │
│ Market source: simulator by default, Massive when configured         │
│ LLM provider: LiteLLM -> OpenRouter                                  │
└───────────────────────────────────────────────────────────────────────┘
```

### Component Boundaries

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| Static frontend | Render terminal UI, open SSE stream, issue REST mutations, maintain ephemeral visual state like sparkline buffers and connection indicator | FastAPI REST/SSE only |
| API routers | HTTP transport, validation, status codes, response shaping | Application services |
| Workstation query service | Build one consistent read model for dashboard/chat from SQLite + price cache | DB layer, price cache |
| Portfolio service | Execute manual and AI trades, enforce business rules, trigger snapshot recording | DB layer, price cache, snapshot service |
| Watchlist service | Add/remove tickers in DB and runtime source together | DB layer, market source, price cache |
| Snapshot service | Record portfolio history from live runtime valuation, not partial trade-only math | DB layer, workstation query service |
| LLM orchestration | Build chat context, call model, validate structured output, hand off to services, return execution results | Workstation query service, portfolio/watchlist services |
| Price cache | Authoritative in-memory latest price + rolling history per active ticker | Market source writers, API/service readers |
| Market source | Poll simulator or Massive and update cache; subscribe/unsubscribe tickers | Price cache, watchlist service |
| DB access layer | SQLite initialization and CRUD for durable state | Application services only |

## Recommended Brownfield Structure

The current repo already has useful seams in `backend/app/routes`, `backend/app/db`, `backend/app/market`, and `backend/app/llm`. The missing layer is explicit application services that own cross-module consistency.

```text
backend/app/
├── main.py                 # app wiring, lifespan, static mount
├── routes/                 # transport only
├── services/               # new: orchestration/business flows
│   ├── workstation.py      # unified dashboard/chat read model
│   ├── portfolio.py        # manual + AI trade execution
│   ├── watchlist.py        # DB + market source coordination
│   ├── snapshots.py        # authoritative valuation snapshots
│   └── chat_actions.py     # LLM action application boundary
├── db/                     # persistence primitives only
├── market/                 # cache, stream router, source adapters
├── llm/                    # prompt/schema/provider integration
└── static/                 # built frontend artifact
```

### Structure Rationale

- **Keep routes thin:** route handlers should stop duplicating valuation and execution logic.
- **Add `services/`:** this is the main missing architectural piece for brownfield completion.
- **Keep `market/` separate:** it already models runtime-only state correctly and should remain non-persistent.
- **Keep `llm/` provider-focused:** chat should stop mutating DB state directly and instead call services.

## Patterns to Follow

### Pattern 1: Unified Read Model

**What:** Build one function that assembles the workstation state used by both dashboard endpoints and chat context.
**When:** Any feature needs portfolio positions, cash, watchlist, live prices, total value, or derived P&L.
**Why:** The current code computes overlapping portfolio/watchlist enrichments in multiple places. That invites drift.

**Example:**
```python
async def build_workstation_state(conn, cache) -> dict:
    portfolio = await get_portfolio(conn)
    watchlist = await get_watchlist(conn)
    # Enrich from cache once, then reuse everywhere.
    return {...}
```

### Pattern 2: Command Service for Mutations

**What:** Every state-changing action goes through a service method that coordinates DB writes and runtime side effects.
**When:** Manual trade, AI trade, manual watchlist edit, AI watchlist edit, startup snapshot repair.
**Why:** Today manual watchlist edits update the runtime source, but AI watchlist edits do not. That is exactly the kind of inconsistency this pattern prevents.

### Pattern 3: Runtime-First Portfolio Valuation

**What:** Portfolio snapshots and UI totals should be computed from durable holdings plus current cache prices, with deterministic fallback rules.
**When:** After trades, on startup seed/repair, and for `/api/portfolio` and `/api/portfolio/history`.
**Why:** The current DB trade execution path records a partial snapshot and the route records another one. Snapshot ownership should be singular.

## Data Flow

### Launch and Hydration

```text
App startup
  -> init SQLite if missing
  -> load watchlist from DB
  -> seed cache with default prices
  -> start market data source for active tickers
  -> mount REST/SSE/static routes
  -> frontend loads
  -> frontend fetches watchlist/portfolio/history
  -> frontend opens EventSource for ongoing prices
```

### Manual Trade Flow

```text
User submits trade
  -> POST /api/portfolio/trade
  -> portfolio service validates side/quantity/ticker price
  -> execute DB trade
  -> snapshot service records one post-trade valuation from cache
  -> API returns executed trade + refreshed balances
  -> frontend refreshes portfolio views
```

### AI Chat Action Flow

```text
User sends chat message
  -> POST /api/chat
  -> workstation query service builds current context
  -> LLM returns structured actions
  -> chat action service applies each action via portfolio/watchlist services
  -> execution results returned to client
  -> frontend refreshes affected views
```

### Watchlist Mutation Flow

```text
Add/remove ticker
  -> watchlist service writes SQLite
  -> if changed, market source add/remove ticker
  -> cache/history seeded or removed consistently
  -> SSE next payload reflects active set
  -> frontend updates grid and chart affordances
```

## Build-Order Implications

1. **Create the service layer before UI expansion.**
   The remaining frontend work should not bind to duplicated route logic. First centralize workstation reads, trade execution, watchlist mutation, and snapshot recording.

2. **Fix mutation consistency before richer AI behavior.**
   AI watchlist actions must go through the same watchlist service as manual actions so runtime source membership and cache contents stay aligned.

3. **Make snapshot ownership singular before portfolio visuals are trusted.**
   Treemap and P&L chart quality depend on one authoritative valuation path. Remove duplicate or conflicting snapshot writes first.

4. **Expose a dashboard-ready read contract before rebuilding frontend source.**
   Because the checked-in repo lacks the original `frontend/` source tree, roadmap phases should first stabilize API contracts the replacement frontend will consume.

5. **Add E2E coverage immediately after each contract is stabilized.**
   The risky seams are launch, SSE hydration, manual trade, AI trade, and AI watchlist mutation. These should become the acceptance spine for the remaining work.

## Anti-Patterns to Avoid

### Anti-Pattern 1: Route-Level Business Logic Duplication

**What:** Computing portfolio totals, P&L, and execution side effects separately in routes and chat code.
**Why bad:** Manual and AI flows diverge, which is already visible in watchlist and snapshot behavior.
**Instead:** Put business rules in services and keep routes transport-only.

### Anti-Pattern 2: Treating SQLite as the Source of Live Market Truth

**What:** Trying to persist every tick or deriving current prices from stale trade rows.
**Why bad:** Adds unnecessary write load and breaks the simulator/SSE-first design.
**Instead:** Keep live prices in the in-memory cache; persist only user state and historical portfolio snapshots.

### Anti-Pattern 3: Frontend-Defined Product Contract

**What:** Rebuilding missing frontend source first and letting API shape emerge ad hoc.
**Why bad:** In a brownfield repo, that creates rework across routes, tests, and chat integration.
**Instead:** First lock the backend service and response contracts that the new frontend will target.

## Scalability Considerations

| Concern | At current single-user scope | If student usage grows modestly |
|---------|------------------------------|---------------------------------|
| API shape | Monolith is correct | Keep monolith; optimize hot endpoints only |
| DB | SQLite is correct | Stay on SQLite until true multi-user/auth exists |
| Streaming | Single SSE endpoint is correct | Continue SSE; reduce payload churn before changing protocols |
| Market data | In-process polling is correct | Add poll-rate controls/caching, not new services |

The first bottleneck is correctness, not throughput. Roadmap phases should optimize for integration discipline and testability rather than scale decomposition.

## Sources

- `/.planning/PROJECT.md`
- `/planning/PLAN.md`
- `/backend/app/main.py`
- `/backend/app/routes/portfolio.py`
- `/backend/app/routes/watchlist.py`
- `/backend/app/llm/router.py`
- `/backend/app/llm/chat.py`
- `/backend/app/market/cache.py`
