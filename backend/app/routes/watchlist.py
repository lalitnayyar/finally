import re

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.db import get_db
from app.db.watchlist import add_ticker, get_watchlist, remove_ticker

_VALID_TICKER = re.compile(r"^[A-Z]{1,5}$")

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class AddTickerRequest(BaseModel):
    ticker: str


@router.get("")
async def list_watchlist(request: Request):
    db_path = request.app.state.db_path
    cache = request.app.state.cache

    async with get_db(db_path) as conn:
        tickers = await get_watchlist(conn)

    result = []
    for ticker in tickers:
        update = cache.get(ticker)
        result.append(
            {
                "ticker": ticker,
                "price": update.price if update else None,
                "change": update.change if update else None,
                "change_percent": update.change_percent if update else None,
                "direction": update.direction if update else "flat",
            }
        )
    return result


@router.post("")
async def add_watchlist_ticker(body: AddTickerRequest, request: Request):
    ticker = body.ticker.upper().strip()
    if not _VALID_TICKER.match(ticker):
        raise HTTPException(status_code=400, detail="Invalid ticker: must be 1-5 uppercase letters")
    db_path = request.app.state.db_path
    source = request.app.state.source

    async with get_db(db_path) as conn:
        added = await add_ticker(conn, ticker)

    if added:
        await source.add_ticker(ticker)

    return {"ticker": ticker, "added": added}


@router.delete("/{ticker}")
async def delete_watchlist_ticker(ticker: str, request: Request):
    ticker = ticker.upper().strip()
    db_path = request.app.state.db_path
    source = request.app.state.source

    async with get_db(db_path) as conn:
        removed = await remove_ticker(conn, ticker)

    if removed:
        await source.remove_ticker(ticker)

    return {"ticker": ticker, "removed": removed}
