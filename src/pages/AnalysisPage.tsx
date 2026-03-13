import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AlertCircle, Newspaper, Briefcase, Search, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import PortfolioInput from "../components/PortfolioInput";
import { SingleStockInput } from "../components/SingleStockInput";
import ReportDisplay from "../components/ReportDisplay";
import {
  Position,
  PositionAnalytics,
  NewsItem,
  SavedReport,
  DecisionDashboard,
  InvestmentStrategy,
  isInvestmentStrategy,
} from "../types";
import { fetchMarketData, fetchNews, fetchMarketContext } from "../services/marketService";
import { generateOpeningBellBrief, generateSingleStockDashboard, generateSingleStockBrief } from "../services/geminiService";
import { DecisionDashboardDisplay } from "../components/DecisionDashboardDisplay";

export function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [newsData, setNewsData] = useState<Record<string, NewsItem[]>>({});

  const [activeTab, setActiveTab] = useState<'portfolio' | 'singleStock'>('portfolio');
  const [singleStockReport, setSingleStockReport] = useState<string>("");
  const [singleStockDashboard, setSingleStockDashboard] = useState<DecisionDashboard | null>(null);
  const [isSingleStockLoading, setIsSingleStockLoading] = useState(false);
  const [singleStockError, setSingleStockError] = useState<string>("");
  const [isSingleStockExpanded, setIsSingleStockExpanded] = useState(true);
  const [availableTickers, setAvailableTickers] = useState<string[]>([]);

  const [savedPositions, setSavedPositions] = useState<Position[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('portfolio');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const positions = parsed as Position[];
          setSavedPositions(positions);
          setAvailableTickers(Array.from(new Set(positions.map((p) => p.ticker))));
        }
      } catch (e) {}
    }
  }, []);

  const handleAnalyze = async () => {
    const saved = localStorage.getItem('portfolio');
    let currentPositions = savedPositions;
    
    if (saved) {
      try {
        currentPositions = JSON.parse(saved);
        setSavedPositions(currentPositions);
      } catch (e) {}
    }

    if (currentPositions.length === 0) {
      setError("請先在「個人設定」中設定您的投資組合部位。");
      return;
    }

    const apiKey =
      localStorage.getItem("customGeminiApiKey") ||
      (import.meta.env?.VITE_GEMINI_API_KEY as string | undefined);
    if (!apiKey?.trim()) {
      setError("請先在「系統設定」中設定 Gemini API Key（或於 .env.local 設定 VITE_GEMINI_API_KEY）。");
      return;
    }

    setIsLoading(true);
    setError("");
    setReport("");
    setNewsData({});
    setActiveTab('portfolio');

    try {
      const tickers = currentPositions.map((p) => p.ticker);
      const strategyRaw = localStorage.getItem("investmentStrategy") ?? "growth";
      const strategy: InvestmentStrategy = isInvestmentStrategy(strategyRaw)
        ? strategyRaw
        : "growth";

      setAnalysisStatus("正在取得市場數據與新聞...");
      // Fetch all data in parallel
      const [marketData, news, marketContext] = await Promise.all([
        fetchMarketData(tickers),
        fetchNews(tickers),
        fetchMarketContext(),
      ]);

      setNewsData(news);

      setAnalysisStatus("正在整理投資組合部位...");
      // Calculate analytics
      const analytics: PositionAnalytics[] = currentPositions.map((pos) => {
        const data = marketData.find((m) => m.ticker === pos.ticker);
        const currentPrice = data?.price || pos.avgPrice;
        const positionValue = pos.shares * currentPrice;
        const costBasis = pos.shares * pos.avgPrice;
        const unrealizedPL = positionValue - costBasis;
        const returnPercent = ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100;

        return {
          ...pos,
          currentPrice,
          positionValue,
          costBasis,
          unrealizedPL,
          returnPercent,
        };
      });

      setAnalysisStatus("AI 正在生成投資組合開盤報告...");
      // Generate AI Report
      const aiReport = await generateOpeningBellBrief(
        analytics,
        marketContext,
        news,
        strategy
      );
      setReport(aiReport);
      
      const newReport: SavedReport = {
        id: Date.now().toString(),
        title: '投資組合分析報告',
        content: aiReport,
        date: new Date().toISOString(),
        type: 'portfolio',
        tickers
      };
      
      const savedReports = localStorage.getItem('savedReports');
      const reports: SavedReport[] = savedReports ? JSON.parse(savedReports) : [];
      reports.unshift(newReport);
      localStorage.setItem('savedReports', JSON.stringify(reports));
    } catch (err: unknown) {
      let errorMessage =
        err instanceof Error ? err.message : "分析過程中發生錯誤。";
      if (
        errorMessage.includes("429") ||
        errorMessage.includes("RESOURCE_EXHAUSTED") ||
        errorMessage.includes("quota")
      ) {
        errorMessage =
          "API 請求次數已達上限 (Quota Exceeded)。請稍後再試，或在「系統設定」中更換您的自訂 Gemini API Key。";
      } else if (
        errorMessage.includes("abort") ||
        errorMessage.includes("AbortError")
      ) {
        errorMessage =
          "請求逾時或已中斷。請檢查網路連線後再試，若組合檔數較多可稍後再試。";
      }
      setError(errorMessage);
    } finally {
      setIsLoading(false);
      setAnalysisStatus("");
    }
  };

  const [analysisStatus, setAnalysisStatus] = useState("");

  const handleSingleStockAnalyze = async (ticker: string) => {
    const apiKey =
      localStorage.getItem("customGeminiApiKey") ||
      (import.meta.env?.VITE_GEMINI_API_KEY as string | undefined);
    if (!apiKey?.trim()) {
      setSingleStockError(
        "請先在「系統設定」中設定 Gemini API Key（或於 .env.local 設定 VITE_GEMINI_API_KEY）。"
      );
      return;
    }

    setIsSingleStockLoading(true);
    setAnalysisStatus("正在取得市場數據...");
    setSingleStockError("");
    setSingleStockReport("");
    setSingleStockDashboard(null);
    setIsSingleStockExpanded(true);
    setActiveTab('singleStock');

    try {
      const [marketData, news, marketContext] = await Promise.all([
        fetchMarketData([ticker]),
        fetchNews([ticker]),
        fetchMarketContext(),
      ]);

      setAnalysisStatus("正在分析市場情報與新聞...");
      const data = marketData[0];
      if (!data) {
        throw new Error(`無法取得 ${ticker} 的市場數據，請確認代號是否正確。`);
      }
      if (data.error) {
        throw new Error(`無法取得 ${ticker} 的市場數據`);
      }

      const tickerNews = news[ticker] || [];
      
      // Get latest positions for context
      const saved = localStorage.getItem('portfolio');
      let currentPositions = savedPositions;
      if (saved) {
        try {
          currentPositions = JSON.parse(saved);
          setSavedPositions(currentPositions);
        } catch (e) {}
      }
      
      const position = currentPositions.find((p) => p.ticker === ticker);
      const strategyRaw = localStorage.getItem("investmentStrategy") ?? "growth";
      const strategy: InvestmentStrategy = isInvestmentStrategy(strategyRaw)
        ? strategyRaw
        : "growth";

      setAnalysisStatus("AI 正在同步生成儀表盤與報告...");
      const [dashboardData, fullReport] = await Promise.all([
        generateSingleStockDashboard(
          ticker,
          data,
          tickerNews,
          marketContext,
          position,
          strategy
        ),
        generateSingleStockBrief(
          ticker,
          data,
          tickerNews,
          marketContext,
          position,
          strategy
        ),
      ]);
      
      dashboardData.full_report_markdown = fullReport;
      setSingleStockDashboard(dashboardData);
      setSingleStockReport(fullReport); 
      setAnalysisStatus("");

      const decisionEmoji = dashboardData.decision_type === 'buy' ? '🟢' : dashboardData.decision_type === 'sell' ? '🔴' : '🟡';
      const newReport: SavedReport = {
        id: Date.now().toString(),
        title: `${decisionEmoji} ${dashboardData.stock_name || '單股指南報告'}`,
        content: fullReport,
        dashboard: dashboardData,
        date: new Date().toISOString(),
        type: 'single-stock',
        tickers: [ticker.toUpperCase()]
      };
      
      const savedReports = localStorage.getItem('savedReports');
      const reports: SavedReport[] = savedReports ? JSON.parse(savedReports) : [];
      reports.unshift(newReport);
      localStorage.setItem('savedReports', JSON.stringify(reports));

    } catch (err: unknown) {
      let errorMessage =
        err instanceof Error ? err.message : "分析過程中發生錯誤。";
      if (
        errorMessage.includes("429") ||
        errorMessage.includes("RESOURCE_EXHAUSTED") ||
        errorMessage.includes("quota")
      ) {
        errorMessage =
          "API 請求次數已達上限 (Quota Exceeded)。請稍後再試，或在「系統設定」中更換您的自訂 Gemini API Key。";
      } else if (
        errorMessage.includes("abort") ||
        errorMessage.includes("AbortError")
      ) {
        errorMessage = "請求逾時或已中斷。請檢查網路連線後再試。";
      }
      setSingleStockError(errorMessage);
    } finally {
      setIsSingleStockLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Input */}
      <div className="lg:col-span-4 space-y-6">
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Briefcase className="w-5 h-5 text-indigo-600" />
            <h2 className="text-lg font-semibold text-slate-900">投資組合分析</h2>
          </div>
          
          {savedPositions.length > 0 ? (
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">目前追蹤部位</div>
                <div className="flex flex-wrap gap-2">
                  {savedPositions.map(p => (
                    <span key={p.ticker} className="px-2 py-1 bg-white border border-slate-200 rounded text-xs font-mono font-bold text-slate-700">
                      {p.ticker}
                    </span>
                  ))}
                </div>
                <div className="text-[10px] text-slate-400 mt-3 italic">
                  * 如需修改部位，請至「個人設定」頁面
                </div>
              </div>
              
              <button
                onClick={handleAnalyze}
                disabled={isLoading}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isLoading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    分析中...
                  </>
                ) : (
                  <>
                    <Newspaper className="w-4 h-4" />
                    產生投資組合開盤報告
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-slate-500 mb-4">您尚未設定投資組合部位</p>
              <a 
                href="/profile" 
                className="inline-flex items-center gap-2 text-sm font-bold text-indigo-600 hover:text-indigo-700"
                onClick={(e) => {
                  e.preventDefault();
                  window.location.href = '/profile';
                }}
              >
                前往設定部位
                <CheckCircle2 className="w-4 h-4" />
              </a>
            </div>
          )}
        </div>

        <SingleStockInput onSubmit={handleSingleStockAnalyze} isLoading={isSingleStockLoading} availableTickers={availableTickers} />
        
        <div className="bg-indigo-50 rounded-2xl p-6 border border-indigo-100">
          <h3 className="text-sm font-semibold text-indigo-900 flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4" />
            運作方式
          </h3>
          <p className="text-sm text-indigo-800 leading-relaxed">
            此助理會根據您的具體持股部位、即時市場數據與最新新聞進行分析，在開盤前為您提供個人化且具體可行的投資洞察。
          </p>
        </div>
      </div>

      {/* Right Column: Output */}
      <div className="lg:col-span-8">
        <div className="flex space-x-4 mb-6 border-b border-slate-200">
          <button
            onClick={() => setActiveTab('portfolio')}
            className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'portfolio'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            投資組合報告
          </button>
          <button
            onClick={() => setActiveTab('singleStock')}
            className={`pb-3 px-2 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'singleStock'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <Search className="w-4 h-4" />
            單股指南報告
          </button>
        </div>

        {activeTab === 'portfolio' && (
          <>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl mb-6 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">分析失敗</h4>
                  <p className="text-sm mt-1 opacity-90">{error}</p>
                </div>
              </motion.div>
            )}

            {!report && !isLoading && !error && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                <Newspaper className="w-12 h-12 mb-4 text-slate-300" />
                <p className="text-sm font-medium">請輸入您的持股部位以產生分析報告</p>
              </div>
            )}

            {isLoading && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium animate-pulse">
                  {analysisStatus || "正在收集市場情報..."}
                </p>
              </div>
            )}

            {report && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 relative"
              >
                <ReportDisplay report={report} />
              </motion.div>
            )}
          </>
        )}

        {activeTab === 'singleStock' && (
          <>
            {singleStockError && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl mb-6 flex items-start gap-3"
              >
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-medium">分析失敗</h4>
                  <p className="text-sm mt-1 opacity-90">{singleStockError}</p>
                </div>
              </motion.div>
            )}

            {!singleStockReport && !isSingleStockLoading && !singleStockError && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-white/50">
                <Search className="w-12 h-12 mb-4 text-slate-300" />
                <p className="text-sm font-medium">請在左側輸入單一股票代號以產生開盤指南</p>
              </div>
            )}

            {isSingleStockLoading && (
              <div className="h-full min-h-[400px] flex flex-col items-center justify-center text-slate-500 bg-white rounded-2xl border border-slate-200 shadow-sm">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-sm font-medium animate-pulse">{analysisStatus || "正在收集單股市場情報..."}</p>
              </div>
            )}

            {(singleStockDashboard || singleStockReport) && !isSingleStockLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="bg-zinc-950 rounded-3xl shadow-xl border border-white/10 overflow-hidden"
              >
                {/* Header */}
                <button 
                  onClick={() => setIsSingleStockExpanded(!isSingleStockExpanded)}
                  className="w-full flex items-center justify-between p-6 bg-zinc-900 hover:bg-zinc-800 transition-colors border-b border-white/5"
                >
                  <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold text-white">
                      {singleStockDashboard?.stock_name || '單股指南報告'}
                    </h2>
                    {singleStockDashboard?.decision_type && (
                      <span className={`px-3 py-1 rounded-full text-sm font-medium uppercase ${
                        singleStockDashboard.decision_type === 'buy' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                        singleStockDashboard.decision_type === 'sell' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                        'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}>
                        {singleStockDashboard.decision_type === 'buy' ? '建議買入' : 
                         singleStockDashboard.decision_type === 'sell' ? '建議賣出' : '建議觀望'}
                      </span>
                    )}
                  </div>
                  {isSingleStockExpanded ? (
                    <ChevronUp className="w-5 h-5 text-zinc-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-zinc-400" />
                  )}
                </button>

                {/* Content */}
                {isSingleStockExpanded && (
                  <div className="p-6">
                    {singleStockDashboard ? (
                      <DecisionDashboardDisplay data={singleStockDashboard} />
                    ) : (
                      <div className="bg-white rounded-2xl p-8">
                        <ReportDisplay report={singleStockReport} />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
