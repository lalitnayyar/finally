# Market Data Backend — Code Review

**Date:** 2026-04-08  
**Reviewer:** Claude Code  
**Scope:** `backend/app/market/` (8 modules) + `backend/tests/market/` (7 test modules)  
**Reference docs:** `planning/MARKET_DATA_DESIGN.md`, `planning/MARKET_DATA_SUMMARY.md`, `planning/PLAN.md`

---

## Test Run Results

```
86 collected, 85 passed, 1 FAILED
Runtime: ~2.2s
```

**Coverage: 97% overall**

| Module              | Stmts | Miss | Cover | Uncovered Lines |
|---------------------|-------|------|-------|-----------------|
| `__init__.py`       | 6     | 0    | 100%  |                 |
| `cache.py`          | 39    | 0    | 100%  |                 |
| `factory.py`        | 15    | 0    | 100%  |                 |
| `interface.py`      | 13    | 0    | 100%  |                 |
| `models.py`         | 26    | 0    | 100%  |                 |
| `seed_prices.py`    | 8     | 0    | 100%  |                 |
| `massive_client.py` | 67    | 4    | 94%   | 85–87, 125      |
| `simulator.py`      | 139   | 3    | 98%   | 149, 268–269    |
| `stream.py`         | 36    | 3    | 92%   | 38, 86–87       |

**Lint (`ruff check`):** 2 errors, both unused imports in `test_stream.py`, both auto-fixable.

---

## Issues Found

### 1. FAIL — `test_router_has_prices_route` (incorrect test assertion)

**File:** `tests/market/test_stream.py:31`  
**Severity:** Low (test bug, not a production bug)

```
AssertionError: assert '/prices' in ['/api/stream/prices', '/api/stream/prices']
```

The test checks `"/prices" in paths`, but FastAPI stores the full path (prefix + registered path) in `route.path`. Since the router is declared with `prefix="/api/stream"`, the actual value is `"/api/stream/prices"`. Fix: change the assertion to check for `"/api/stream/prices"`.

The duplicate entry in the list reveals a second, more significant issue — see #2 below.

---

### 2. BUG — Module-level router accumulates routes on every call to `create_stream_router`

**File:** `app/market/stream.py:17–48`  
**Severity:** Medium (harmless in production with a single call at startup; breaks test isolation)

```python
# Module-level — one instance for the lifetime of the process
router = APIRouter(prefix="/api/stream", tags=["streaming"])

def create_stream_router(price_cache: PriceCache) -> APIRouter:
    @router.get("/prices")      # ← adds a new route to the SAME module-level router
    async def stream_prices(request: Request) -> StreamingResponse:
        ...
    return router               # ← returns the same accumulated router
```

Each call to `create_stream_router` registers an additional `/api/stream/prices` route onto the shared module-level `router`. Three tests call this factory, so by the time `test_router_has_prices_route` runs the router already has two routes. In production this is harmless because the factory is called exactly once at startup, but the function name implies it *creates* a router — the current implementation mutates a shared one.

**Fix:** instantiate `APIRouter` inside the factory function:

```python
def create_stream_router(price_cache: PriceCache) -> APIRouter:
    router = APIRouter(prefix="/api/stream", tags=["streaming"])

    @router.get("/prices")
    async def stream_prices(request: Request) -> StreamingResponse:
        return StreamingResponse(
            _generate_events(price_cache, request),
            media_type="text/event-stream",
            headers={...},
        )

    return router
```

---

### 3. LINT — Two unused imports in `test_stream.py`

**File:** `tests/market/test_stream.py:6`  
**Severity:** Low

```python
from unittest.mock import AsyncMock, MagicMock, patch
#                          ^^^^^^^^^             ^^^^^  unused
```

`AsyncMock` and `patch` are imported but never referenced. Fix with `ruff --fix`.

---

### 4. MINOR — `version` property reads `_version` without the lock

