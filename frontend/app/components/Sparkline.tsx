"use client";

import { useRef, useEffect } from "react";

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

export default function Sparkline({ data, width = 60, height = 20 }: SparklineProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length < 2) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = max - min || 1;
    const padding = 2;
    const chartHeight = height - padding * 2;
    const stepX = width / (data.length - 1);

    const isUp = data[data.length - 1] >= data[0];
    ctx.strokeStyle = isUp ? "#3fb950" : "#f85149";
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let i = 0; i < data.length; i++) {
      const x = i * stepX;
      const y = padding + chartHeight - ((data[i] - min) / range) * chartHeight;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }

    ctx.stroke();
  }, [data, width, height]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width, height }}
      className="block"
    />
  );
}
