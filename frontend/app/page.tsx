"use client";

import dynamic from "next/dynamic";
import { useState, useCallback, useEffect, useMemo } from "react";
import { useSSE } from "./hooks/useSSE";
import { usePortfolio } from "./hooks/usePortfolio";
import Header from "./components/Header";
import Watchlist from "./components/Watchlist";
import PositionsTable from "./components/PositionsTable";
import Heatmap from "./components/Heatmap";
import TradeBar from "./components/TradeBar";
import ChatPanel from "./components/ChatPanel";
import type { PortfolioSnapshot } from "./types";

const MainChart = dynamic(() => import("./components/MainChart"), {
  ssr: false,
  loading: () => (
    <div className="flex flex-col flex-1 min-h-[280px] min-w-0 rounded border border-border bg-bg-card animate-pulse" />
  ),
});

const PnlChart = dynamic(() => import("./components/PnlChart"), { ssr: false });

export default function Home() {
  const { prices, status } = useSSE();
  const { portfolio, history, fetchPortfolio, fetchHistory } = usePortfolio();
  const [selectedTicker, setSelectedTicker] = useState<string | null>("AAPL");

  // Refresh portfolio on SSE updates (throttled)
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPortfolio();
    }, 3000);
    return () => clearInterval(interval);
  }, [fetchPortfolio]);

  const handleTrade = useCallback(() => {
    fetchPortfolio();
    fetchHistory();
  }, [fetchPortfolio, fetchHistory]);

  const handleAction = useCallback(() => {
    fetchPortfolio();
    fetchHistory();
  }, [fetchPortfolio, fetchHistory]);

  const cashBalance =
    portfolio?.cash_balance != null
      ? Math.round(portfolio.cash_balance * 100) / 100
      : 10000;

  // Enrich positions with live SSE prices so they update every tick
  const positions = (portfolio?.positions ?? []).map((pos) => {
    const live = prices[pos.ticker];
    if (!live) return pos;
    const currentPrice = Math.round(live.price * 100) / 100;
    const unrealized_pnl =
      Math.round((currentPrice - pos.avg_cost) * pos.quantity * 100) / 100;
    const pct_change = pos.avg_cost
      ? Math.round(((currentPrice - pos.avg_cost) / pos.avg_cost) * 100 * 100) / 100
      : 0;
    return { ...pos, current_price: currentPrice, unrealized_pnl, pct_change };
  });

  const totalValue = (() => {
    const raw =
      cashBalance + positions.reduce((sum, p) => sum + p.current_price * p.quantity, 0);
    return Math.round(raw * 100) / 100;
  })();

  const pnlHistory: PortfolioSnapshot[] = useMemo(() => {
    if (history.length > 0) return history;
    if (portfolio === null) return [];
    const v = totalValue;
    const now = Date.now();
    return [
      { total_value: v, recorded_at: new Date(now - 86400000).toISOString() },
      { total_value: v, recorded_at: new Date(now).toISOString() },
    ];
  }, [history, portfolio, totalValue]);

  return (
    <div className="flex flex-col h-screen bg-bg-primary">
      <Header totalValue={totalValue} cashBalance={cashBalance} status={status} />

      <div className="flex flex-1 min-h-0">
        {/* Left: Watchlist */}
        <div className="w-72 border-r border-border bg-bg-card flex-shrink-0">
          <Watchlist
            prices={prices}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onWatchlistChange={handleAction}
          />
        </div>

        {/* Center: Chart + Portfolio */}
        <div className="flex flex-1 flex-col min-w-0 min-h-0">
          {/* Main Chart — client-only (TradingView canvas + window) */}
          <div className="flex min-h-[280px] flex-1 flex-col">
            <MainChart ticker={selectedTicker} prices={prices} />
          </div>

          {/* Trade Bar */}
          <TradeBar onTrade={handleTrade} selectedTicker={selectedTicker} />

          {/* Bottom: Portfolio Section */}
          <div className="h-64 border-t border-border flex">
            {/* Heatmap */}
            <div className="w-1/3 border-r border-border">
              <div className="px-2 py-1 border-b border-border text-xs text-text-secondary font-semibold">
                Portfolio Heatmap
              </div>
              <Heatmap positions={positions} />
            </div>

            {/* P&L Chart */}
            <div className="flex min-h-0 w-1/3 flex-col border-r border-border">
              <div className="px-2 py-1 border-b border-border text-xs text-text-secondary font-semibold">
                Portfolio Value
              </div>
              <div className="flex min-h-[160px] flex-1">
                <PnlChart history={pnlHistory} emptyHint={portfolio === null} />
              </div>
            </div>

            {/* Positions Table */}
            <div className="w-1/3 flex flex-col">
              <div className="px-2 py-1 border-b border-border text-xs text-text-secondary font-semibold">
                Positions
              </div>
              <div className="flex-1 overflow-auto">
                <PositionsTable positions={positions} />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Chat Panel */}
        <div className="w-80 flex-shrink-0">
          <ChatPanel onAction={handleAction} />
        </div>
      </div>
    </div>
  );
}
