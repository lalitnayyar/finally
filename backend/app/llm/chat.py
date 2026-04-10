import json
import os
import re

from litellm import completion

from app.db.portfolio import execute_trade
from app.db.watchlist import add_ticker, remove_ticker

from .schema import LLMResponse

MODEL = "openrouter/openai/gpt-oss-120b"
EXTRA_BODY = {"provider": {"order": ["cerebras"]}}
MISSING_OPENROUTER_MESSAGE = (
    "OPENROUTER_API_KEY is required to start FinAlly. "
    "Copy .env.example to .env and set OPENROUTER_API_KEY."
)

_conversation_history: list[dict] = []


def build_system_prompt(portfolio_context: dict) -> str:
    return f"""You are FinAlly, an AI trading assistant for a simulated trading workstation.

You help users analyze their portfolio, suggest trades, execute trades, and manage their watchlist.
Be concise and data-driven. Always respond with valid structured JSON.

Current Portfolio Context:
- Cash Balance: ${portfolio_context["cash_balance"]:,.2f}
- Total Portfolio Value: ${portfolio_context["total_value"]:,.2f}
- Positions: {json.dumps(portfolio_context["positions"], indent=2)}
- Watchlist (with live prices): {json.dumps(portfolio_context["watchlist"], indent=2)}

You can execute trades and manage the watchlist by including them in your response.
For trades, specify ticker, side ("buy" or "sell"), and quantity.
For watchlist changes, specify ticker and action ("add" or "remove").

Important: Write your message in plain text only. No markdown, no bullet symbols, no asterisks, no headers.
Remember: This is a simulated environment with virtual money. Be helpful and proactive."""


def call_llm(messages: list[dict]) -> LLMResponse:
    if os.environ.get("LLM_MOCK", "").lower() == "true":
        return LLMResponse(
            message="This is a mock response. Your portfolio looks great!",
            trades=[],
            watchlist_changes=[],
        )

    validate_chat_environment()

    response = completion(
        model=MODEL,
        messages=messages,
        response_format=LLMResponse,
        extra_body=EXTRA_BODY,
        timeout=20,
    )
    raw = response.choices[0].message.content
    # Strip thinking tokens and markdown code fences if present
    raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw).rstrip("` \n")
    return LLMResponse.model_validate_json(raw)


_VALID_TICKER = re.compile(r"^[A-Z]{1,5}$")


def _is_valid_ticker(ticker: str) -> bool:
    return bool(_VALID_TICKER.match(ticker.upper()))


async def execute_llm_actions(response: LLMResponse, db_conn, cache, source) -> list[str]:
    results = []

    for trade in response.trades:
        ticker = trade.ticker.upper().strip()
        if not _is_valid_ticker(ticker):
            continue  # silently skip invalid tickers from LLM hallucination
        if trade.side not in ("buy", "sell"):
            continue
        if not (0 < trade.quantity <= 10000):
            continue
        try:
            price = cache.get_price(ticker)
            if price is None:
                results.append(f"Trade failed for {ticker}: no price available")
                continue
            new_cash = await execute_trade(db_conn, ticker, trade.side, trade.quantity, price)
            results.append(
                f"{trade.side.upper()} {trade.quantity} {ticker} "
                f"@ ${price:.2f} — cash now ${new_cash:,.2f}"
            )
        except ValueError as e:
            results.append(f"Trade failed for {ticker}: {e}")

    for change in response.watchlist_changes:
        ticker = change.ticker.upper().strip()
        if not _is_valid_ticker(ticker):
            continue  # skip hallucinated tickers
        if change.action == "add":
            added = await add_ticker(db_conn, ticker)
            if added:
                await source.add_ticker(ticker)
            results.append(
                f"Added {ticker} to watchlist" if added else f"{ticker} already in watchlist"
            )
        elif change.action == "remove":
            removed = await remove_ticker(db_conn, ticker)
            if removed:
                await source.remove_ticker(ticker)
            results.append(
                f"Removed {ticker} from watchlist" if removed else f"{ticker} not in watchlist"
            )

    return results


def get_conversation_history(max_messages: int = 20) -> list[dict]:
    return _conversation_history[-max_messages:]


def append_to_history(role: str, content: str) -> None:
    _conversation_history.append({"role": role, "content": content})


def validate_chat_environment() -> None:
    if os.environ.get("LLM_MOCK", "").lower() == "true":
        return

    if not os.environ.get("OPENROUTER_API_KEY", "").strip():
        raise RuntimeError(MISSING_OPENROUTER_MESSAGE)
