import os
import sqlite3
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import aiosqlite

from .schema import SCHEMA_SQL

DEFAULT_TICKERS = ["AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "NVDA", "META", "JPM", "V", "NFLX"]


def init_db(db_path: str) -> None:
    os.makedirs(os.path.dirname(db_path) or ".", exist_ok=True)

    conn = sqlite3.connect(db_path)
    try:
        conn.executescript(SCHEMA_SQL)

        now = datetime.now(timezone.utc).isoformat()

        conn.execute(
            "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            ("default", 10000.0, now),
        )

        for ticker in DEFAULT_TICKERS:
            conn.execute(
                "INSERT OR IGNORE INTO watchlist (id, ticker, added_at) VALUES (?, ?, ?)",
                (str(uuid.uuid4()), ticker, now),
            )

        conn.execute(
            "INSERT OR IGNORE INTO portfolio_snapshots (id, total_value, recorded_at) "
            "SELECT ?, 10000.0, ? WHERE NOT EXISTS (SELECT 1 FROM portfolio_snapshots)",
            (str(uuid.uuid4()), now),
        )

        conn.commit()
    finally:
        conn.close()


@asynccontextmanager
async def get_db(db_path: str):
    conn = await aiosqlite.connect(db_path)
    conn.row_factory = aiosqlite.Row
    try:
        yield conn
    finally:
        await conn.close()
