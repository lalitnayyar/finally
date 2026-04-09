import uuid
from datetime import datetime, timezone


async def get_portfolio(conn) -> dict:
    cursor = await conn.execute("SELECT cash_balance FROM users_profile WHERE id = 'default'")
    row = await cursor.fetchone()
    cash_balance = row["cash_balance"]

    cursor = await conn.execute("SELECT ticker, quantity, avg_cost FROM positions")
    positions = [dict(row) for row in await cursor.fetchall()]

    cursor = await conn.execute(
        "SELECT ticker, side, quantity, price, executed_at FROM trades ORDER BY executed_at"
    )
    trades = [dict(row) for row in await cursor.fetchall()]

    return {"cash_balance": cash_balance, "positions": positions, "trades": trades}


async def execute_trade(conn, ticker: str, side: str, quantity: float, price: float) -> float:
    cursor = await conn.execute("SELECT cash_balance FROM users_profile WHERE id = 'default'")
    row = await cursor.fetchone()
    cash_balance = row["cash_balance"]

    now = datetime.now(timezone.utc).isoformat()

    if side == "buy":
        cost = quantity * price
        if cost > cash_balance:
            raise ValueError(f"Insufficient cash: need {cost:.2f}, have {cash_balance:.2f}")

        new_cash = cash_balance - cost

        cursor = await conn.execute(
            "SELECT quantity, avg_cost FROM positions WHERE ticker = ?", (ticker,)
        )
        existing = await cursor.fetchone()

        if existing:
            old_qty = existing["quantity"]
            old_avg = existing["avg_cost"]
            new_qty = old_qty + quantity
            new_avg = (old_qty * old_avg + quantity * price) / new_qty
            await conn.execute(
                "UPDATE positions SET quantity = ?, avg_cost = ?, updated_at = ? WHERE ticker = ?",
                (new_qty, new_avg, now, ticker),
            )
        else:
            await conn.execute(
                "INSERT INTO positions (id, ticker, quantity, avg_cost, updated_at) "
                "VALUES (?, ?, ?, ?, ?)",
                (str(uuid.uuid4()), ticker, quantity, price, now),
            )

    elif side == "sell":
        cursor = await conn.execute(
            "SELECT quantity FROM positions WHERE ticker = ?", (ticker,)
        )
        existing = await cursor.fetchone()

        if not existing or existing["quantity"] < quantity:
            owned = existing["quantity"] if existing else 0
            raise ValueError(
                f"Insufficient shares: want to sell {quantity}, own {owned}"
            )

        new_qty = existing["quantity"] - quantity
        new_cash = cash_balance + quantity * price

        if new_qty == 0:
            await conn.execute("DELETE FROM positions WHERE ticker = ?", (ticker,))
        else:
            await conn.execute(
                "UPDATE positions SET quantity = ?, updated_at = ? WHERE ticker = ?",
                (new_qty, now, ticker),
            )
    else:
        raise ValueError(f"Invalid side: {side}")

    await conn.execute(
        "UPDATE users_profile SET cash_balance = ? WHERE id = 'default'", (new_cash,)
    )

    await conn.execute(
        "INSERT INTO trades (id, ticker, side, quantity, price, executed_at) VALUES (?, ?, ?, ?, ?, ?)",
        (str(uuid.uuid4()), ticker, side, quantity, price, now),
    )

    # Calculate total portfolio value for snapshot
    cursor = await conn.execute("SELECT ticker, quantity FROM positions")
    positions = await cursor.fetchall()
    # For snapshot, use current trade price for the traded ticker;
    # other positions' values require external prices, but we only have the trade price here.
    # The API layer should provide a proper snapshot with live prices.
    # For now, record cash + positions at avg_cost as a baseline.
    total_value = new_cash
    cursor2 = await conn.execute("SELECT ticker, quantity, avg_cost FROM positions")
    for pos in await cursor2.fetchall():
        if pos["ticker"] == ticker:
            total_value += pos["quantity"] * price
        else:
            total_value += pos["quantity"] * pos["avg_cost"]

    await conn.execute(
        "INSERT INTO portfolio_snapshots (id, total_value, recorded_at) VALUES (?, ?, ?)",
        (str(uuid.uuid4()), total_value, now),
    )

    await conn.commit()
    return new_cash


async def record_snapshot(conn, total_value: float) -> None:
    now = datetime.now(timezone.utc).isoformat()
    await conn.execute(
        "INSERT INTO portfolio_snapshots (id, total_value, recorded_at) VALUES (?, ?, ?)",
        (str(uuid.uuid4()), total_value, now),
    )
    await conn.commit()


async def get_portfolio_history(conn) -> list[dict]:
    cursor = await conn.execute(
        "SELECT total_value, recorded_at FROM portfolio_snapshots ORDER BY recorded_at"
    )
    return [dict(row) for row in await cursor.fetchall()]
