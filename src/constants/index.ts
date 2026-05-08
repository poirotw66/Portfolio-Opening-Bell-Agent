/**
 * 應用程式常數配置
 */

// 技術指標參數
export const TECHNICAL_INDICATORS = {
  SMA_PERIOD: 20,
  RSI_PERIOD: 14,
  HISTORICAL_DAYS: 60,
  TRADING_DAYS_PER_MONTH: 21,
} as const;

// API 配置
export const API_CONFIG = {
  TIMEOUT: 30000, // 30 秒
  MAX_RETRIES: 2,
  RETRY_DELAY: 1000, // 1 秒
  CACHE_TTL: 300, // 5 分鐘
} as const;

// Gemini AI 配置
export const GEMINI_CONFIG = {
  DEFAULT_MODEL: 'gemini-3-flash-preview',
  MAX_OUTPUT_TOKENS: 4096,
  TEMPERATURE: 0.4,
  TOP_P: 0.9,
  DASHBOARD_FIELD_MAX_LENGTH: 200,
} as const;

// 市場指數
export const MARKET_INDICES = {
  NASDAQ: '^IXIC',
  SP500: '^GSPC',
} as const;

// 本地儲存鍵值
export const STORAGE_KEYS = {
  PORTFOLIO: 'portfolio',
  SAVED_REPORTS: 'savedReports',
  INVESTMENT_STRATEGY: 'investmentStrategy',
  CUSTOM_GEMINI_API_KEY: 'customGeminiApiKey',
  SERP_API_KEY: 'serpApiKey',
  GEMINI_MODEL: 'geminiModel',
} as const;

// 投資策略標籤
export const STRATEGY_LABELS = {
  value: '價值投資 (尋找被低估的股票)',
  growth: '成長投資 (專注高增長潛力)',
  index: '指數投資 (追求市場平均報酬)',
  dividend: '股息投資 (偏好穩定配息)',
  technical: '技術交易 (利用圖表與指標)',
  dca: '定期定額 (固定投入分散成本)',
} as const;

// 錯誤訊息
export const ERROR_MESSAGES = {
  NO_API_KEY: '請先在「系統設定」中設定 Gemini API Key（或於 .env.local 設定 VITE_GEMINI_API_KEY）。',
  NO_PORTFOLIO: '請先在「個人設定」中設定您的投資組合部位。',
  QUOTA_EXCEEDED: 'API 請求次數已達上限 (Quota Exceeded)。請稍後再試,或在「系統設定」中更換您的自訂 Gemini API Key。',
  REQUEST_TIMEOUT: '請求逾時或已中斷。請檢查網路連線後再試。',
  FETCH_FAILED: '取得數據失敗,請稍後再試。',
  INVALID_TICKER: '無法取得該股票的市場數據,請確認代號是否正確。',
  RECITATION_BLOCKED: 'Gemini 因內容政策阻擋了此次回應 (Recitation),請稍後再試或更換股票/輸入。',
  INVALID_RESPONSE: '模型未返回有效內容,請稍後再試。',
  JSON_PARSE_ERROR: '模型返回的決策數據格式錯誤,請稍後再試或更換股票。',
} as const;

// 顏色配置
export const CHART_COLORS = [
  '#4F46E5', // indigo-600
  '#60A5FA', // blue-400
  '#10B981', // emerald-500
  '#34D399', // emerald-400
  '#8B5CF6', // violet-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#6B7280', // gray-500
] as const;

// Made with Bob
