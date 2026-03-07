import React, { useState, useRef, useEffect } from "react";
import { Position } from "../types";
import { Plus, Trash2, Upload, Code, List, Save } from "lucide-react";

interface Props {
  onSave: (positions: Position[]) => void;
  isLoading: boolean;
  onTickersChange?: (tickers: string[]) => void;
}

export default function PortfolioInput({ onSave, isLoading, onTickersChange }: Props) {
  const [inputMode, setInputMode] = useState<'ui' | 'json'>('ui');
  
  // UI Mode State
  const [uiPositions, setUiPositions] = useState([
    { id: '1', ticker: 'NVDA', shares: '50', avgPrice: '720' },
    { id: '2', ticker: 'TSLA', shares: '20', avgPrice: '240' }
  ]);
  
  // JSON Mode State
  const [jsonInput, setJsonInput] = useState('[\n  {\n    "ticker": "NVDA",\n    "shares": 50,\n    "avg_price": 720\n  },\n  {\n    "ticker": "TSLA",\n    "shares": 20,\n    "avg_price": 240\n  }\n]');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('portfolio');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const withIds = parsed.map((p: any, i: number) => ({
            id: Date.now().toString() + i,
            ticker: p.ticker,
            shares: p.shares.toString(),
            avgPrice: p.avgPrice.toString()
          }));
          setUiPositions(withIds);
          setJsonInput(JSON.stringify(parsed, null, 2));
        }
      } catch (e) {
        console.error("Failed to parse saved portfolio", e);
      }
    }
  }, []);

  useEffect(() => {
    if (!onTickersChange) return;

    try {
      if (inputMode === 'ui') {
        const tickers = uiPositions.map(p => p.ticker.trim().toUpperCase()).filter(t => t !== '');
        onTickersChange(Array.from(new Set(tickers)));
      } else {
        if (!jsonInput.trim()) {
          onTickersChange([]);
          return;
        }
        const json = JSON.parse(jsonInput);
        if (Array.isArray(json)) {
          const tickers = json
            .map((item: any) => String(item.ticker || '').toUpperCase().trim())
            .filter(t => t !== '');
          onTickersChange(Array.from(new Set(tickers)));
        }
      }
    } catch (e) {
      // Ignore parse errors while typing
    }
  }, [uiPositions, jsonInput, inputMode, onTickersChange]);

  const handleAddPosition = () => {
    setUiPositions([...uiPositions, { id: Date.now().toString(), ticker: '', shares: '', avgPrice: '' }]);
  };

  const handleRemovePosition = (id: string) => {
    setUiPositions(uiPositions.filter(p => p.id !== id));
  };

  const handlePositionChange = (id: string, field: 'ticker' | 'shares' | 'avgPrice', value: string) => {
    setUiPositions(uiPositions.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        // Validate JSON
        JSON.parse(content);
        setJsonInput(content);
        setError("");
      } catch (err) {
        setError("上傳的檔案不是有效的 JSON 格式");
      }
    };
    reader.readAsText(file);
    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const getParsedPositions = () => {
    let parsedPositions: Position[] = [];

    if (inputMode === 'json') {
      if (!jsonInput.trim()) throw new Error("JSON 內容不能為空");
      const json = JSON.parse(jsonInput);
      if (!Array.isArray(json)) throw new Error("JSON 必須是一個陣列");
      parsedPositions = json.map((item: any) => {
        if (!item.ticker || item.shares === undefined || item.avg_price === undefined) {
          throw new Error("JSON 項目必須包含 ticker, shares, 和 avg_price");
        }
        return {
          ticker: String(item.ticker).toUpperCase().trim(),
          shares: Number(item.shares),
          avgPrice: Number(item.avg_price),
        };
      });
    } else {
      // UI Mode
      const validPositions = uiPositions.filter(p => p.ticker.trim() !== '');
      if (validPositions.length === 0) throw new Error("請至少輸入一檔股票");
      
      parsedPositions = validPositions.map(p => ({
        ticker: p.ticker.toUpperCase().trim(),
        shares: Number(p.shares),
        avgPrice: Number(p.avgPrice)
      }));
    }

    if (parsedPositions.length === 0) {
      throw new Error("找不到有效的持股部位");
    }

    // Validate numbers
    for (const pos of parsedPositions) {
      if (!pos.ticker) throw new Error("股票代號不能為空");
      if (isNaN(pos.shares) || pos.shares <= 0) throw new Error(`${pos.ticker} 的股數無效`);
      if (isNaN(pos.avgPrice) || pos.avgPrice <= 0) throw new Error(`${pos.ticker} 的平均成本無效`);
    }

    return parsedPositions;
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsSaved(false);
    try {
      const parsedPositions = getParsedPositions();
      localStorage.setItem('portfolio', JSON.stringify(parsedPositions));
      onSave(parsedPositions);
      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 3000);
    } catch (err: any) {
      setError(err.message || "解析輸入失敗");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-900">設定投資組合</h2>
        <div className="flex bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setInputMode('ui')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors ${
              inputMode === 'ui' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <List className="w-4 h-4" />
            介面輸入
          </button>
          <button
            type="button"
            onClick={() => setInputMode('json')}
            className={`px-3 py-1.5 text-sm font-medium rounded-md flex items-center gap-1.5 transition-colors ${
              inputMode === 'json' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Code className="w-4 h-4" />
            JSON 格式
          </button>
        </div>
      </div>

      <form onSubmit={handleSave}>
        {inputMode === 'ui' ? (
          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-500 px-1">
              <div className="col-span-4">股票代號</div>
              <div className="col-span-3">股數</div>
              <div className="col-span-4">平均成本</div>
              <div className="col-span-1"></div>
            </div>
            {uiPositions.map((pos) => (
              <div key={pos.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-4">
                  <input
                    type="text"
                    placeholder="AAPL"
                    value={pos.ticker}
                    onChange={(e) => handlePositionChange(pos.id, 'ticker', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all uppercase"
                    disabled={isLoading}
                  />
                </div>
                <div className="col-span-3">
                  <input
                    type="number"
                    placeholder="100"
                    min="0"
                    step="any"
                    value={pos.shares}
                    onChange={(e) => handlePositionChange(pos.id, 'shares', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    disabled={isLoading}
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    placeholder="150.5"
                    min="0"
                    step="any"
                    value={pos.avgPrice}
                    onChange={(e) => handlePositionChange(pos.id, 'avgPrice', e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
                    disabled={isLoading}
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  <button
                    type="button"
                    onClick={() => handleRemovePosition(pos.id)}
                    disabled={isLoading || uiPositions.length === 1}
                    className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={handleAddPosition}
              disabled={isLoading}
              className="w-full py-2 border-2 border-dashed border-slate-200 text-slate-500 hover:border-indigo-300 hover:text-indigo-600 rounded-lg text-sm font-medium flex items-center justify-center gap-1.5 transition-colors mt-2"
            >
              <Plus className="w-4 h-4" />
              新增持股
            </button>
          </div>
        ) : (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-slate-700">
                貼上 JSON 或上傳檔案
              </label>
              <div>
                <input
                  type="file"
                  accept=".json"
                  className="hidden"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  disabled={isLoading}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded-md transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  上傳 JSON 檔案
                </button>
              </div>
            </div>
            <textarea
              className="w-full h-48 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
              value={jsonInput}
              onChange={(e) => setJsonInput(e.target.value)}
              placeholder="[\n  {\n    &#34;ticker&#34;: &#34;AAPL&#34;,\n    &#34;shares&#34;: 100,\n    &#34;avg_price&#34;: 150.5\n  }\n]"
              disabled={isLoading}
            />
          </div>
        )}
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className={`w-full font-medium py-3 px-4 rounded-xl transition-all flex items-center justify-center gap-2 ${
            isSaved 
              ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' 
              : 'bg-slate-900 hover:bg-slate-800 text-white'
          }`}
        >
          {isSaved ? (
            <>
              <Save className="w-4 h-4" />
              已儲存投資組合
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              儲存投資組合
            </>
          )}
        </button>
      </form>
    </div>
  );
}
