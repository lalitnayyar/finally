from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db
from app.db.portfolio import execute_trade, get_portfolio, get_portfolio_history, record_snapshot

router = APIRouter(prefix="/api/portfolio", tags=["portfolio"])


class TradeRequest(BaseModel):
    ticker: str
    side: str
    quantity: float


@router.get("")
async def get_portfolio_view(request: Request):
    db_path = request.app.state.db_path
    cache = request.app.state.cache

    async with get_db(db_path) as conn:
        portfolio = await get_portfolio(conn)

    cash_balance = portfolio["cash_balance"]
    positions = portfolio["positions"]

    enriched = []
    total_value = cash_balance
    unrealized_pnl_total = 0.0

    for pos in positions:
        ticker = pos["ticker"]
        quantity = pos["quantity"]
        avg_cost = pos["avg_cost"]
        current_price = cache.get_price(ticker) or avg_cost
        unrealized_pnl = (current_price - avg_cost) * quantity
        pct_change = ((current_price - avg_cost) / avg_cost * 100) if avg_cost else 0.0
        position_value = current_price * quantity

        total_value += position_value
        unrealized_pnl_total += unrealized_pnl

        enriched.append({
            "ticker": ticker,
            "quantity": quantity,
            "avg_cost": round(avg_cost, 2),
            "current_price": round(current_price, 2),
            "unrealized_pnl": round(unrealized_pnl, 2),
            "pct_change": round(pct_change, 2),
        })

    return {
        "cash_balance": round(cash_balance, 2),
        "total_value": round(total_value, 2),
        "positions": enriched,
        "unrealized_pnl_total": round(unrealized_pnl_total, 2),
    }


@router.post("/trade")
async def trade(body: TradeRequest, request: Request):
    ticker = body.ticker.upper().strip()
    side = body.side.lower().strip()
    quantity = body.quantity

    if side not in ("buy", "sell"):
        raise HTTPException(status_code=400, detail="Side must be 'buy' or 'sell'")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="Quantity must be positive")

    db_path = request.app.state.db_path
    cache = request.app.state.cache

    current_price = cache.get_price(ticker)
    if current_price is None:
        raise HTTPException(status_code=400, detail=f"No price available for {ticker}")

    try:
        async with get_db(db_path) as conn:
            await execute_trade(conn, ticker, side, quantity, current_price)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Record a post-trade snapshot using live prices from cache
    async with get_db(db_path) as conn:
        portfolio = await get_portfolio(conn)
        cash = portfolio["cash_balance"]
        total = cash + sum(
            (cache.get_price(p["ticker"]) or p["avg_cost"]) * p["quantity"]
            for p in portfolio["positions"]
        )
        await record_snapshot(conn, total)

    return {
        "ticker": ticker,
        "side": side,
        "quantity": quantity,
        "price": current_price,
        "cash_balance": round(cash, 2),
    }


@router.get("/history")
async def portfolio_history(request: Request):
    db_path = request.app.state.db_path
    async with get_db(db_path) as conn:
        return await get_portfolio_history(conn)
