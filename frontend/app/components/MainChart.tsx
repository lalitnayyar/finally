"use client";

import {
  CandlestickSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PriceUpdate } from "../types";

interface MainChartProps {
  ticker: string | null;
  prices: Record<string, PriceUpdate>;
}

interface TickPoint {
  time: UTCTimestamp;
  value: number;
}

const CANDLE_INTERVAL_SEC = 15;

interface Candle {
  time: UTCTimestamp;
  open: number;
  high: number;
  low: number;
  close: number;
}

function normalizeUnixSeconds(t: number): number {
  if (!Number.isFinite(t)) return 0;
  const sec = t > 1e12 ? t / 1000 : t;
  return Math.floor(sec);
}

function ticksToCandles(ticks: TickPoint[], intervalSec: number): Candle[] {
  const valid = ticks.filter(
    (p) => Number.isFinite(Number(p.time)) && Number.isFinite(p.value)
  );
  if (valid.length === 0) return [];
  const sorted = [...valid].sort((a, b) => Number(a.time) - Number(b.time));
  const buckets = new Map<
    number,
    { open: number; high: number; low: number; close: number }
  >();

  for (const p of sorted) {
    const t = normalizeUnixSeconds(Number(p.time));
    if (t <= 0) continue;
    const bucketStart = Math.floor(t / intervalSec) * intervalSec;
    const existing = buckets.get(bucketStart);
    if (!existing) {
      buckets.set(bucketStart, {
        open: p.value,
        high: p.value,
        low: p.value,
        close: p.value,
      });
    } else {
      existing.high = Math.max(existing.high, p.value);
      existing.low = Math.min(existing.low, p.value);
      existing.close = p.value;
    }
  }

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([bucketStart, o]) => ({
      time: bucketStart as UTCTimestamp,
      open: o.open,
      high: o.high,
      low: o.low,
      close: o.close,
    }));
}

/** Zero-range OHLC breaks price-scale autoscale; force a tiny spread */
function sanitizeCandles(candles: Candle[]): Candle[] {
  return candles.map((c) => {
    let { open, high, low, close } = c;
    high = Math.max(high, open, close);
    low = Math.min(low, open, close);
    if (high <= low) {
      const mid = close || open || high;
      const eps = Math.max(Math.abs(mid) * 1e-6, 0.01);
      high = mid + eps;
      low = mid - eps;
    }
    return { time: c.time, open, high, low, close };
  });
}

function layoutOptions() {
  return {
    layout: {
      background: { color: "#161b22" },
      textColor: "#8b949e",
      fontSize: 11,
    },
    grid: {
      vertLines: { color: "#30363d" },
      horzLines: { color: "#30363d" },
    },
    timeScale: {
      timeVisible: true,
      secondsVisible: true,
      borderColor: "#30363d",
    },
    rightPriceScale: {
      borderColor: "#30363d",
      scaleMargins: { top: 0.08, bottom: 0.12 },
    },
    crosshair: {
      horzLine: { color: "#8b949e" },
      vertLine: { color: "#8b949e" },
    },
  };
}

const MIN_CHART_W = 280;
const MIN_CHART_H = 220;

