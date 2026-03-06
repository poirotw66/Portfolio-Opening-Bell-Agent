import React from 'react';
import { MarketData, Position } from '../types';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface Props {
  data: MarketData[];
  positions: Position[];
  isLoading: boolean;
}

export function MarketGrid({ data, positions, isLoading }: Props) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 flex justify-center items-center min-h-[150px] mb-6">
        <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!data || data.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">即時行情庫存</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {data.map((item) => {
          const position = positions.find(p => p.ticker === item.ticker);
          const isUp = item.changePercent >= 0;
          // 台灣股市習慣：紅漲綠跌
          const colorClass = isUp ? 'text-red-500' : 'text-emerald-500';
          const borderColorClass = isUp ? 'border-red-400' : 'border-emerald-400';

          return (
            <div key={item.ticker} className={`border ${borderColorClass} bg-white flex flex-col`}>
              <div className="bg-slate-100 text-center py-1.5 border-b border-slate-200 text-slate-700 font-medium text-lg">
                {item.ticker}
              </div>
              <div className="p-3 flex flex-col items-center justify-center flex-grow">
                <div className={`text-3xl font-bold ${colorClass} mb-3 tracking-tight`}>
                  {item.price?.toFixed(4)}
                </div>
                <div className={`flex items-center justify-between w-full px-1 text-sm font-medium ${colorClass} mb-2`}>
                  <span className="flex items-center gap-1">
                    {item.change?.toFixed(4)}
                    {isUp ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                  </span>
                  <span>
                    {item.changePercent?.toFixed(2)}%
                  </span>
                </div>
                {position && (
                  <div className="w-full pt-2 border-t border-slate-100 flex justify-between text-xs text-slate-500">
                    <span>均價: {position.avgPrice}</span>
                    <span>股數: {position.shares}</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
