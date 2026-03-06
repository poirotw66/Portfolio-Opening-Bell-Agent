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
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: number;
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