**File:** `app/market/cache.py:64–66`  
**Severity:** Low (safe under CPython's GIL; theoretical concern for GIL-free Python)

```python
@property
def version(self) -> int:
    return self._version   # no lock; all writes are locked
```

All writes to `_version` are inside `self._lock`, but reads are not. CPython's GIL makes this safe today. Under Python 3.13+ free-threaded mode (PEP 703) this becomes a real data race. Adding the lock on read costs nothing meaningful and removes the inconsistency.

---

### 5. MINOR — `start()` is not guarded against double-call

**Files:** `simulator.py:219`, `massive_client.py:41`  
**Severity:** Low

The `MarketDataSource` docstring states "calling `start()` twice is undefined behavior." Neither implementation guards against it — a second call creates a new background task while the previous one leaks. A simple `if self._task: return` (or raise) would enforce the contract.

---

### 6. MINOR — Tests access private attributes directly

**Files:** `test_simulator.py`, `test_simulator_source.py`, `test_massive.py`  
**Severity:** Low (style)

Tests frequently assert on `_tickers`, `_cholesky`, `_task`, `_client`, `_cache`, `_api_key`. This is common in Python unit tests and acceptable here, but `get_tickers()` is available as a public API and is the better choice where applicable (e.g., `test_add_duplicate_is_noop` could use `len(sim.get_tickers()) == 1` rather than `len(sim._tickers) == 1`).

---

## Architecture Assessment

The overall design is well-executed and faithfully implements the spec.

**Strengths:**

- **Strategy pattern** is correctly applied. Both `SimulatorDataSource` and `MassiveDataSource` implement the `MarketDataSource` ABC, making them fully interchangeable. `factory.py` is the sole decision point.
- **`PriceCache`** is a clean single source of truth with correct `threading.Lock` usage throughout. The monotonic version counter for SSE change detection is a good optimization that suppresses redundant event emissions.
- **GBM math** is correct: `S(t+dt) = S(t) * exp((mu − σ²/2)·dt + σ·√dt·Z)` is the standard log-normal GBM discretization. Prices are guaranteed positive (exp is always positive). The `dt` value — 500 ms / trading year seconds — is correct at ~8.48×10⁻⁸.
- **Cholesky correlation** is appropriate. Sector-based groups (tech at 0.6, finance at 0.5, cross-sector at 0.3) produce believable correlated moves. TSLA is explicitly broken out of the tech group (`TSLA_CORR = 0.3`), a nice touch that reflects its real-world behavior.
- **`MassiveDataSource`** correctly offloads the synchronous Polygon.io `RESTClient` to a thread via `asyncio.to_thread()`, keeping the event loop unblocked.
- **SSE streaming** correctly uses version-based change detection to avoid sending duplicate events. The `retry: 1000\n\n` directive at connection open ensures EventSource reconnects within 1 second. The `X-Accel-Buffering: no` header is a practical addition for nginx-proxied deployments.
- **Error resilience**: the simulator loop catches all exceptions and logs them without crashing; the Massive poller does the same. Both resume on the next cycle.
- **Public API surface** (`__init__.py`) exports exactly five names, keeping the integration surface clean and explicit.

**Gap relative to spec:**

The planning documents specify a **rolling price history cache** (last 200 prices per ticker) and a `/api/prices/{ticker}/history` endpoint to bootstrap frontend sparklines and the main chart on page load. This is not yet implemented: `PriceCache` stores only the single latest `PriceUpdate` per ticker. This will need to be added before the frontend can be fully integrated.

---

## Summary Table

| # | Severity | Item | Location | Fix effort |
|---|----------|------|----------|------------|
| 1 | Bug | Test asserts `/prices` but path is `/api/stream/prices` | `test_stream.py:31` | 1 line |
| 2 | Bug | `create_stream_router` mutates a shared module-level router | `stream.py:17–48` | ~5 lines |
| 3 | Lint | `AsyncMock` and `patch` imported but unused | `test_stream.py:6` | `ruff --fix` |
| 4 | Polish | `version` read is not lock-protected | `cache.py:65` | 2 lines |
| 5 | Polish | `start()` not guarded against double-call | `simulator.py`, `massive_client.py` | 2 lines each |
| 6 | Polish | Tests use private attrs where public API exists | various test files | style |
| 7 | Gap | Price history buffer (200-point rolling window) missing | `cache.py` + new endpoint | ~30 lines |

**Overall verdict:** The market data backend is well-structured and production-ready for its scope. The GBM simulator, correlation model, Massive API client, thread-safe PriceCache, and SSE streaming are all correctly implemented and comprehensively tested at 97% coverage. Issues #1–3 should be fixed before merging. The price history buffer (#7) is needed before frontend integration begins.
