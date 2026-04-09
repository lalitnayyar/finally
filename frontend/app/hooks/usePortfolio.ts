"use client";

import { useState, useCallback, useEffect } from "react";
import type { Portfolio, PortfolioSnapshot } from "../types";

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [history, setHistory] = useState<PortfolioSnapshot[]>([]);

  const fetchPortfolio = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio");
      if (res.ok) {
        setPortfolio(await res.json());
      }
    } catch {
      // ignore fetch errors
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/portfolio/history");
      if (res.ok) {
        setHistory(await res.json());
      }
    } catch {
      // ignore fetch errors
    }
  }, []);

  useEffect(() => {
    fetchPortfolio();
    fetchHistory();
  }, [fetchPortfolio, fetchHistory]);

  return { portfolio, history, fetchPortfolio, fetchHistory };
}
