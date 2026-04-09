"use client";

import {
  AreaSeries,
  createChart,
  type IChartApi,
  type ISeriesApi,
  type UTCTimestamp,
} from "lightweight-charts";
import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import type { PortfolioSnapshot } from "../types";

interface PnlChartProps {
  history: PortfolioSnapshot[];
  emptyHint?: boolean;
}

function toChartData(history: PortfolioSnapshot[]) {
  if (history.length === 0) return [];
  const sorted = [...history].sort(
    (a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime()
  );
  const data = sorted.map((snap) => ({
    time: Math.floor(new Date(snap.recorded_at).getTime() / 1000) as UTCTimestamp,
    value: snap.total_value,
  }));
  if (data.length === 1) {
    const p = data[0];
    return [p, { time: (p.time + 1) as UTCTimestamp, value: p.value }];
  }
  return data;
}

function pnlLayoutOptions() {
  return {
    layout: {
      background: { color: "#161b22" },
      textColor: "#8b949e",
      fontSize: 10,
    },
    grid: {
      vertLines: { color: "#30363d" },
      horzLines: { color: "#30363d" },
    },
    timeScale: {
      timeVisible: true,
      borderColor: "#30363d",
    },
    rightPriceScale: {
      borderColor: "#30363d",
      scaleMargins: { top: 0.1, bottom: 0.1 },
    },
  };
}

const MIN_W = 200;
const MIN_H = 140;

export default function PnlChart({ history, emptyHint }: PnlChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Area"> | null>(null);
  const chartDataRef = useRef<ReturnType<typeof toChartData>>([]);

  chartDataRef.current = toChartData(history);

  const syncSeriesData = useCallback(() => {
    const series = seriesRef.current;
    const chart = chartRef.current;
    if (!series) return;
    const data = chartDataRef.current;
    if (data.length === 0) {
      series.setData([]);
      return;
    }
    series.setData(data);
    chart?.timeScale().fitContent();
    chart?.priceScale("right").applyOptions({ autoScale: true });
  }, []);

  useLayoutEffect(() => {
    syncSeriesData();
  }, [history, syncSeriesData]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    let disposed = false;
    const timeouts: ReturnType<typeof setTimeout>[] = [];

    const init = () => {
      if (disposed || chartRef.current || !containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      const w = Math.max(r.width, MIN_W);
      const h = Math.max(r.height, MIN_H);
      const chart = createChart(containerRef.current, {
        autoSize: true,
        width: w,
        height: h,
        ...pnlLayoutOptions(),
      });
      const series = chart.addSeries(AreaSeries, {
        lineColor: "#ecad0a",
        topColor: "rgba(236, 173, 10, 0.3)",
        bottomColor: "rgba(236, 173, 10, 0.02)",
        lineWidth: 2,
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

  return (
    <div className="relative flex h-full min-h-0 min-w-0 flex-col">
      <div ref={containerRef} className="min-h-0 w-full flex-1" />
      {emptyHint && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-text-secondary">
          Portfolio history will appear after trades
        </div>
      )}
    </div>
  );
}
