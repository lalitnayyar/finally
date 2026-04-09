"use client";

import type { Position } from "../types";

interface PositionsTableProps {
  positions: Position[];
}

export default function PositionsTable({ positions }: PositionsTableProps) {
  if (positions.length === 0) {
    return (
      <div className="text-text-secondary text-xs p-3 text-center">
        No positions yet. Make a trade to get started.
      </div>
    );
  }

  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-text-secondary border-b border-border">
            <th className="text-left py-1.5 px-2 font-normal">Ticker</th>
            <th className="text-right py-1.5 px-2 font-normal">Qty</th>
            <th className="text-right py-1.5 px-2 font-normal">Avg Cost</th>
            <th className="text-right py-1.5 px-2 font-normal">Price</th>
            <th className="text-right py-1.5 px-2 font-normal">P&L</th>
            <th className="text-right py-1.5 px-2 font-normal">%</th>
          </tr>
        </thead>
        <tbody>
          {positions.map((pos) => (
            <tr key={pos.ticker} className="border-b border-border hover:bg-bg-hover">
              <td className="py-1.5 px-2 font-mono font-semibold">{pos.ticker}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">{pos.quantity}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">${pos.avg_cost.toFixed(2)}</td>
              <td className="py-1.5 px-2 text-right font-mono tabular-nums">${pos.current_price.toFixed(2)}</td>
              <td className={`py-1.5 px-2 text-right font-mono tabular-nums ${
                pos.unrealized_pnl > 0 ? "text-green" : pos.unrealized_pnl < 0 ? "text-red" : "text-text-secondary"
              }`}>
                {pos.unrealized_pnl > 0 ? "+" : ""}${pos.unrealized_pnl.toFixed(2)}
              </td>
              <td className={`py-1.5 px-2 text-right font-mono tabular-nums ${
                pos.pct_change > 0 ? "text-green" : pos.pct_change < 0 ? "text-red" : "text-text-secondary"
              }`}>
                {pos.pct_change > 0 ? "+" : ""}{pos.pct_change.toFixed(2)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
