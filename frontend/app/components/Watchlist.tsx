"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PriceUpdate, WatchlistItem } from "../types";
import Sparkline from "./Sparkline";

interface WatchlistProps {
  prices: Record<string, PriceUpdate>;
  selectedTicker: string | null;
  onSelectTicker: (ticker: string) => void;
  onWatchlistChange: () => void;
}

export default function Watchlist({ prices, selectedTicker, onSelectTicker, onWatchlistChange }: WatchlistProps) {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [newTicker, setNewTicker] = useState("");
  const [priceHistories, setPriceHistories] = useState<Record<string, number[]>>({});
  const flashRefs = useRef<Record<string, string>>({});

  const fetchWatchlist = useCallback(async () => {
    try {
      const res = await fetch("/api/watchlist");
      if (res.ok) {
        setItems(await res.json());
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchWatchlist();
  }, [fetchWatchlist]);

  // Update price histories from SSE
  useEffect(() => {
    setPriceHistories((prev) => {
      const next = { ...prev };
      for (const [ticker, update] of Object.entries(prices)) {
        const history = next[ticker] ? [...next[ticker]] : [];
        history.push(update.price);
        if (history.length > 50) history.shift();
        next[ticker] = history;
      }
      return next;
    });
  }, [prices]);

  // Track flash state
  useEffect(() => {
    const newFlashes: Record<string, string> = {};
    for (const [ticker, update] of Object.entries(prices)) {
      if (update.direction === "up") newFlashes[ticker] = "flash-green";
      else if (update.direction === "down") newFlashes[ticker] = "flash-red";
    }
    flashRefs.current = newFlashes;
  }, [prices]);

  const addTicker = async () => {
    const ticker = newTicker.trim().toUpperCase();
    if (!ticker) return;
    await fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticker }),
    });
    setNewTicker("");
    fetchWatchlist();
    onWatchlistChange();
  };

  const removeTicker = async (ticker: string) => {
    await fetch(`/api/watchlist/${ticker}`, { method: "DELETE" });
    fetchWatchlist();
    onWatchlistChange();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 p-2 border-b border-border">
        <input
          type="text"
          name="watchlist-symbol"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          data-lpignore="true"
          data-1p-ignore="true"
          value={newTicker}
          onChange={(e) => setNewTicker(e.target.value.toUpperCase())}
          onKeyDown={(e) => e.key === "Enter" && addTicker()}
          placeholder="Add ticker"
          className="flex-1 bg-bg-primary border border-border rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-secondary focus:outline-none focus:border-blue-primary"
        />
        <button
          onClick={addTicker}
          className="bg-blue-primary text-white text-xs px-2 py-1 rounded hover:opacity-80"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <table className="w-full text-xs" data-testid="watchlist-table">
          <thead>
            <tr className="text-text-secondary border-b border-border">
              <th className="text-left py-1 px-2 font-normal">Ticker</th>
              <th className="text-right py-1 px-2 font-normal">Price</th>
              <th className="text-right py-1 px-2 font-normal">Chg%</th>
              <th className="py-1 px-1 font-normal w-16">Chart</th>
              <th className="py-1 px-1 font-normal w-6"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const livePrice = prices[item.ticker];
              const price = livePrice?.price ?? item.price;
              const changePct = livePrice?.change_percent ?? item.change_percent;
              const direction = livePrice?.direction ?? item.direction;
              const isSelected = selectedTicker === item.ticker;
              const flashClass = flashRefs.current[item.ticker] || "";

              return (
                <tr
                  key={item.ticker}
                  onClick={() => onSelectTicker(item.ticker)}
                  className={`cursor-pointer border-b border-border hover:bg-bg-hover transition-colors ${
                    isSelected ? "bg-bg-hover" : ""
                  } ${flashClass}`}
                >
                  <td className="py-1.5 px-2 font-mono font-semibold">{item.ticker}</td>
                  <td className={`py-1.5 px-2 text-right font-mono ${
                    direction === "up" ? "text-green" : direction === "down" ? "text-red" : "text-text-primary"
                  }`}>
                    {price != null ? price.toFixed(2) : "—"}
                  </td>
                  <td className={`py-1.5 px-2 text-right font-mono ${
                    (changePct ?? 0) > 0 ? "text-green" : (changePct ?? 0) < 0 ? "text-red" : "text-text-secondary"
                  }`}>
                    {changePct != null ? `${changePct > 0 ? "+" : ""}${changePct.toFixed(2)}%` : "—"}
                  </td>
                  <td className="py-1.5 px-1">
                    <Sparkline data={priceHistories[item.ticker] || []} />
                  </td>
                  <td className="py-1.5 px-1">
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTicker(item.ticker); }}
                      className="text-text-secondary hover:text-red text-xs"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
