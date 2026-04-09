#!/usr/bin/env python3
"""Clear positions and trades; set cash to $10,000; one snapshot at $10,000.

Run from the backend directory:
    uv run python scripts/reset_portfolio.py

Or with a custom DB path:
    DB_PATH=/path/to/finally.db uv run python scripts/reset_portfolio.py
"""

from __future__ import annotations

import os
import sqlite3
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Allow `uv run python scripts/reset_portfolio.py` from backend/ to import app.*
_BACKEND = Path(__file__).resolve().parent.parent
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


def main() -> None:
    raw = os.environ.get("DB_PATH", "db/finally.db")
    db_path = Path(raw)
    if not db_path.is_absolute():
        db_path = Path.cwd() / db_path

    if not db_path.exists():
        from app.db.init import init_db

        db_path.parent.mkdir(parents=True, exist_ok=True)
        init_db(str(db_path))
        print(f"Created database at {db_path}")

    now = datetime.now(timezone.utc).isoformat()

    conn = sqlite3.connect(str(db_path))
    try:
        conn.execute("DELETE FROM trades")
        conn.execute("DELETE FROM positions")
        conn.execute("DELETE FROM portfolio_snapshots")
        conn.execute(
            "UPDATE users_profile SET cash_balance = 10000.0 WHERE id = 'default'",
        )
        conn.execute(
            "INSERT OR IGNORE INTO users_profile (id, cash_balance, created_at) VALUES (?, ?, ?)",
            ("default", 10000.0, now),
        )
        conn.execute(
            "INSERT INTO portfolio_snapshots (id, total_value, recorded_at) VALUES (?, ?, ?)",
            (str(uuid.uuid4()), 10000.0, now),
        )
        conn.commit()
    finally:
        conn.close()

    print(f"Reset portfolio in {db_path}")
    print("Cash: $10,000.00 | Positions: none | Snapshot: $10,000.00")


if __name__ == "__main__":
    main()
