import React, { useState } from "react";
import { Position } from "../types";

interface Props {
  onSubmit: (positions: Position[]) => void;
  isLoading: boolean;
}

export default function PortfolioInput({ onSubmit, isLoading }: Props) {
  const [input, setInput] = useState("NVDA 50 720\nTSLA 20 240");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      let parsedPositions: Position[] = [];

      // Try JSON parsing first
      if (input.trim().startsWith("[")) {
        const json = JSON.parse(input);
        if (!Array.isArray(json)) throw new Error("JSON 必須是一個陣列");
        parsedPositions = json.map((item: any) => {
          if (!item.ticker || !item.shares || !item.avg_price) {
            throw new Error("JSON 項目必須包含 ticker, shares, 和 avg_price");
          }
          return {
            ticker: item.ticker.toUpperCase(),
            shares: Number(item.shares),
            avgPrice: Number(item.avg_price),
          };
        });
      } else {
        // Simple text parsing
        const lines = input.split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const parts = trimmed.split(/\s+/);
          if (parts.length !== 3) {
            throw new Error(`無效的行格式: "${line}"。預期格式為 "股票代號 股數 平均成本"`);
          }
          const [ticker, shares, avgPrice] = parts;
          parsedPositions.push({
            ticker: ticker.toUpperCase(),
            shares: Number(shares),
            avgPrice: Number(avgPrice),
          });
        }
      }

      if (parsedPositions.length === 0) {
        throw new Error("找不到有效的持股部位");
      }

      // Validate numbers
      for (const pos of parsedPositions) {
        if (isNaN(pos.shares) || pos.shares <= 0) throw new Error(`${pos.ticker} 的股數無效`);
        if (isNaN(pos.avgPrice) || pos.avgPrice <= 0) throw new Error(`${pos.ticker} 的平均成本無效`);
      }

      onSubmit(parsedPositions);
    } catch (err: any) {
      setError(err.message || "解析輸入失敗");
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">輸入投資組合</h2>
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-medium text-slate-700 mb-2">
            輸入您的持股部位 (支援純文字或 JSON 格式)
          </label>
          <textarea
            className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="NVDA 50 720&#10;TSLA 20 240"
            disabled={isLoading}
          />
          <p className="text-xs text-slate-500 mt-2">
            格式: <code>股票代號 股數 平均成本</code> (例如: NVDA 50 720)
          </p>
        </div>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-lg border border-red-100">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-slate-900 hover:bg-slate-800 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              分析投資組合中...
            </>
          ) : (
            "產生開盤分析報告"
          )}
        </button>
      </form>
    </div>
  );
}
