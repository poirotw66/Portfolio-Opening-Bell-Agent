import React, { useState } from "react";
import { motion } from "motion/react";
import { Activity, TrendingUp, AlertCircle, Newspaper } from "lucide-react";
import PortfolioInput from "./components/PortfolioInput";
import ReportDisplay from "./components/ReportDisplay";
import { Position, PositionAnalytics, MarketData, NewsItem, MarketContext } from "./types";
import { fetchMarketData, fetchNews, fetchMarketContext } from "./services/marketService";
import { generateOpeningBellBrief } from "./services/geminiService";

export default function App() {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [newsData, setNewsData] = useState<Record<string, NewsItem[]>>({});

  const handleAnalyze = async (positions: Position[]) => {
    setIsLoading(true);
    setError("");
    setReport("");
    setNewsData({});

    try {
      const tickers = positions.map((p) => p.ticker);

      // Fetch all data in parallel
      const [marketData, news, marketContext] = await Promise.all([
        fetchMarketData(tickers),
        fetchNews(tickers),
        fetchMarketContext(),
      ]);

      setNewsData(news);

      // Calculate analytics
      const analytics: PositionAnalytics[] = positions.map((pos) => {
        const data = marketData.find((m) => m.ticker === pos.ticker);
        const currentPrice = data?.price || pos.avgPrice; // Fallback to avg if error
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

      // Generate AI Report
      const aiReport = await generateOpeningBellBrief(analytics, marketContext, news);
      setReport(aiReport);
    } catch (err: any) {
      setError(err.message || "分析過程中發生錯誤。");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">
              開盤投資組合助理
            </h1>
          </div>
          <div className="text-sm font-medium text-slate-500 flex items-center gap-1">
            <TrendingUp className="w-4 h-4" />
            部位感知 AI
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Input */}
          <div className="lg:col-span-4 space-y-6">
            <PortfolioInput onSubmit={handleAnalyze} isLoading={isLoading} />
            
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
                <p className="text-sm font-medium animate-pulse">正在收集市場情報...</p>
              </div>
            )}

            {report && !isLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <ReportDisplay report={report} />
              </motion.div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

