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
  history?: { date: string; close: number }[];
  technicalDataError?: string;
}

export interface NewsItem {
  title: string;
  publisher: string;
  link: string;
  providerPublishTime: string | number | Date;
}

export type InvestmentStrategy =
  | "value"
  | "growth"
  | "index"
  | "dividend"
  | "technical"
  | "dca";

const INVESTMENT_STRATEGIES: InvestmentStrategy[] = [
  "value",
  "growth",
  "index",
  "dividend",
  "technical",
  "dca",
];

export function isInvestmentStrategy(s: string): s is InvestmentStrategy {
  return (INVESTMENT_STRATEGIES as readonly string[]).includes(s);
}

export interface UserProfile {
  portfolio: Position[];
  strategy: InvestmentStrategy;
}

export interface DecisionDashboard {
  stock_name: string;
  sentiment_score: number;
  trend_prediction: string;
  operation_advice: string;
  decision_type: 'buy' | 'hold' | 'sell';
  confidence_level: string;
  dashboard: {
    core_conclusion: {
      one_sentence: string;
      signal_type: string;
      time_sensitivity: string;
      position_advice: {
        no_position: string;
        has_position: string;
      };
    };
    data_perspective: {
      trend_status: { ma_alignment: string; is_bullish: boolean; trend_score: number };
      price_position: { current_price: number; ma5: number; ma10: number; ma20: number; bias_ma5: number; bias_status: string; support_level: number; resistance_level: number };
      volume_analysis: { volume_ratio: number; volume_status: string; turnover_rate: number; volume_meaning: string };
      chip_structure: { profit_ratio: number; avg_cost: number; concentration: number; chip_health: string };
    };
    intelligence: {
      latest_news: string;
      risk_alerts: string[];
      positive_catalysts: string[];
      earnings_outlook: string;
      sentiment_summary: string;
    };
    battle_plan: {
      sniper_points: { ideal_buy: string; secondary_buy: string; stop_loss: string; take_profit: string };
      position_strategy: { suggested_position: string; entry_plan: string; risk_control: string };
      action_checklist: string[];
    };
  };
  full_report_markdown?: string;
  marketData?: MarketData;
  position?: Position;
}

export interface SavedReport {
  id: string;
  title: string;
  content: string;
  dashboard?: DecisionDashboard; // Add dashboard field
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
