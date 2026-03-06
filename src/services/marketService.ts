import { MarketData, NewsItem, MarketContext } from "../types";

export async function fetchMarketData(tickers: string[]): Promise<MarketData[]> {
  const response = await fetch("/api/market-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });
  if (!response.ok) throw new Error("取得市場數據失敗");
  const { data } = await response.json();
  return data;
}

export async function fetchNews(tickers: string[]): Promise<Record<string, NewsItem[]>> {
  const response = await fetch("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });
  if (!response.ok) throw new Error("取得新聞失敗");
  const { data } = await response.json();
  return data;
}

export async function fetchMarketContext(): Promise<MarketContext> {
  const response = await fetch("/api/market-context");
  if (!response.ok) throw new Error("取得市場情境失敗");
  const { data } = await response.json();
  return data;
}
