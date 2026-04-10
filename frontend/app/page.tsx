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

type TradeResponse = {
  ticker: string;
  side: 'buy' | 'sell';
  quantity: number;
  price: number;
  cash_balance: number;
};

type Candle = {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  direction: 'up' | 'down' | 'flat';
};

const EMPTY_PORTFOLIO: PortfolioResponse = {
  cash_balance: 0,
  total_value: 0,
  positions: [],
  unrealized_pnl_total: 0,
};

const DEFAULT_CHART_MESSAGE =
  'Select a symbol from the watchlist to inspect its recent price history.';
const VALID_TICKER = /^[A-Z]{1,5}$/;
const FETCH_TIMEOUT_MS = 15000;

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

function buildScaledPath(
  values: number[],
  width: number,
  height: number,
  top = 0,
  left = 0,
): string {
  if (!values.length) {
    return '';
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  return values
    .map((value, index) => {
      const x = left + (values.length === 1 ? width / 2 : (index / (values.length - 1)) * width);
      const y = top + height - ((value - min) / range) * height;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function movingAverage(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) {
      return null;
    }

    const window = values.slice(index + 1 - period, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / period;
  });
}

function buildNullablePath(
  values: Array<number | null>,
  width: number,
  height: number,
  min: number,
  max: number,
  top = 0,
  left = 0,
): string {
  const range = max - min || 1;
  let started = false;

  return values
    .map((value, index) => {
      if (value === null) {
        return '';
      }

      const x = left + (values.length === 1 ? width / 2 : (index / (values.length - 1)) * width);
      const y = top + height - ((value - min) / range) * height;
      const command = started ? 'L' : 'M';
      started = true;
      return `${command} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .filter(Boolean)
    .join(' ');
}

function buildCandles(points: PricePoint[]): Candle[] {
  return points.slice(-48).map((point, index, selected) => {
    const previous = selected[index - 1];
    const open = previous?.price ?? point.previous_price ?? point.price;
    const close = point.price;
    const move = Math.abs(close - open);
    const wick = Math.max(move * 0.72, close * 0.0012);
    const high = Math.max(open, close) + wick * (1 + (index % 3) * 0.12);
    const low = Math.max(0, Math.min(open, close) - wick * (1 + (index % 4) * 0.1));
    const volume = Math.round(420000 + Math.abs(point.change_percent) * 240000 + (index % 9) * 38000);
    const direction = close > open ? 'up' : close < open ? 'down' : 'flat';

    return { open, high, low, close, volume, direction };
  });
}

function ema(values: number[], period: number): number[] {
  if (!values.length) {
    return [];
  }

  const multiplier = 2 / (period + 1);
  const result = [values[0]];

  for (let index = 1; index < values.length; index += 1) {
    result.push((values[index] - result[index - 1]) * multiplier + result[index - 1]);
  }

  return result;
}

function rsi(values: number[], period = 14): number[] {
  if (values.length < 2) {
    return values.map(() => 50);
  }

  return values.map((_, index) => {
    if (index === 0) {
      return 50;
    }

    const start = Math.max(1, index - period + 1);
    let gains = 0;
    let losses = 0;

    for (let cursor = start; cursor <= index; cursor += 1) {
      const delta = values[cursor] - values[cursor - 1];
      if (delta >= 0) {
        gains += delta;
      } else {
        losses += Math.abs(delta);
      }
    }

    if (losses === 0) {
      return 100;
    }

    const relativeStrength = gains / losses;
    return 100 - 100 / (1 + relativeStrength);
  });
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
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
  const candles = buildCandles(points);
  const closes = candles.map((candle) => candle.close);
  const highs = candles.map((candle) => candle.high);
  const lows = candles.map((candle) => candle.low);
  const volumes = candles.map((candle) => candle.volume);
  const priceMin = Math.min(...lows);
  const priceMax = Math.max(...highs);
  const priceRange = priceMax - priceMin || 1;
  const support = priceMin + priceRange * 0.18;
  const resistance = priceMax - priceRange * 0.16;
  const ma20 = movingAverage(closes, Math.min(20, closes.length));
  const ma50 = movingAverage(closes, Math.min(32, closes.length));
  const ma200 = movingAverage(closes, Math.min(44, closes.length));
  const rsiValues = rsi(closes);
  const macdFast = ema(closes, 12);
  const macdSlow = ema(closes, 26);
  const macdLine = macdFast.map((value, index) => value - (macdSlow[index] ?? value));
  const signalLine = ema(macdLine, 9);
  const macdMin = Math.min(...macdLine, ...signalLine);
  const macdMax = Math.max(...macdLine, ...signalLine);
  const candleWidth = Math.max(6, 680 / candles.length - 4);
  const maxVolume = Math.max(...volumes, 1);
  const priceY = (value: number) => 34 + 276 - ((value - priceMin) / priceRange) * 276;
  const volumeY = (value: number) => 338 + 70 - (value / maxVolume) * 70;
  const xFor = (index: number) => 42 + (index / Math.max(candles.length - 1, 1)) * 680;

  return (
    <div className="chart-card trading-chart-card">
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
      <div className="indicator-strip" aria-label="Technical indicators">
        <span>
          MA20 <strong>{formatCurrency(ma20[ma20.length - 1] ?? latest.price)}</strong>
        </span>
        <span>
          MA50 <strong>{formatCurrency(ma50[ma50.length - 1] ?? latest.price)}</strong>
        </span>
        <span>
          MA200 <strong>{formatCurrency(ma200[ma200.length - 1] ?? latest.price)}</strong>
        </span>
        <span>
          Vol <strong>{formatCompact(volumes[volumes.length - 1])}</strong>
        </span>
      </div>
      <svg
        viewBox="0 0 760 520"
        className="main-chart"
        data-testid="primary-trading-chart"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="terminal-chart-bg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(32, 157, 215, 0.12)" />
            <stop offset="100%" stopColor="rgba(4, 8, 14, 0)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width="760" height="520" className="terminal-chart-bg" />
        {[34, 89, 144, 199, 254, 310].map((y) => (
          <line key={`price-grid-${y}`} x1="36" x2="724" y1={y} y2={y} className="chart-grid" />
        ))}
        {[80, 180, 280, 380, 480, 580, 680].map((x) => (
          <line key={`vertical-grid-${x}`} x1={x} x2={x} y1="34" y2="512" className="chart-grid" />
        ))}
        <line
          x1="42"
          x2="722"
          y1={priceY(resistance)}
          y2={priceY(resistance)}
          className="resistance-line"
        />
        <line x1="42" x2="722" y1={priceY(support)} y2={priceY(support)} className="support-line" />
        <text x="54" y={priceY(resistance) - 8} className="chart-label resistance">
          Resistance {formatCurrency(resistance)}
        </text>
        <text x="54" y={priceY(support) + 16} className="chart-label support">
          Support {formatCurrency(support)}
        </text>
        <path
          d={buildNullablePath(ma20, 680, 276, priceMin, priceMax, 34, 42)}
          className="ma-line ma20"
        />
        <path
          d={buildNullablePath(ma50, 680, 276, priceMin, priceMax, 34, 42)}
          className="ma-line ma50"
        />
        <path
          d={buildNullablePath(ma200, 680, 276, priceMin, priceMax, 34, 42)}
          className="ma-line ma200"
        />
        <path
          d={buildNullablePath(closes, 680, 276, priceMin, priceMax, 34, 42)}
          className={`price-trend-line ${latest.direction}`}
        />
        {candles.map((candle, index) => {
          const x = xFor(index);
          const openY = priceY(candle.open);
          const closeY = priceY(candle.close);
          const bodyY = Math.min(openY, closeY);
          const bodyHeight = Math.max(Math.abs(closeY - openY), 3);
          return (
            <g key={`${ticker}-${index}`} className={`candle ${candle.direction}`}>
              <line x1={x} x2={x} y1={priceY(candle.high)} y2={priceY(candle.low)} />
              <rect
                x={x - candleWidth / 2}
                y={bodyY}
                width={candleWidth}
                height={bodyHeight}
                rx="1.5"
              />
              <rect
                x={x - candleWidth / 2}
                y={volumeY(candle.volume)}
                width={candleWidth}
                height={408 - volumeY(candle.volume)}
                className="volume-bar"
                rx="1.5"
              />
            </g>
          );
        })}
        <text x="42" y="332" className="indicator-label">
          Volume
        </text>
        <line x1="36" x2="724" y1="408" y2="408" className="indicator-divider" />
        <text x="42" y="430" className="indicator-label">
          RSI 14
        </text>
        <line x1="42" x2="722" y1="448" y2="448" className="rsi-band" />
        <line x1="42" x2="722" y1="480" y2="480" className="rsi-band" />
        <path
          d={buildScaledPath(rsiValues, 680, 60, 430, 42)}
          className="rsi-line"
        />
        <line x1="36" x2="724" y1="492" y2="492" className="indicator-divider" />
        <text x="42" y="512" className="indicator-label">
          MACD
        </text>
        <path
          d={buildScaledPath(macdLine, 680, 42, 472, 42)}
          className="macd-line"
        />
        <path
          d={buildScaledPath(signalLine, 680, 42, 472, 42)}
          className="signal-line"
        />
        <text x="656" y="52" className="price-axis">
          {formatCurrency(priceMax)}
        </text>
        <text x="656" y="306" className="price-axis">
          {formatCurrency(priceMin)}
        </text>
        <text x="656" y="512" className="price-axis">
          {macdMin.toFixed(2)} / {macdMax.toFixed(2)}
        </text>
      </svg>
      <div className="chart-footer">
        <span>OHLC rebuilt from {points.length} live ticks</span>
        <span>RSI, MACD, volume, support and resistance</span>
      </div>
    </div>
  );
}

function PortfolioValueChart({ history }: { history: PortfolioHistoryPoint[] }) {
  const values = history.map((point) => point.total_value);

  if (!values.length) {
    return <div className="empty-state">No portfolio snapshots yet</div>;
  }

  const latest = values[values.length - 1];
  const first = values[0];
  const change = latest - first;
  const changePercent = first ? (change / first) * 100 : 0;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const highWater = values.reduce<number[]>((levels, value, index) => {
    levels[index] = Math.max(value, levels[index - 1] ?? value);
    return levels;
  }, []);
  const drawdowns = values.map((value, index) => highWater[index] - value);
  const maxDrawdown = Math.max(...drawdowns, 1);
  const yFor = (value: number) => 14 + 104 - ((value - min) / range) * 104;

  return (
    <div className="portfolio-chart-shell">
      <div className="portfolio-chart-header">
        <span>{formatCurrency(latest)}</span>
        <strong className={change >= 0 ? 'up' : 'down'}>
          {formatSignedCurrency(change)} / {formatSignedPercent(changePercent)}
        </strong>
      </div>
      <svg
        viewBox="0 0 320 190"
        className="mini-chart"
        data-testid="portfolio-value-chart"
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="portfolio-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(23, 201, 100, 0.34)" />
            <stop offset="100%" stopColor="rgba(23, 201, 100, 0.02)" />
          </linearGradient>
        </defs>
        {[14, 40, 66, 92, 118].map((y) => (
          <line key={`portfolio-grid-${y}`} x1="0" x2="320" y1={y} y2={y} className="chart-grid" />
        ))}
        <path
          d={`${buildScaledPath(values, 320, 104, 14)} L 320 128 L 0 128 Z`}
          className="portfolio-area"
        />
        <path d={buildScaledPath(values, 320, 104, 14)} className="portfolio-line" />
        <line x1="0" x2="320" y1={yFor(first)} y2={yFor(first)} className="cost-basis-line" />
        {drawdowns.map((drawdown, index) => {
          const x = values.length === 1 ? 160 : (index / (values.length - 1)) * 320;
          const height = (drawdown / maxDrawdown) * 38;
          return (
            <rect
              key={`drawdown-${index}`}
              x={x - 2}
              y={172 - height}
              width="4"
              height={height}
              className="drawdown-bar"
              rx="1"
            />
          );
        })}
        <text x="8" y="24" className="chart-label">
          High {formatCurrency(max)}
        </text>
        <text x="8" y="182" className="indicator-label">
          Drawdown
        </text>
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
  const [tradeQuantity, setTradeQuantity] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [tradeError, setTradeError] = useState('');
  const [tradeNotice, setTradeNotice] = useState('');
  const [tradeBusy, setTradeBusy] = useState(false);
  const [watchlistError, setWatchlistError] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: 'Ask about your portfolio, request analysis, or tell me to make trades.',
    },
  ]);

  async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(url, { cache: 'no-store', ...init, signal: controller.signal });
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
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw new Error('Request timed out. Please try again.');
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
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
  }

  async function loadTickerHistory(ticker: string): Promise<void> {
    const history = await fetchJson<PricePoint[]>(`/api/prices/${ticker}/history`);
    setPriceHistory((current) => ({
      ...current,
      [ticker]: history,
    }));
  }

  function selectTicker(ticker: string): void {
    setSelectedTicker(ticker);
    setTradeError('');
    setTradeNotice('');
    loadTickerHistory(ticker).catch(() => {
      setPriceHistory((current) => ({ ...current, [ticker]: [] }));
    });
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
      selectTicker(ticker);
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
    setTradeNotice('');

    if (tradeBusy) {
      return;
    }

    try {
      const ticker = selectedTicker.toUpperCase().trim();
      const quantity = Number.parseFloat(tradeQuantity);

      if (!VALID_TICKER.test(ticker)) {
        throw new Error('Select a valid ticker before trading');
      }
      if (!Number.isFinite(quantity) || quantity <= 0) {
        throw new Error('Enter a positive quantity before trading');
      }

      setTradeBusy(true);
      const result = await fetchJson<TradeResponse>('/api/portfolio/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticker, side, quantity }),
      });

      setTradeQuantity('');
      setTradeNotice(
        `${result.side.toUpperCase()} ${result.quantity} ${result.ticker} @ ${formatCurrency(
          result.price,
        )}`,
      );
      setTradeBusy(false);
      await Promise.allSettled([refreshPortfolio(), refreshWatchlist(), loadTickerHistory(ticker)]);
    } catch (error) {
      setTradeError(error instanceof Error ? error.message : 'Unable to execute trade');
    } finally {
      setTradeBusy(false);
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

      setChatBusy(false);
      void Promise.allSettled([refreshPortfolio(), refreshWatchlist()]);
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
            <strong data-testid="portfolio-total">{formatCurrency(portfolio.total_value)}</strong>
          </div>
          <div className="metric-card">
            <span className="metric-label">Cash</span>
            <strong data-testid="portfolio-cash">{formatCurrency(portfolio.cash_balance)}</strong>
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
                        selectTicker(row.ticker);
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
                value={selectedTicker}
                readOnly
                aria-label="Selected trade symbol"
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
            <button
              type="button"
              className="buy-button"
              onClick={() => handleTrade('buy')}
              disabled={tradeBusy}
            >
              {tradeBusy ? 'Working' : 'Buy'}
            </button>
            <button
              type="button"
              className="sell-button"
              onClick={() => handleTrade('sell')}
              disabled={tradeBusy}
            >
              {tradeBusy ? 'Working' : 'Sell'}
            </button>
            {tradeError ? <p className="inline-error">{tradeError}</p> : null}
            {tradeNotice ? <p className="inline-success">{tradeNotice}</p> : null}
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
              data-testid="chat-input"
              placeholder="Type a message for the assistant..."
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
            />
            <button type="submit" data-testid="chat-send" disabled={chatBusy || !chatInput.trim()}>
              {chatBusy ? 'Sending' : 'Send'}
            </button>
          </form>
        </aside>
      </div>
      <footer className="app-footer">
        <span>Educational application by Lalit Nayyar</span>
        <span>lalitnayyar@gmail.com</span>
        <span>For learning and demonstration only. Not financial advice or commercial use.</span>
      </footer>
    </main>
  );
}
