import logging

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app.db import get_db
from app.db.portfolio import get_portfolio
from app.db.watchlist import get_watchlist

from .chat import (
    append_to_history,
    build_system_prompt,
    call_llm,
    execute_llm_actions,
    get_conversation_history,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["chat"])


class ChatRequest(BaseModel):
    message: str


@router.post("/chat")
async def chat(request: Request, body: ChatRequest):
    try:
        db_path = request.app.state.db_path
        cache = request.app.state.cache

        async with get_db(db_path) as conn:
            portfolio = await get_portfolio(conn)
            watchlist_tickers = await get_watchlist(conn)

            positions_with_prices = []
            for pos in portfolio["positions"]:
                current_price = cache.get_price(pos["ticker"])
                if current_price is not None:
                    unrealized_pnl = (current_price - pos["avg_cost"]) * pos["quantity"]
                    pnl_pct = ((current_price / pos["avg_cost"]) - 1) * 100
                else:
                    current_price = pos["avg_cost"]
                    unrealized_pnl = 0.0
                    pnl_pct = 0.0
                positions_with_prices.append({
                    "ticker": pos["ticker"],
                    "quantity": pos["quantity"],
                    "avg_cost": pos["avg_cost"],
                    "current_price": current_price,
                    "unrealized_pnl": round(unrealized_pnl, 2),
                    "pnl_pct": round(pnl_pct, 2),
                })

            watchlist_with_prices = []
            for ticker in watchlist_tickers:
                price = cache.get_price(ticker)
                watchlist_with_prices.append({"ticker": ticker, "price": price})

            total_value = portfolio["cash_balance"]
            for pos in positions_with_prices:
                total_value += pos["current_price"] * pos["quantity"]

            portfolio_context = {
                "cash_balance": portfolio["cash_balance"],
                "total_value": round(total_value, 2),
                "positions": positions_with_prices,
                "watchlist": watchlist_with_prices,
            }

            system_prompt = build_system_prompt(portfolio_context)
            history = get_conversation_history()
            messages = [{"role": "system", "content": system_prompt}]
            messages.extend(history)
            messages.append({"role": "user", "content": body.message})

            llm_response = call_llm(messages)

            execution_results = await execute_llm_actions(llm_response, conn, cache)

            append_to_history("user", body.message)
            append_to_history("assistant", llm_response.message)

        return {
            "message": llm_response.message,
            "trades": [t.model_dump() for t in llm_response.trades],
            "watchlist_changes": [w.model_dump() for w in llm_response.watchlist_changes],
            "execution_results": execution_results,
        }

    except Exception:
        logger.exception("Chat endpoint error")
        return {
            "message": "Sorry, I'm having trouble connecting right now. Please try again in a moment.",
            "trades": [],
            "watchlist_changes": [],
            "execution_results": [],
        }
