import { MarketGrid } from "../components/MarketGrid";
import { AlertCircle, RefreshCw } from "lucide-react";
import { usePortfolioMarketData } from "../hooks/usePortfolioMarketData";

export function MarketPage() {
  const {
    positions: savedPositions,
    marketData: marketGridData,
    isLoading: isGridLoading,
    error,
    reload,
  } = usePortfolioMarketData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">即時行情庫存</h2>
        <button 
          onClick={() => void reload()}
          disabled={isGridLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isGridLoading ? 'animate-spin' : ''}`} />
          重新整理
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 p-4 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium">載入失敗</h4>
            <p className="text-sm mt-1 opacity-90">{error}</p>
          </div>
        </div>
      )}

      {!isGridLoading && savedPositions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
          <p className="text-slate-500 font-medium">您尚未儲存任何投資組合。</p>
          <p className="text-sm text-slate-400 mt-2">請先至「分析中心」輸入並儲存您的持股。</p>
        </div>
      )}

      {(isGridLoading || marketGridData.length > 0) && (
        <MarketGrid data={marketGridData} positions={savedPositions} isLoading={isGridLoading} />
      )}
    </div>
  );
}
