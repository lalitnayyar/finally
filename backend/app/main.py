import logging
import os
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import find_dotenv, load_dotenv
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from app.db import get_db, init_db
from app.db.watchlist import get_watchlist
from app.llm import chat_router
from app.llm.chat import validate_chat_environment
from app.market import (
    PriceCache,
    create_market_data_source,
    create_prices_router,
    create_stream_router,
)
from app.market.seed_prices import SEED_PRICES
from app.routes.health import router as health_router
from app.routes.portfolio import router as portfolio_router
from app.routes.watchlist import router as watchlist_router

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    dotenv_path = find_dotenv(filename=".env", usecwd=True)
    if dotenv_path:
        load_dotenv(dotenv_path, override=False)

    validate_chat_environment()

    db_path = os.environ.get("DB_PATH", "db/finally.db")
    init_db(db_path)
    logger.info("Database initialized at %s", db_path)

    cache = PriceCache()

    async with get_db(db_path) as conn:
        tickers = await get_watchlist(conn)

    # Pre-seed cache with known prices so API calls work immediately on startup
    for ticker in tickers:
        cache.update(ticker, SEED_PRICES.get(ticker, 100.0))

    source = create_market_data_source(cache)
    await source.start(tickers)
    logger.info("Market data source started with tickers: %s", tickers)
    if os.environ.get("MASSIVE_API_KEY", "").strip():
        logger.info("Runtime market mode: Massive API")
    else:
        logger.info("Runtime market mode: simulator default")

    app.state.cache = cache
    app.state.source = source
    app.state.db_path = db_path

    # Mount cache-dependent routers after cache is ready
    app.include_router(create_stream_router(cache))
    app.include_router(create_prices_router(cache))

    # Mount static files AFTER all API routers so /api/* routes are not shadowed
    static_dir = Path(__file__).resolve().parent.parent / "static"
    if static_dir.is_dir():
        app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")

    yield

    await source.stop()
    logger.info("Market data source stopped")


app = FastAPI(title="FinAlly", lifespan=lifespan)

app.include_router(health_router)
app.include_router(watchlist_router)
app.include_router(portfolio_router)
app.include_router(chat_router)
