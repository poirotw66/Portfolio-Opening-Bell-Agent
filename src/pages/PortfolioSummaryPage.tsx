import React from "react";
import { Position, MarketData } from "../types";
import { AlertCircle, RefreshCw, PieChart as PieChartIcon } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { usePortfolioMarketData } from "../hooks/usePortfolioMarketData";

const COLORS = ['#4F46E5', '#60A5FA', '#10B981', '#34D399', '#8B5CF6', '#F59E0B', '#EF4444', '#6B7280'];

interface ChartData {
  name: string;
  value: number;
  percentage: number;
  color: string;
  pl: number;
  plPercent: number;
}

export function PortfolioSummaryPage() {
  const {
    positions: savedPositions,
    marketData,
    isLoading,
    error,
    reload,
  } = usePortfolioMarketData();

  let totalCost = 0;
  let totalCurrentValue = 0;

  const chartData: ChartData[] = savedPositions.map((pos, index) => {
    const md = marketData.find(m => m.ticker === pos.ticker);
    const currentPrice = md?.price || pos.avgPrice; // fallback to avgPrice if fetch fails
    const cost = pos.shares * pos.avgPrice;
    const currentValue = pos.shares * currentPrice;
    
    totalCost += cost;
    totalCurrentValue += currentValue;
    
    const pl = currentValue - cost;
    const plPercent = cost > 0 ? (pl / cost) * 100 : 0;
    
    return {
      name: pos.ticker,
      value: currentValue,
      percentage: 0, // calculated below
      color: COLORS[index % COLORS.length],
      pl,
      plPercent
    };
  });

  // Calculate percentages and sort by value descending
  chartData.forEach(d => {
    d.percentage = totalCurrentValue > 0 ? (d.value / totalCurrentValue) * 100 : 0;
  });
  chartData.sort((a, b) => b.value - a.value);

  const totalReturn = totalCurrentValue - totalCost;
  const totalReturnPercent = totalCost > 0 ? (totalReturn / totalCost) * 100 : 0;

  // Taiwan stock market convention: Red for profit, Green for loss
  const isUp = totalReturn >= 0;
  const colorClass = isUp ? 'text-red-500' : 'text-emerald-500';
  const sign = isUp ? '+' : '';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
          <PieChartIcon className="w-6 h-6 text-indigo-600" />
          帳務總覽
        </h2>
        <button 
          onClick={() => void reload()}
          disabled={isLoading}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
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

      {!isLoading && savedPositions.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-sm">
          <p className="text-slate-500 font-medium">您尚未儲存任何投資組合。</p>
          <p className="text-sm text-slate-400 mt-2">請先至「分析中心」輸入並儲存您的持股。</p>
        </div>
      )}

      {isLoading && savedPositions.length > 0 && marketData.length === 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 flex flex-col justify-center items-center min-h-[300px]">
          <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
          <p className="text-slate-500 font-medium animate-pulse">正在計算投資組合現值...</p>
        </div>
      )}

      {(!isLoading || marketData.length > 0) && savedPositions.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-3xl mx-auto">
          <div className="flex items-center gap-2 mb-8 text-slate-700 font-medium">
            <span>庫存現值比例</span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-600">總資產</span>
          </div>

          <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-16 mb-10">
            {/* Chart Area */}
            <div className="relative w-64 h-64 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={85}
                    outerRadius={115}
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  />
                </PieChart>
              </ResponsiveContainer>
              
              {/* Center Text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-sm text-slate-500 font-medium mb-1">USD</span>
                <span className="text-2xl font-bold text-slate-900 tracking-tight">
                  {totalCurrentValue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className={`text-sm font-bold mt-1 ${colorClass}`}>
                  ({sign}{totalReturnPercent.toFixed(2)}%)
                </span>
              </div>
            </div>

            {/* Legend Area */}
            <div className="w-full md:w-auto">
              <div className="space-y-4">
                {chartData.map((item) => {
                  const isItemUp = item.pl >= 0;
                  const itemColorClass = isItemUp ? 'text-red-500' : 'text-emerald-500';
                  const itemSign = isItemUp ? '+' : '';
                  
                  return (
                    <div key={item.name} className="flex items-center gap-4">
                      <div className="w-3.5 h-3.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-slate-700 font-semibold w-16 text-right">{item.percentage.toFixed(1)}%</span>
                      <span className="text-slate-500 font-medium w-16">{item.name}</span>
                      <span className={`font-medium ${itemColorClass}`}>
                        {itemSign}{item.pl.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({itemSign}{item.plPercent.toFixed(2)}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Bottom Stats */}
          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-100">
            <div>
              <div className="text-sm text-slate-500 font-medium mb-1">總成本</div>
              <div className="text-xl font-bold text-slate-900">
                {totalCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
            <div className="pl-6 border-l border-slate-100">
              <div className="text-sm text-slate-500 font-medium mb-1">不含息參考報酬</div>
              <div className={`text-xl font-bold ${colorClass}`}>
                {sign}{totalReturn.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
