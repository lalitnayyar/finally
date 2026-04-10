'use client';

import { FormEvent, useEffect, useState } from 'react';

type ConnectionState = 'connected' | 'reconnecting' | 'disconnected';

type PricePoint = {
  ticker: string;
  price: number;
  previous_price: number;
  timestamp: number;
  change: number;
  change_percent: number;
  direction: 'up' | 'down' | 'flat';
};

type WatchlistRow = {
  ticker: string;
  price: number | null;
  change: number | null;
  change_percent: number | null;
  direction: 'up' | 'down' | 'flat';
};

type Position = {
  ticker: string;
  quantity: number;
  avg_cost: number;
  current_price: number;
  unrealized_pnl: number;
  pct_change: number;
};

type PortfolioResponse = {
  cash_balance: number;
  total_value: number;
  positions: Position[];
  unrealized_pnl_total: number;
};

type PortfolioHistoryPoint = {
  total_value: number;
  recorded_at: string;
};

type ChatResponse = {
  message: string;
  execution_results?: string[];
};

type ChatMessage = {
  role: 'assistant' | 'user';
  content: string;
};

const EMPTY_PORTFOLIO: PortfolioResponse = {
  cash_balance: 0,
  total_value: 0,
  positions: [],
  unrealized_pnl_total: 0,
};

const DEFAULT_CHART_MESSAGE =
  'Select a symbol from the watchlist to inspect its recent price history.';

function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatSignedPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '--';
  }

  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(2)}%`;
}

function formatSignedCurrency(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${formatCurrency(value)}`;
}

