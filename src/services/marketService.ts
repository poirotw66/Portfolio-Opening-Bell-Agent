import { MarketData, NewsItem, MarketContext } from "../types";

async function fetchWithTimeout(resource: string, options: any = {}, timeout = 15000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

export async function fetchMarketData(tickers: string[]): Promise<MarketData[]> {
  const response = await fetchWithTimeout("/api/market-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });
  if (!response.ok) throw new Error("取得市場數據失敗");
  const { data } = await response.json();
  return data;
}

export async function fetchNews(tickers: string[]): Promise<Record<string, NewsItem[]>> {
  const serpApiKey = localStorage.getItem('serpApiKey');
  const response = await fetchWithTimeout("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers, serpApiKey }),
  });
  if (!response.ok) throw new Error("取得新聞失敗");
  const { data } = await response.json();
  return data;
}

export async function fetchMarketContext(): Promise<MarketContext> {
  const response = await fetchWithTimeout("/api/market-context");
  if (!response.ok) throw new Error("取得市場情境失敗");
  const { data } = await response.json();
  return data;
}
