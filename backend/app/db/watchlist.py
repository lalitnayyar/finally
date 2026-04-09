import uuid
from datetime import datetime, timezone


async def get_watchlist(conn) -> list[str]:
    cursor = await conn.execute("SELECT ticker FROM watchlist ORDER BY added_at")
    rows = await cursor.fetchall()
    return [row["ticker"] for row in rows]


async def add_ticker(conn, ticker: str) -> bool:
    ticker = ticker.upper()
    now = datetime.now(timezone.utc).isoformat()
    cursor = await conn.execute(
        "INSERT OR IGNORE INTO watchlist (id, ticker, added_at) VALUES (?, ?, ?)",
        (str(uuid.uuid4()), ticker, now),
    )
    await conn.commit()
    return cursor.rowcount > 0


async def remove_ticker(conn, ticker: str) -> bool:
    ticker = ticker.upper()
    cursor = await conn.execute("DELETE FROM watchlist WHERE ticker = ?", (ticker,))
    await conn.commit()
    return cursor.rowcount > 0