function buildLinePath(values: number[], width: number, height: number): string {
  if (!values.length) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function Sparkline({
  values,
  direction,
  emptyLabel,
}: {
  values: number[];
  direction: 'up' | 'down' | 'flat';
  emptyLabel?: string;
}) {
  if (!values.length) {
    return <span className="empty-chart-label">{emptyLabel ?? 'No data'}</span>;
  }

  return (
    <svg viewBox="0 0 100 28" className="sparkline" preserveAspectRatio="none" aria-hidden="true">
      <path d={buildLinePath(values, 100, 28)} className={`sparkline-path ${direction}`} />
    </svg>
  );
}

function MainChart({ ticker, points }: { ticker: string; points: PricePoint[] }) {
  if (!points.length) {
    return (
      <div className="empty-state chart-empty">
        <p>{DEFAULT_CHART_MESSAGE}</p>
      </div>
    );
  }

  const latest = points[points.length - 1];
  const values = points.map((point) => point.price);

  return (
    <div className="chart-card">
      <div className="chart-card-header">
        <div>
          <p className="eyebrow">Primary Chart</p>
          <h2>{ticker}</h2>
        </div>
        <div className="chart-metrics">
          <span className="chart-price">{formatCurrency(latest.price)}</span>
          <span className={`chart-change ${latest.direction}`}>
            {formatSignedPercent(latest.change_percent)}
          </span>
        </div>
      </div>
      <svg viewBox="0 0 100 40" className="main-chart" preserveAspectRatio="none">
        <defs>
          <linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(236, 173, 10, 0.42)" />
            <stop offset="100%" stopColor="rgba(236, 173, 10, 0.04)" />
          </linearGradient>
        </defs>
        <path
          d={`${buildLinePath(values, 100, 34)} L 100 40 L 0 40 Z`}
          className="main-chart-fill"
        />
        <path d={buildLinePath(values, 100, 34)} className={`main-chart-line ${latest.direction}`} />
      </svg>
      <div className="chart-footer">
        <span>{points.length} points cached</span>
        <span>Updates stream live via SSE</span>
      </div>
    </div>
  );
}

function PortfolioValueChart({ history }: { history: PortfolioHistoryPoint[] }) {
  const values = history.map((point) => point.total_value);

  if (!values.length) {
    return <div className="empty-state">No portfolio snapshots yet</div>;
  }

  return (
    <div className="mini-chart-shell">
      <svg viewBox="0 0 100 44" className="mini-chart" preserveAspectRatio="none">
        <path d={`${buildLinePath(values, 100, 38)} L 100 44 L 0 44 Z`} className="mini-chart-fill" />
        <path d={buildLinePath(values, 100, 38)} className="mini-chart-line" />
      </svg>
    </div>
  );
}

function PortfolioHeatmap({ positions }: { positions: Position[] }) {
  if (!positions.length) {
    return <div className="empty-state">No positions to display</div>;
  }

  const totalValue = positions.reduce((sum, position) => {
    return sum + position.current_price * position.quantity;
  }, 0);

  return (
    <div className="heatmap-grid">
      {positions.map((position) => {
        const value = position.current_price * position.quantity;
        const weight = totalValue > 0 ? Math.max((value / totalValue) * 100, 16) : 16;
        return (
          <div
            key={position.ticker}
            className={`heatmap-tile ${position.unrealized_pnl >= 0 ? 'up' : 'down'}`}
            style={{ flexBasis: `${Math.min(weight, 60)}%` }}
          >
            <span className="heatmap-symbol">{position.ticker}</span>
            <span className="heatmap-value">{formatCurrency(value)}</span>
            <span className="heatmap-pnl">{formatSignedPercent(position.pct_change)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function HomePage() {
  const [connection, setConnection] = useState<ConnectionState>('disconnected');
  const [watchlist, setWatchlist] = useState<WatchlistRow[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioResponse>(EMPTY_PORTFOLIO);
  const [portfolioHistory, setPortfolioHistory] = useState<PortfolioHistoryPoint[]>([]);
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [priceHistory, setPriceHistory] = useState<Record<string, PricePoint[]>>({});
  const [watchlistInput, setWatchlistInput] = useState('');
  const [tradeTicker, setTradeTicker] = useState('AAPL');
  const [tradeQuantity, setTradeQuantity] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [watchlistError, setWatchlistError] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Ask about your portfolio, request analysis, or tell me to make trades.',
    },
  ]);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const response = await fetch(url, init);
    const body = await response.json();

    if (!response.ok) {
      const detail =
        typeof body?.detail === 'string'
          ? body.detail
          : typeof body?.message === 'string'
            ? body.message
            : 'Request failed';
      throw new Error(detail);
    }

    return body as T;
  }

  async function refreshPortfolio(): Promise<void> {
    const [portfolioData, historyData] = await Promise.all([
      fetchJson<PortfolioResponse>('/api/portfolio'),
      fetchJson<PortfolioHistoryPoint[]>('/api/portfolio/history'),
    ]);

    setPortfolio(portfolioData);
    setPortfolioHistory(historyData);
  }

  async function refreshWatchlist(): Promise<void> {
    const rows = await fetchJson<WatchlistRow[]>('/api/watchlist');
    setWatchlist(rows);

    if (rows.length && !rows.some((row) => row.ticker === selectedTicker)) {
      setSelectedTicker(rows[0].ticker);
    }
    if (rows.length && !rows.some((row) => row.ticker === tradeTicker)) {
      setTradeTicker(rows[0].ticker);
    }
  }

  async function loadTickerHistory(ticker: string): Promise<void> {
    const history = await fetchJson<PricePoint[]>(`/api/prices/${ticker}/history`);
    setPriceHistory((current) => ({
      ...current,
      [ticker]: history,
    }));
  }

  useEffect(() => {
    const bootstrap = async () => {
      try {
        await Promise.all([refreshWatchlist(), refreshPortfolio()]);
      } catch {
        setConnection('disconnected');
      }
    };

    bootstrap();
  }, []);

  useEffect(() => {
    if (!selectedTicker) {
      return;
    }

    loadTickerHistory(selectedTicker).catch(() => {
      setPriceHistory((current) => ({ ...current, [selectedTicker]: [] }));
    });
  }, [selectedTicker]);

  useEffect(() => {
    const eventSource = new EventSource('/api/stream/prices');
    setConnection('reconnecting');

    eventSource.onopen = () => {
      setConnection('connected');
    };

    eventSource.onmessage = (event) => {
      setConnection('connected');

      const payload = JSON.parse(event.data) as Record<string, PricePoint>;
      const updates = Object.values(payload);

      setWatchlist((current) =>
        current.map((row) => {
          const update = payload[row.ticker];
          if (!update) {
            return row;
          }

          return {
            ticker: row.ticker,
            price: update.price,
            change: update.change,
            change_percent: update.change_percent,
            direction: update.direction,
          };
        }),
      );

      setPriceHistory((current) => {
        const next = { ...current };

        for (const update of updates) {
          const existing = next[update.ticker] ?? [];
          const deduped =
            existing.length && existing[existing.length - 1]?.timestamp === update.timestamp
              ? existing
              : [...existing, update].slice(-200);
          next[update.ticker] = deduped;
        }

        return next;
      });
    };

    eventSource.onerror = () => {
      setConnection((current) => (current === 'connected' ? 'reconnecting' : 'disconnected'));
    };

    return () => {
      eventSource.close();
    };
  }, []);

  async function handleAddTicker(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setWatchlistError('');

    try {
      const ticker = watchlistInput.toUpperCase().trim();
      if (!ticker) {
        return;
      }

      await fetchJson('/api/watchlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker }),
      });

      setWatchlistInput('');
      await refreshWatchlist();
      await loadTickerHistory(ticker);
    } catch (error) {
      setWatchlistError(error instanceof Error ? error.message : 'Unable to add ticker');
    }
  }

  async function handleRemoveTicker(ticker: string): Promise<void> {
    setWatchlistError('');

    try {
      await fetchJson(`/api/watchlist/${ticker}`, { method: 'DELETE' });
      await refreshWatchlist();
    } catch (error) {
      setWatchlistError(error instanceof Error ? error.message : 'Unable to remove ticker');
    }
  }

  async function handleTrade(side: 'buy' | 'sell'): Promise<void> {
    setTradeError('');

    try {
      const ticker = tradeTicker.toUpperCase().trim();
      const quantity = Number.parseFloat(tradeQuantity);

      await fetchJson('/api/portfolio/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, side, quantity }),
      });

      setTradeQuantity('');
      await refreshPortfolio();
      await refreshWatchlist();
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Unable to execute trade');
    }
  }

  async function handleChat(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const message = chatInput.trim();
    if (!message || chatBusy) {
      return;
    }

    setChatBusy(true);
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setChatInput('');

    try {
      const response = await fetchJson<ChatResponse>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message }),
      });

      const executionText =
        response.execution_results && response.execution_results.length
          ? `\n\n${response.execution_results.join('\n')}`
          : '';

      setMessages((current) => [
        ...current,
        { role: 'assistant', content: `${response.message}${executionText}`.trim() },
      ]);

      await Promise.all([refreshPortfolio(), refreshWatchlist()]);
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: error instanceof Error ? error.message : 'Unable to reach the assistant.',
        },
      ]);
    } finally {
      setChatBusy(false);
    }
  }

  const selectedHistory = priceHistory[selectedTicker] ?? [];

  return (
    <main className="terminal-shell">
      <header className="app-header">
        <div className="brand-block">
          <div>
            <p className="eyebrow">Single-User Trading Workstation</p>
            <h1>FinAlly</h1>
          </div>
          <div className="connection-pill">
            <span className={`connection-dot ${connection}`} />
            <span>{connection}</span>
          </div>
        </div>
        <div className="header-metrics">
          <div className="metric-card">
            <span className="metric-label">Portfolio</span>
            <strong>{formatCurrency(portfolio.total_value)}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Cash</span>
            <strong>{formatCurrency(portfolio.cash_balance)}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Unrealized P&amp;L</span>
            <strong className={portfolio.unrealized_pnl_total >= 0 ? 'up' : 'down'}>
              {formatSignedCurrency(portfolio.unrealized_pnl_total)}
            </strong>
          </div>
        </div>
      </header>

      <div className="workspace">
        <aside className="watchlist-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Market</p>
              <h2>Watchlist</h2>
            </div>
          </div>
          <form className="watchlist-form" onSubmit={handleAddTicker}>
            <input
              type="text"
              name="watchlist-symbol"
              placeholder="Add ticker"
              autoComplete="off"
              value={watchlistInput}
              onChange={(event) => setWatchlistInput(event.target.value.toUpperCase())}
            />
            <button type="submit">+</button>
          </form>
          {watchlistError ? <p className="inline-error">{watchlistError}</p> : null}
          <div className="watchlist-table-wrap">
            <table className="watchlist-table" data-testid="watchlist-table">
              <thead>
                <tr>
                  <th>Ticker</th>
                  <th>Price</th>
                  <th>Chg%</th>
                  <th>Chart</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {watchlist.map((row) => {
                  const sparkValues = (priceHistory[row.ticker] ?? []).map((point) => point.price);
                  return (
                    <tr
                      key={row.ticker}
                      className={selectedTicker === row.ticker ? 'active' : ''}
                      onClick={() => {
                        setSelectedTicker(row.ticker);
                        setTradeTicker(row.ticker);
                      }}
                    >
                      <td>
                        <span className="ticker-cell">{row.ticker}</span>
                      </td>
                      <td className={row.direction}>{formatCurrency(row.price)}</td>
                      <td className={row.direction}>{formatSignedPercent(row.change_percent)}</td>
                      <td>
                        <Sparkline values={sparkValues} direction={row.direction} emptyLabel="..." />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-action"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleRemoveTicker(row.ticker).catch(() => undefined);
                          }}
                          aria-label={`Remove ${row.ticker}`}
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
        </aside>

        <section className="center-column">
          <MainChart ticker={selectedTicker} points={selectedHistory} />

          <section className="trade-strip">
            <div className="trade-label-group">
              <span className="trade-label">Symbol</span>
              <input
                type="text"
                name="trade-symbol"
                value={tradeTicker}
                onChange={(event) => setTradeTicker(event.target.value.toUpperCase())}
                maxLength={5}
              />
            </div>
            <input
              type="text"
              inputMode="decimal"
              name="trade-qty-field"
              placeholder="Qty"
              value={tradeQuantity}
              onChange={(event) => setTradeQuantity(event.target.value)}
            />
            <button type="button" className="buy-button" onClick={() => handleTrade('buy')}>
              Buy
            </button>
            <button type="button" className="sell-button" onClick={() => handleTrade('sell')}>
              Sell
            </button>
            {tradeError ? <p className="inline-error">{tradeError}</p> : null}
          </section>

          <section className="portfolio-grid">
            <article className="panel">
              <div className="panel-title">Portfolio Heatmap</div>
              <PortfolioHeatmap positions={portfolio.positions} />
            </article>
            <article className="panel">
              <div className="panel-title">Portfolio Value</div>
              <PortfolioValueChart history={portfolioHistory} />
            </article>
            <article className="panel">
              <div className="panel-title">Positions</div>
              {portfolio.positions.length ? (
                <div className="positions-table-wrap">
                  <table className="positions-table">
                    <thead>
                      <tr>
                        <th>Ticker</th>
                        <th>Qty</th>
                        <th>Avg</th>
                        <th>Current</th>
                        <th>Unrealized</th>
                        <th>%</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.positions.map((position) => (
                        <tr key={position.ticker}>
                          <td>{position.ticker}</td>
                          <td>{position.quantity.toFixed(2)}</td>
                          <td>{formatCurrency(position.avg_cost)}</td>
                          <td>{formatCurrency(position.current_price)}</td>
                          <td className={position.unrealized_pnl >= 0 ? 'up' : 'down'}>
                            {formatSignedCurrency(position.unrealized_pnl)}
                          </td>
                          <td className={position.pct_change >= 0 ? 'up' : 'down'}>
                            {formatSignedPercent(position.pct_change)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="empty-state">No positions yet. Make a trade to get started.</div>
              )}
            </article>
          </section>
        </section>

        <aside className="chat-panel">
          <div className="panel-header">
            <div>
              <p className="eyebrow">Assistant</p>
              <h2>AI Copilot</h2>
            </div>
          </div>
          <div className="chat-log">
            {messages.map((message, index) => (
              <article key={`${message.role}-${index}`} className={`chat-bubble ${message.role}`}>
                <span className="chat-role">{message.role === 'assistant' ? 'FinAlly AI' : 'You'}</span>
                <p>{message.content}</p>
              </article>
            ))}
          </div>
          <form className="chat-form" autoComplete="off" onSubmit={handleChat}>
            <input
              type="text"
              name="finally-chat-message"
              placeholder="Type a message for the assistant..."
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
            />
            <button type="submit" disabled={chatBusy || !chatInput.trim()}>
              {chatBusy ? 'Sending' : 'Send'}
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
}
