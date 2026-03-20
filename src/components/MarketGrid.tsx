import { MarketData, Position } from '../types';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

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
    <div className="mb-8">
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-5 h-5 text-indigo-600" />
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">即時行情庫存</h2>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.map((item) => {
          const position = positions.find(p => p.ticker === item.ticker);
          const isUp = item.changePercent >= 0;
          // 台灣股市習慣：紅漲綠跌
          const colorClass = isUp ? 'text-red-600' : 'text-emerald-600';
          const bgColorClass = isUp ? 'bg-red-50' : 'bg-emerald-50';
          const accentColorClass = isUp ? 'bg-red-500' : 'bg-emerald-500';

          let positionColorClass = "bg-slate-100 text-slate-500 border-slate-200";
          if (position && item.price) {
            if (item.price > position.avgPrice) {
              positionColorClass = "bg-red-50 text-red-600 border-red-200";
            } else if (item.price < position.avgPrice) {
              positionColorClass = "bg-emerald-50 text-emerald-600 border-emerald-200";
            }
          }

          return (
            <div 
              key={item.ticker} 
              className="relative overflow-hidden rounded-2xl bg-white border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 group"
            >
              {/* Top Accent Line */}
              <div className={`absolute top-0 left-0 right-0 h-1 ${accentColorClass}`} />
              
              <div className="p-5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">{item.ticker}</h3>
                    {position && (
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs font-medium">
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md border border-slate-200">
                          {position.shares} 股
                        </span>
                        <span className={`px-2 py-0.5 rounded-md border ${positionColorClass}`}>
                          均價 ${position.avgPrice.toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${bgColorClass} ${colorClass}`}>
                    {isUp ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                </div>

                <div className="flex items-baseline gap-2 mb-1">
                  <span className={`text-3xl font-bold tracking-tight ${colorClass}`}>
                    {item.price?.toFixed(2)}
                  </span>
                  <span className="text-sm font-medium text-slate-400">USD</span>
                </div>

                <div className={`flex items-center gap-2 text-sm font-semibold ${colorClass}`}>
                  <span>{isUp ? '+' : ''}{item.change?.toFixed(2)}</span>
                  <span className="flex items-center px-1.5 py-0.5 rounded-md bg-white/50">
                    ({isUp ? '+' : ''}{item.changePercent?.toFixed(2)}%)
                  </span>
                </div>

                {/* Technical Indicators */}
                {(item.sma20 || item.rsi14 || item.oneMonthPerformance) && (
                  <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-3 gap-2">
                    {item.sma20 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">SMA 20</div>
                        <div className="text-sm font-medium text-slate-700">${item.sma20.toFixed(2)}</div>
                      </div>
                    )}
                    {item.rsi14 && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">RSI 14</div>
                        <div className={`text-sm font-medium ${
                          item.rsi14 > 70 ? 'text-red-600' : 
                          item.rsi14 < 30 ? 'text-emerald-600' : 
                          'text-slate-700'
                        }`}>
                          {item.rsi14.toFixed(1)}
                        </div>
                      </div>
                    )}
                    {item.oneMonthPerformance && (
                      <div>
                        <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold mb-1">近一月</div>
                        <div className={`text-sm font-medium ${
                          item.oneMonthPerformance > 0 ? 'text-red-600' : 
                          item.oneMonthPerformance < 0 ? 'text-emerald-600' : 
                          'text-slate-700'
                        }`}>
                          {item.oneMonthPerformance > 0 ? '+' : ''}{item.oneMonthPerformance.toFixed(2)}%
                        </div>
                      </div>
                    )}
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
