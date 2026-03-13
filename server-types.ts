/**
 * Typed shapes for Yahoo Finance and third-party API responses used in server.ts.
 * Keeps server code free of `any` while avoiding dependency on full yahoo-finance2 typings.
 */

/** Quote fields we read from yahoo-finance2 quote() */
export interface YahooQuoteResult {
  regularMarketPrice: number;
  regularMarketChange: number;
  regularMarketChangePercent: number;
  regularMarketVolume: number;
  marketCap: number;
}

/** Single candle from yahoo-finance2 historical() */
export interface YahooHistoricalCandle {
  date: Date;
  close: number;
}

/** Result of yahoo-finance2 search() when used for news */
export interface YahooSearchNewsResult {
  news: Array<{
    title: string;
    publisher: string;
    link: string;
    providerPublishTime?: string | number | Date;
  }>;
}

/** SerpAPI news item shape */
export interface SerpNewsItem {
  title?: string;
  link?: string;
  date?: string;
  source?: { name?: string } | string;
}

/** SerpAPI search response (only the part we use) */
export interface SerpApiSearchResponse {
  news_results?: SerpNewsItem[];
}

/** Client interface for the yahoo-finance2 instance (constructor result) */
export interface YahooFinanceClient {
  quote(symbol: string): Promise<YahooQuoteResult>;
  historical(
    symbol: string,
    opts: { period1: Date; period2: Date; interval: string }
  ): Promise<YahooHistoricalCandle[]>;
  search(symbol: string, opts: { newsCount: number }): Promise<YahooSearchNewsResult>;
}
