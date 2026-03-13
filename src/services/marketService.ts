import { MarketData, NewsItem, MarketContext } from "../types";

async function fetchWithTimeout(
  resource: string,
  options: RequestInit = {},
  timeout = 30000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

async function throwApiError(response: Response, fallbackMessage: string): Promise<never> {
  try {
    const data = (await response.json()) as unknown;
    if (data && typeof data === "object") {
      const record = data as Record<string, unknown>;
      const message =
        (typeof record.error === "string" && record.error) ||
        (typeof record.message === "string" && record.message) ||
        fallbackMessage;
      throw new Error(message);
    }
  } catch {
    // Ignore JSON parse errors and fall back to status text or generic message.
  }

  const messageFromStatus = response.statusText || fallbackMessage;
  throw new Error(messageFromStatus);
}

export async function fetchMarketData(tickers: string[]): Promise<MarketData[]> {
  const response = await fetchWithTimeout("/api/market-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers }),
  });
  if (!response.ok) {
    await throwApiError(response, "取得市場數據失敗");
  }
  const { data } = (await response.json()) as { data: MarketData[] };
  return data;
}

export async function fetchNews(tickers: string[]): Promise<Record<string, NewsItem[]>> {
  const serpApiKey = localStorage.getItem("serpApiKey");
  const response = await fetchWithTimeout("/api/news", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ tickers, serpApiKey }),
  });
  if (!response.ok) {
    await throwApiError(response, "取得新聞失敗");
  }
  const { data } = (await response.json()) as { data: Record<string, NewsItem[]> };
  return data;
}

export async function fetchMarketContext(): Promise<MarketContext> {
  const response = await fetchWithTimeout("/api/market-context");
  if (!response.ok) {
    await throwApiError(response, "取得市場情境失敗");
  }
  const { data } = (await response.json()) as { data: MarketContext };
  return data;
}

