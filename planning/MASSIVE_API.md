# Massive API (formerly Polygon.io) — Stock Price Reference

Polygon.io rebranded as [Massive](https://massive.com) in October 2025. All existing API keys and integrations continue to work. The base URL is `https://api.massive.com` (also `https://api.polygon.io` for backward compatibility).

Authentication is via API key — pass as a query parameter `?apiKey=<KEY>` or as the `Authorization: Bearer <KEY>` header.

---

## Endpoints Used in FinAlly

### 1. Snapshots for Multiple Tickers (Primary)

**Full Market Snapshot — filtered by ticker list**

```
GET /v2/snapshot/locale/us/markets/stocks/tickers
```

Query parameters:
- `tickers` — comma-separated list of symbols, e.g. `AAPL,GOOGL,MSFT` (omit for all ~10k tickers)
- `include_otc` — `false` (default)
- `apiKey` — your API key

**Example request:**
```
GET https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers?tickers=AAPL,GOOGL,MSFT&apiKey=YOUR_KEY
```

**Response structure:**
```json
{
  "status": "OK",
  "count": 3,
  "tickers": [
    {
      "ticker": "AAPL",
      "todaysChange": 2.34,
      "todaysChangePerc": 1.23,
      "updated": 1712590800000000000,
      "day": {
        "o": 189.50,
        "h": 192.10,
        "l": 188.90,
        "c": 191.75,
        "v": 52340000,
        "vw": 190.42
      },
      "lastTrade": {
        "p": 191.75,
        "s": 100,
        "t": 1712590800000000000,
        "x": 4
      },
      "lastQuote": {
        "P": 191.76,
        "S": 2,
        "p": 191.75,
        "s": 3,
        "t": 1712590800000000000
      },
      "min": {
        "o": 191.50,
        "h": 191.90,
        "l": 191.40,
        "c": 191.75,
        "v": 84200,
        "vw": 191.62,
        "av": 51200000
      },
      "prevDay": {
        "o": 188.50,
        "h": 190.20,
        "l": 187.80,
        "c": 189.41,
        "v": 48100000,
        "vw": 189.05
      }
    }
  ]
}
```

**Key fields:**
| Field | Description |
|---|---|
| `ticker` | Symbol |
| `todaysChange` | Dollar change from previous close |
| `todaysChangePerc` | Percent change from previous close |
| `updated` | Nanosecond Unix timestamp of last update |
| `day.c` | Current day closing/latest price |
| `lastTrade.p` | Most recent trade price |
| `lastTrade.t` | Trade timestamp (nanoseconds) |
| `lastQuote.p` / `lastQuote.P` | Bid / Ask price |
| `min.c` | Close of the most recent 1-minute bar |
| `prevDay.c` | Previous day's closing price |

> **Best price field for FinAlly:** `lastTrade.p` if available (most recent trade), otherwise `day.c` (current day close/latest). Fall back to `prevDay.c` when market is closed.

---

### 2. Single Ticker Snapshot

```
GET /v2/snapshot/locale/us/markets/stocks/tickers/{stocksTicker}
```

Same response shape as above but for one ticker in `ticker` (singular object, not array).

**Example:**
```
GET https://api.massive.com/v2/snapshot/locale/us/markets/stocks/tickers/AAPL?apiKey=YOUR_KEY
```

Response wraps the ticker object under `"ticker"` key.

---

### 3. Previous Day Bar (End-of-Day)

```
GET /v2/aggs/ticker/{stocksTicker}/prev
```

Query parameters:
- `adjusted` — `true` (default, adjusts for splits)
- `apiKey` — your API key

**Example:**
```
GET https://api.massive.com/v2/aggs/ticker/AAPL/prev?adjusted=true&apiKey=YOUR_KEY
```

**Response:**
```json
{
  "ticker": "AAPL",
  "status": "OK",
  "adjusted": true,
  "queryCount": 1,
  "resultsCount": 1,
  "results": [
    {
      "T": "AAPL",
      "o": 188.50,
      "h": 190.20,
      "l": 187.80,
      "c": 189.41,
      "v": 48100000,
      "vw": 189.05,
      "t": 1712534400000,
      "n": 712345
    }
  ]
}
```

**Key fields:**
| Field | Description |
|---|---|
| `T` | Ticker symbol |
| `o` | Open |
| `h` | High |
| `l` | Low |
| `c` | Close |
| `v` | Volume |
| `vw` | Volume-weighted average price |
| `t` | Unix millisecond timestamp (start of bar) |
| `n` | Number of transactions |

---

### 4. Last Trade (single ticker, most recent)

```
GET /v2/last/trade/{stocksTicker}
```

**Example:**
```
GET https://api.massive.com/v2/last/trade/AAPL?apiKey=YOUR_KEY
```

**Response:**
```json
{
  "status": "OK",
  "request_id": "abc123",
  "results": {
    "T": "AAPL",
    "p": 191.75,
    "s": 100,
    "t": 1712590800123456789,
    "x": 4,
    "z": 3,
    "i": "12345",
    "c": [14, 41]
  }
}
```

**Key fields:** `p` = price, `s` = size, `t` = timestamp (nanoseconds), `x` = exchange ID.

---

### 5. Unified Snapshot (multi-asset, v3)

```
GET /v3/snapshot
```

More flexible than v2 — supports filtering by `type` (`stocks`, `options`, `fx`, `crypto`, `indices`) and up to 250 tickers via `ticker.any_of`.

**Example:**
```
GET https://api.massive.com/v3/snapshot?ticker.any_of=AAPL,GOOGL,MSFT&type=stocks&limit=50&apiKey=YOUR_KEY
```

**Response:**
```json
{
  "status": "OK",
  "request_id": "xyz",
  "results": [
    {
      "ticker": "AAPL",
      "type": "stocks",
      "session": {
        "open": 189.50,
        "high": 192.10,
        "low": 188.90,
        "close": 191.75,
        "volume": 52340000,
        "change": 2.34,
        "change_percent": 1.23
      },
      "last_trade": {
        "price": 191.75,
        "size": 100,
        "timestamp": "2024-04-08T15:00:00Z"
      },
      "last_quote": {
        "bid_price": 191.74,
        "ask_price": 191.76,
        "bid_size": 3,
        "ask_size": 2
      },
      "updated": "2024-04-08T15:00:00Z"
    }
  ],
  "next_url": null
}
```

---

## Rate Limits by Plan

| Plan | API calls/min | Recommended poll interval |
|---|---|---|
| Free (Starter) | 5 | 15 seconds |
| Starter paid | ~unlimited (fair use) | 2–5 seconds |
| Business | Unlimited | 1–2 seconds |

For FinAlly, the default polling interval should be **15 seconds** (safe for free tier). With a paid key, reduce to 2–5 seconds.

---

## Python Usage

### Direct HTTP (used in FinAlly — no extra SDK dependency)

```python
import httpx

BASE_URL = "https://api.massive.com"

async def fetch_snapshots(tickers: list[str], api_key: str) -> dict:
    """Fetch current price snapshots for multiple tickers."""
    tickers_param = ",".join(tickers)
    url = f"{BASE_URL}/v2/snapshot/locale/us/markets/stocks/tickers"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params={"tickers": tickers_param, "apiKey": api_key})
        resp.raise_for_status()
        return resp.json()

async def fetch_previous_close(ticker: str, api_key: str) -> dict:
    """Fetch previous day's OHLCV for a single ticker."""
    url = f"{BASE_URL}/v2/aggs/ticker/{ticker}/prev"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, params={"adjusted": "true", "apiKey": api_key})
        resp.raise_for_status()
        return resp.json()
```

### Official Python Client (alternative)

Install: `pip install -U massive` (or `uv add massive`)

```python
from massive import RESTClient

client = RESTClient(api_key="YOUR_KEY")

# Single ticker snapshot
snapshot = client.get_snapshot_ticker("stocks", "AAPL")
price = snapshot.last_trade.price

# Multiple tickers — iterate snapshots
snapshots = client.get_snapshot_all_tickers("stocks", tickers=["AAPL", "GOOGL", "MSFT"])
for s in snapshots:
    print(s.ticker, s.last_trade.price)

# Previous day close
result = client.get_previous_close("AAPL")
prev_close = result.results[0].c
```

---

## Extracting the Price from a Snapshot Response

The best available price in order of preference:

```python
def extract_price(ticker_snapshot: dict) -> float | None:
    """Extract the best available current price from a v2 snapshot ticker object."""
    # 1. Most recent trade (real-time during market hours)
    last_trade = ticker_snapshot.get("lastTrade") or {}
    if price := last_trade.get("p"):
        return float(price)
    # 2. Current day close (updated throughout the session)
    day = ticker_snapshot.get("day") or {}
    if price := day.get("c"):
        return float(price)
    # 3. Previous day close (fallback when market is closed / no data yet)
    prev_day = ticker_snapshot.get("prevDay") or {}
    if price := prev_day.get("c"):
        return float(price)
    return None
```

---

## Market Hours

The US stock market is open Monday–Friday, 9:30 AM – 4:00 PM Eastern Time (excluding holidays). Outside of these hours, `lastTrade.p` from the snapshot reflects the last trade of the previous session. `todaysChange` / `todaysChangePerc` reset at market open each day.
