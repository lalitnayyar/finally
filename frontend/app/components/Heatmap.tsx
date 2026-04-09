"use client";

import type { Position } from "../types";

interface HeatmapProps {
  positions: Position[];
}

export default function Heatmap({ positions }: HeatmapProps) {
  if (positions.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-text-secondary text-xs">
        No positions to display
      </div>
    );
  }

  const totalValue = positions.reduce((sum, p) => sum + p.current_price * p.quantity, 0);

  const single = positions.length === 1;

  return (
    <div
      className={`p-2 h-full min-h-0 overflow-auto ${
        single ? "flex items-center justify-center" : "flex flex-wrap gap-1 content-start"
      }`}
    >
      {positions.map((pos) => {
        const weight = totalValue > 0 ? (pos.current_price * pos.quantity) / totalValue : 0;
        const minWidth = Math.max(60, weight * 400);
        const bgColor = pos.pct_change > 0
          ? `rgba(63, 185, 80, ${Math.min(0.6, Math.abs(pos.pct_change) / 10 + 0.15)})`
          : pos.pct_change < 0
          ? `rgba(248, 81, 73, ${Math.min(0.6, Math.abs(pos.pct_change) / 10 + 0.15)})`
          : "rgba(139, 148, 158, 0.15)";

        return (
          <div
            key={pos.ticker}
            className={`rounded px-3 py-2 flex flex-col items-center justify-center border border-border ${
              single ? "w-[min(11rem,90%)] aspect-[4/3] max-h-[min(100%,8rem)] shrink-0" : ""
            }`}
            style={
              single
                ? { backgroundColor: bgColor }
                : {
                    backgroundColor: bgColor,
                    minWidth: `${minWidth}px`,
                    flex: `${weight} 1 0`,
                  }
            }
          >
            <span className="font-mono font-bold text-xs">{pos.ticker}</span>
            <span className={`font-mono text-[10px] ${
              pos.pct_change > 0 ? "text-green" : pos.pct_change < 0 ? "text-red" : "text-text-secondary"
            }`}>
              {pos.pct_change > 0 ? "+" : ""}{pos.pct_change.toFixed(1)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
