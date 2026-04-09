"use client";

import { useState, useEffect, useCallback } from "react";

interface TradeBarProps {
  onTrade: () => void;
  selectedTicker?: string | null;
}

const TICKER_RE = /^[A-Z]{1,5}$/;

function sanitizeQty(raw: string): string {
  let s = raw.replace(/[^0-9.]/g, "");
  const dot = s.indexOf(".");
  if (dot === -1) return s;
  return s.slice(0, dot + 1) + s.slice(dot + 1).replace(/\./g, "");
}

export default function TradeBar({ onTrade, selectedTicker }: TradeBarProps) {
  const [overrideSymbol, setOverrideSymbol] = useState(false);
  const [manualTicker, setManualTicker] = useState("");
  const [quantity, setQuantity] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setOverrideSymbol(false);
    setManualTicker("");
  }, [selectedTicker]);

  const symbolToTrade = overrideSymbol
    ? manualTicker.trim().toUpperCase()
    : (selectedTicker ?? "");

  const executeTrade = useCallback(
    async (side: "buy" | "sell") => {
      const t = symbolToTrade.trim().toUpperCase();
      const q = parseFloat(quantity);
      if (!t) {
        setError(overrideSymbol ? "Enter a valid symbol" : "Select a ticker in the watchlist");
        return;
      }
      if (!TICKER_RE.test(t)) {
        setError("Symbol must be 1–5 letters");
        return;
      }
      if (!q || q <= 0 || Number.isNaN(q)) {
        setError("Enter a valid quantity");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const res = await fetch("/api/portfolio/trade", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ticker: t, side, quantity: q }),
        });

        if (!res.ok) {
          const data = await res.json();
          setError(data.detail || "Trade failed");
        } else {
          setQuantity("");
          setManualTicker("");
          setOverrideSymbol(false);
          onTrade();
        }
      } catch {
        setError("Network error");
      } finally {
        setLoading(false);
      }
    },
    [symbolToTrade, quantity, overrideSymbol, onTrade]
  );

  return (
    <div className="relative flex flex-wrap items-center gap-2 p-2 border-t border-border bg-bg-card">
      {/* Honeypot: absorbs browser/extension autofill before real fields */}
      <input
        type="text"
        name="company"
        autoComplete="off"
        tabIndex={-1}
        aria-hidden
        className="absolute h-0 w-0 overflow-hidden opacity-0 pointer-events-none"
        readOnly
      />

      <div className="flex items-center gap-2 min-w-0">
        <span className="text-text-secondary text-xs shrink-0">Symbol</span>
        {overrideSymbol ? (
          <input
            type="text"
            data-testid="trade-override-ticker"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            data-lpignore="true"
            data-1p-ignore="true"
            value={manualTicker}
            onChange={(e) => setManualTicker(e.target.value.toUpperCase())}
            placeholder="Ticker"
            className="w-24 min-w-0 bg-bg-primary border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-blue-primary"
          />
        ) : (
          <span
            className="font-mono font-semibold text-sm min-w-[3.5rem] text-text-primary"
            data-testid="trade-selected-symbol"
          >
            {selectedTicker ?? "—"}
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            setOverrideSymbol((o) => !o);
            setManualTicker("");
            setError("");
          }}
          className="text-xs text-blue-primary hover:underline shrink-0"
        >
          {overrideSymbol ? "Use watchlist" : "Other symbol"}
        </button>
      </div>

      <input
        key={`qty-${selectedTicker ?? "x"}`}
        type="text"
        inputMode="decimal"
        name="trade-qty-field"
        autoComplete="off"
        autoCorrect="off"
        data-lpignore="true"
        data-1p-ignore="true"
        value={quantity}
        onChange={(e) => setQuantity(sanitizeQty(e.target.value))}
        placeholder="Qty"
        className="w-20 bg-bg-primary border border-border rounded px-2 py-1.5 text-xs font-mono text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-blue-primary"
      />
      <button
        type="button"
        onClick={() => executeTrade("buy")}
        disabled={loading}
        className="bg-blue-primary text-white text-xs font-semibold px-3 py-1.5 rounded hover:opacity-80 disabled:opacity-50"
      >
        Buy
      </button>
      <button
        type="button"
        onClick={() => executeTrade("sell")}
        disabled={loading}
        className="bg-purple-secondary text-white text-xs font-semibold px-3 py-1.5 rounded hover:opacity-80 disabled:opacity-50"
      >
        Sell
      </button>
      {error && <span className="text-red text-xs">{error}</span>}
    </div>
  );
}
