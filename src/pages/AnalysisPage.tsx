import React, { useState, useEffect } from "react";
import { motion } from "motion/react";
import { AlertCircle, Newspaper, Briefcase, Search } from "lucide-react";
import PortfolioInput from "../components/PortfolioInput";
import { SingleStockInput } from "../components/SingleStockInput";
import ReportDisplay from "../components/ReportDisplay";
import { Position, PositionAnalytics, NewsItem } from "../types";
import { fetchMarketData, fetchNews, fetchMarketContext } from "../services/marketService";
import { generateOpeningBellBrief, generateSingleStockBrief } from "../services/geminiService";

export function AnalysisPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [report, setReport] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [newsData, setNewsData] = useState<Record<string, NewsItem[]>>({});

  const [activeTab, setActiveTab] = useState<'portfolio' | 'singleStock'>('portfolio');
  const [singleStockReport, setSingleStockReport] = useState<string>("");
  const [isSingleStockLoading, setIsSingleStockLoading] = useState(false);
  const [singleStockError, setSingleStockError] = useState<string>("");
  const [availableTickers, setAvailableTickers] = useState<string[]>(['NVDA', 'TSLA']);

  const [savedPositions, setSavedPositions] = useState<Position[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('portfolio');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSavedPositions(parsed);
        }
      } catch (e) {}
    }
  }, []);

  const handleSavePortfolio = async (positions: Position[]) => {
    setSavedPositions(positions);
  };

  const handleAnalyze = async (positions: Position[]) => {
    setIsLoading(true);
    setError("");
    setReport("");
    setNewsData({});
    setActiveTab('portfolio');

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

  const handleSingleStockAnalyze = async (ticker: string) => {
    setIsSingleStockLoading(true);
    setSingleStockError("");
    setSingleStockReport("");
    setActiveTab('singleStock');

    try {
      const [marketData, news, marketContext] = await Promise.all([
        fetchMarketData([ticker]),
        fetchNews([ticker]),
        fetchMarketContext(),
      ]);

      const data = marketData[0];
      if (data.error) {
        throw new Error(`無法取得 ${ticker} 的市場數據`);
      }

      const tickerNews = news[ticker] || [];
      const position = savedPositions.find(p => p.ticker === ticker);
      const aiReport = await generateSingleStockBrief(ticker, data, tickerNews, marketContext, position);
      setSingleStockReport(aiReport);
    } catch (err: any) {
      setSingleStockError(err.message || "分析過程中發生錯誤。");
    } finally {
      setIsSingleStockLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
      {/* Left Column: Input */}
      <div className="lg:col-span-4 space-y-6">
        <PortfolioInput onSubmit={handleAnalyze} onSave={handleSavePortfolio} isLoading={isLoading} onTickersChange={setAvailableTickers} />
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
                <p className="text-sm font-medium animate-pulse">正在收集單股市場情報...</p>
              </div>
            )}

            {singleStockReport && !isSingleStockLoading && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <ReportDisplay report={singleStockReport} />
              </motion.div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
