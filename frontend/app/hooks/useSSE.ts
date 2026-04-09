"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { PriceUpdate, ConnectionStatus } from "../types";

export function useSSE() {
  const [prices, setPrices] = useState<Record<string, PriceUpdate>>({});
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (esRef.current) {
      esRef.current.close();
    }

    const es = new EventSource("/api/stream/prices");
    esRef.current = es;

    es.onopen = () => {
      setStatus("connected");
    };

    es.onmessage = (event) => {
      setStatus("connected");
      const data: Record<string, PriceUpdate> = JSON.parse(event.data);
      setPrices((prev) => {
        const next = { ...prev };
        for (const [ticker, update] of Object.entries(data)) {
          next[ticker] = update;
        }
        return next;
      });
    };

    es.onerror = () => {
      setStatus("reconnecting");
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      esRef.current?.close();
    };
  }, [connect]);

  return { prices, status };
}
