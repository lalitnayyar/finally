"use client";

import type { ConnectionStatus } from "../types";

interface HeaderProps {
  totalValue: number;
  cashBalance: number;
  status: ConnectionStatus;
}

const statusColors: Record<ConnectionStatus, string> = {
  connected: "bg-green",
  reconnecting: "bg-accent-yellow",
  disconnected: "bg-red",
};

export default function Header({ totalValue, cashBalance, status }: HeaderProps) {
  return (
    <header className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-card">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold text-accent-yellow tracking-wide">FinAlly</h1>
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${statusColors[status]}`} />
          <span className="text-xs text-text-secondary">{status}</span>
        </div>
      </div>
      <div className="flex items-center gap-6">
        <div>
          <span className="text-xs text-text-secondary mr-2">Portfolio</span>
          <span className="font-mono font-semibold text-text-primary tabular-nums">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <div>
          <span className="text-xs text-text-secondary mr-2">Cash</span>
          <span className="font-mono font-semibold text-text-primary tabular-nums">
            ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    </header>
  );
}
