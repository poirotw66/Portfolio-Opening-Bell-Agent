import { useCallback, useEffect, useState } from "react";
import { Position, MarketData } from "../types";
import { fetchMarketData } from "../services/marketService";

interface UsePortfolioMarketDataResult {
  positions: Position[];
  marketData: MarketData[];
  isLoading: boolean;
  error: string;
  reload: () => Promise<void>;
}

export function usePortfolioMarketData(): UsePortfolioMarketDataResult {
  const [positions, setPositions] = useState<Position[]>([]);
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const loadPortfolioAndMarketData = useCallback(async () => {
    const saved = localStorage.getItem("portfolio");
    if (!saved) {
      setPositions([]);
      setMarketData([]);
      return;
    }

    try {
      const parsed: unknown = JSON.parse(saved);
      if (!Array.isArray(parsed) || parsed.length === 0) {
        setPositions([]);
        setMarketData([]);
        return;
      }

      const typedPositions = parsed as Position[];
      setPositions(typedPositions);

      setIsLoading(true);
      setError("");
      try {
        const tickers = typedPositions.map((position) => position.ticker);
        const data = await fetchMarketData(tickers);
        setMarketData(data);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "無法取得市場數據";
        // Keep console for debugging but avoid breaking UI
        // eslint-disable-next-line no-console
        console.error(err);
        setError(message);
      } finally {
        setIsLoading(false);
      }
    } catch (parseError) {
      // eslint-disable-next-line no-console
      console.error("Failed to parse portfolio", parseError);
      setPositions([]);
      setMarketData([]);
      setError("無法讀取已儲存的投資組合資料");
    }
  }, []);

  useEffect(() => {
    void loadPortfolioAndMarketData();
  }, [loadPortfolioAndMarketData]);

  return {
    positions,
    marketData,
    isLoading,
    error,
    reload: loadPortfolioAndMarketData,
  };
}

