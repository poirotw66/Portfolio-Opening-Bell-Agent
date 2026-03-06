import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';

interface SingleStockInputProps {
  onSubmit: (ticker: string) => void;
  isLoading: boolean;
  availableTickers: string[];
}

export function SingleStockInput({ onSubmit, isLoading, availableTickers }: SingleStockInputProps) {
  const [selectedTicker, setSelectedTicker] = useState('');
  const [customTicker, setCustomTicker] = useState('');
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    if (availableTickers.length > 0 && !selectedTicker && !isCustom) {
      setSelectedTicker(availableTickers[0]);
    } else if (availableTickers.length > 0 && selectedTicker && !availableTickers.includes(selectedTicker) && !isCustom) {
      setSelectedTicker(availableTickers[0]);
    }
  }, [availableTickers, selectedTicker, isCustom]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const tickerToSubmit = isCustom ? customTicker : selectedTicker;
    if (tickerToSubmit.trim()) {
      onSubmit(tickerToSubmit.trim().toUpperCase());
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">單一股票開盤指南</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            選擇或輸入股票代號
          </label>
          
          <div className="space-y-3">
            <select
              className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={isCustom ? 'CUSTOM' : selectedTicker}
              onChange={(e) => {
                if (e.target.value === 'CUSTOM') {
                  setIsCustom(true);
                } else {
                  setIsCustom(false);
                  setSelectedTicker(e.target.value);
                }
              }}
              disabled={isLoading}
            >
              {availableTickers.length === 0 && <option value="" disabled>無可用持股，請先新增</option>}
              {availableTickers.map(t => (
                <option key={t} value={t}>{t}</option>
              ))}
              <option value="CUSTOM">+ 自訂輸入其他股票...</option>
            </select>

            {isCustom && (
              <input
                type="text"
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all uppercase"
                placeholder="例如: AAPL"
                value={customTicker}
                onChange={(e) => setCustomTicker(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            )}
          </div>
        </div>
        <button
          type="submit"
          disabled={isLoading || (isCustom ? !customTicker.trim() : !selectedTicker)}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              分析中...
            </>
          ) : (
            <>
              <Search className="w-4 h-4" />
              產生單股指南
            </>
          )}
        </button>
      </form>
    </div>
  );
}
