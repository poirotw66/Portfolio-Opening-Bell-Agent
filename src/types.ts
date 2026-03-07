export interface Position {
  ticker: string;
  shares: number;
  avgPrice: number;
}

export interface MarketData {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  marketCap: number;
  error?: string;
  sma20?: number | null;
  rsi14?: number | null;
  oneMonthPerformance?: number | null;
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
}

export interface SavedReport {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'portfolio' | 'single-stock';
  tickers: string[];
}

export interface PositionAnalytics {
  ticker: string;
  shares: number;
  avgPrice: number;
  currentPrice: number;
  positionValue: number;
  costBasis: number;
  unrealizedPL: number;
  returnPercent: number;
}

export interface MarketContext {
  [index: string]: {
    price: number;
    changePercent: number;
  };
}