export default function MainChart({ ticker, prices }: MainChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const displayCandlesRef = useRef<Candle[]>([]);
  const [ticks, setTicks] = useState<TickPoint[]>([]);
  const lastLiveKeyRef = useRef<string>("");

  const rawCandles = useMemo(() => {
    let c = ticksToCandles(ticks, CANDLE_INTERVAL_SEC);
    if (c.length === 0 && ticks.length > 0) {
      c = ticksToCandles(ticks, 1);
    }
    return c;
  }, [ticks]);

  const displayCandles = useMemo(() => {
    const s = sanitizeCandles(rawCandles);
    if (s.length === 1) {
      const x = s[0];
      const t = Number(x.time);
      return [
        x,
        {
          time: (t + 1) as UTCTimestamp,
          open: x.close,
          high: x.high,
          low: x.low,
          close: x.close,
        },
      ];
    }
    return s;
  }, [rawCandles]);

  displayCandlesRef.current = displayCandles;

  const syncSeriesData = useCallback(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series) return;
    const candles = displayCandlesRef.current;
    if (candles.length === 0) {
      series.setData([]);
      return;
    }
    series.setData(candles);
    chart?.timeScale().fitContent();
    chart?.priceScale("right").applyOptions({ autoScale: true });
  }, []);

  useLayoutEffect(() => {
    syncSeriesData();
  }, [displayCandles, syncSeriesData]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const init = () => {
      if (disposed || chartRef.current || !containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const w = Math.max(r.width, MIN_CHART_W);
      const h = Math.max(r.height, MIN_CHART_H);
      const chart = createChart(containerRef.current, {
        autoSize: true,
        width: w,
        height: h,
        ...layoutOptions(),
      });
      const series = chart.addSeries(CandlestickSeries, {
        upColor: "#3fb950",
        downColor: "#f85149",
        borderVisible: true,
        wickVisible: true,
        wickUpColor: "#3fb950",
        wickDownColor: "#f85149",
        borderUpColor: "#3fb950",
        borderDownColor: "#f85149",
        priceLineVisible: true,
        lastValueVisible: true,
      });
      chartRef.current = chart;
      seriesRef.current = series;
      syncSeriesData();
    };

    requestAnimationFrame(() => requestAnimationFrame(() => init()));
    timeouts.push(setTimeout(init, 0));
    timeouts.push(setTimeout(init, 50));
    timeouts.push(setTimeout(init, 350));

    return () => {
      disposed = true;
      timeouts.forEach(clearTimeout);
      if (chartRef.current) {
        chartRef.current.remove();
        chartRef.current = null;
        seriesRef.current = null;
      }
    };
  }, [syncSeriesData]);

  useEffect(() => {
    if (!ticker) return;

    lastLiveKeyRef.current = "";
    setTicks([]);
    fetch(`/api/prices/${ticker}/history`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data: Array<{ timestamp: number; price: number }>) => {
        const points = data
          .filter((d) => Number.isFinite(d.price))
          .map((d) => ({
            time: normalizeUnixSeconds(d.timestamp) as UTCTimestamp,
            value: d.price,
          }));
        setTicks(points);
      })
      .catch(() => {});
  }, [ticker]);

  const liveTick = ticker ? prices[ticker] : null;

  useEffect(() => {
    if (!ticker || !liveTick) return;

    const dedupeKey = `${liveTick.timestamp}:${liveTick.price}`;
    if (lastLiveKeyRef.current === dedupeKey) return;
    lastLiveKeyRef.current = dedupeKey;

    setTicks((prev) => {
      let time = normalizeUnixSeconds(liveTick.timestamp) as UTCTimestamp;
      const last = prev[prev.length - 1];
      if (
        last &&
        Number(last.time) === Number(time) &&
        last.value === liveTick.price
      ) {
        return prev;
      }
      if (last && Number(time) <= Number(last.time)) {
        time = (Number(last.time) + 1) as UTCTimestamp;
      }
      const point = { time, value: liveTick.price };
      const next = [...prev, point];
      if (next.length > 800) next.shift();
      return next;
    });
  }, [ticker, liveTick]);

  const currentPrice = ticker ? prices[ticker] : null;

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-border flex-shrink-0">
        {ticker ? (
          <>
            <span className="font-mono font-bold text-lg">{ticker}</span>
            {currentPrice && (
              <>
                <span className={`font-mono text-lg ${
                  currentPrice.direction === "up" ? "text-green" : currentPrice.direction === "down" ? "text-red" : "text-text-primary"
                }`}>
                  ${currentPrice.price.toFixed(2)}
                </span>
                <span className={`font-mono text-sm ${
                  currentPrice.change_percent > 0 ? "text-green" : currentPrice.change_percent < 0 ? "text-red" : "text-text-secondary"
                }`}>
                  {currentPrice.change_percent > 0 ? "+" : ""}{currentPrice.change_percent.toFixed(2)}%
                </span>
                <span className="text-text-secondary text-xs ml-1 hidden sm:inline">
                  · {CANDLE_INTERVAL_SEC}s candles
                </span>
              </>
            )}
          </>
        ) : (
          <span className="text-text-secondary text-sm">Select a ticker</span>
        )}
      </div>
      <div
        ref={containerRef}
        className="relative min-h-0 w-full flex-1"
        style={{ minHeight: "max(240px, min(45vh, 420px))" }}
      />
      {!ticker && (
        <div className="absolute inset-0 top-9 flex items-center justify-center text-text-secondary text-sm pointer-events-none">
          Click a ticker in the watchlist to view its chart
        </div>
      )}
    </div>
  );
}
