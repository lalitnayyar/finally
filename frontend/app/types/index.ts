export interface PriceUpdate {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;
  change: number;
  change_percent: number;
  direction: "up" | "down" | "flat";
}

export interface WatchlistItem {
  ticker: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  direction: "up" | "down" | "flat";
}

export interface Position {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  pct_change: number;
}

export interface Portfolio {
  cash_balance: number;
  total_value: number;
  positions: Position[];
  unrealized_pnl_total: number;
}

export interface TradeRequest {
  ticker: string;
  side: "buy" | "sell";
  quantity: number;
}

export interface TradeResponse {
  ticker: string;
  side: string;
  quantity: number;
  price: number;
  cash_balance: number;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  trades?: TradeAction[];
  watchlist_changes?: WatchlistAction[];
}

export interface TradeAction {
  ticker: string;
  side: string;
  quantity: number;
}

export interface WatchlistAction {
  ticker: string;
  action: "add" | "remove";
}

export interface ChatResponse {
  message: string;
  trades: TradeAction[];
  watchlist_changes: WatchlistAction[];
  execution_results: string[];
}

export interface PortfolioSnapshot {
  id?: string;
  total_value: number;
  recorded_at: string;
}

export type ConnectionStatus = "connected" | "reconnecting" | "disconnected";
