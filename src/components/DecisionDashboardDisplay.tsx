import React from 'react';
import { motion } from 'motion/react';
import { 
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, 
  Target, Zap, BarChart3,
  ArrowUpRight, ArrowDownRight, Minus, FileText
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { DecisionDashboard } from '../types';
import ReportDisplay from './ReportDisplay';

interface Props {
  data: DecisionDashboard;
}

/** Derive display values from real market data when AI dashboard fields are missing or zero. */
function getResolvedDataPerspective(data: DecisionDashboard) {
  const dp = data.dashboard?.data_perspective;
  const md = data.marketData;

  const biasMa20 = md?.sma20 != null && md.price != null && md.sma20 > 0
    ? ((md.price - md.sma20) / md.sma20) * 100
    : null;
  const maAlignment =
    dp?.trend_status?.ma_alignment && dp.trend_status.ma_alignment !== '數據讀取中'
      ? dp.trend_status.ma_alignment
      : md?.sma20 != null && md.price != null
        ? (md.price >= md.sma20 ? '價在 MA20 之上' : '價在 MA20 之下')
        : '—';
  const isBullish =
    dp?.trend_status?.is_bullish ?? (md?.sma20 != null && md.price != null ? md.price >= md.sma20 : null);
  const trendScore = dp?.trend_status?.trend_score ?? (typeof dp?.trend_status?.trend_score === 'number' && dp.trend_status.trend_score > 0 ? dp.trend_status.trend_score : null);
  const supportLevel = dp?.price_position?.support_level ?? (md?.sma20 != null ? md.sma20 * 0.97 : null);
  const resistanceLevel = dp?.price_position?.resistance_level ?? (md?.sma20 != null ? md.sma20 * 1.03 : null);
  const volumeStatus =
    dp?.volume_analysis?.volume_status && dp.volume_analysis.volume_status !== 'N/A'
      ? dp.volume_analysis.volume_status
      : md?.volume != null
        ? `成交量 ${md.volume.toLocaleString()}`
        : '—';

  return {
    maAlignment,
    isBullish,
    trendScore,
    biasMa20,
    biasStatus: dp?.price_position?.bias_status || (biasMa20 != null ? (biasMa20 > 5 ? '偏高' : biasMa20 < -2 ? '偏低' : '中性') : 'N/A'),
    supportLevel,
    resistanceLevel,
    volumeStatus,
  };
}

export const DecisionDashboardDisplay: React.FC<Props> = ({ data }) => {
  const resolved = getResolvedDataPerspective(data);

  const getDecisionColor = (type: string) => {
    switch (type) {
      case 'buy': return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case 'sell': return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
      default: return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-500';
    if (score >= 40) return 'text-amber-500';
    return 'text-rose-500';
  };

  return (
    <div className="space-y-8">
      {/* Stock Info Card - captured as image for single-stock report download */}
      {data.marketData && (
        <motion.div
          data-download-capture="stock-info-card"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-zinc-900 border border-white/5 relative overflow-hidden"
        >
          <div className={`absolute top-0 left-0 right-0 h-1 ${data.marketData.change >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
          
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="text-2xl font-bold text-white mb-2">{data.marketData.ticker}</h2>
              {data.position && (
                <div className="flex gap-2">
                  <span className="px-2 py-1 rounded bg-slate-800 text-slate-300 text-xs font-medium">
                    {data.position.shares} 股
                  </span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${data.marketData.price >= data.position.avgPrice ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                    均價 ${data.position.avgPrice.toFixed(2)}
                  </span>
                </div>
              )}
            </div>
            <div className={`p-2 rounded-full ${data.marketData.change >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
              {data.marketData.change >= 0 ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
            </div>
          </div>

          <div className="mb-6">
            <div className="flex items-baseline gap-2">
              <span className={`text-4xl font-bold ${data.marketData.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {data.marketData.price.toFixed(2)}
              </span>
              <span className="text-sm text-zinc-400 font-medium">USD</span>
            </div>
            <div className={`text-sm font-medium mt-1 ${data.marketData.change >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
              {data.marketData.change > 0 ? '+' : ''}{data.marketData.change.toFixed(2)} ({data.marketData.change > 0 ? '+' : ''}{data.marketData.changePercent.toFixed(2)}%)
            </div>
          </div>

          <div
            className="grid grid-cols-3 gap-4 pt-4 border-t border-white/5"
            style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}
          >
            <div>
              <div className="text-xs text-zinc-500 mb-1">SMA 20</div>
              <div className="text-sm text-white font-medium">${data.marketData.sma20?.toFixed(2) || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">RSI 14</div>
              <div className="text-sm text-white font-medium">{data.marketData.rsi14?.toFixed(2) || 'N/A'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500 mb-1">近一月</div>
              <div className={`text-sm font-medium ${data.marketData.oneMonthPerformance && data.marketData.oneMonthPerformance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {data.marketData.oneMonthPerformance ? `${data.marketData.oneMonthPerformance > 0 ? '+' : ''}${data.marketData.oneMonthPerformance.toFixed(2)}%` : 'N/A'}
              </div>
            </div>
          </div>

          {data.marketData.history && data.marketData.history.length > 0 && (
            <div
              className="mt-6 w-full"
              data-pdf-chart="true"
              style={{ height: 192, minHeight: 192, overflow: "hidden" }}
            >
              <ResponsiveContainer width="100%" height={192} minWidth={320} minHeight={192}>
                <LineChart data={data.marketData.history}>
                  <XAxis 
                    dataKey="date" 
                    hide 
                  />
                  <YAxis 
                    domain={['auto', 'auto']} 
                    hide 
                  />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#18181b', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
                    itemStyle={{ color: '#fff' }}
                    labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
                    formatter={(value: unknown) => [`$${(value as number).toFixed(2)}`, 'Price']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="close" 
                    stroke={data.marketData.change >= 0 ? '#10b981' : '#f43f5e'} 
                    strokeWidth={2} 
                    dot={false} 
                    activeDot={{ r: 4, fill: data.marketData.change >= 0 ? '#10b981' : '#f43f5e' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </motion.div>
      )}

      {/* Header Summary - force 3-col on wide viewport so PDF export keeps layout */}
      <div
        data-download-capture="header-summary"
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
        style={
          typeof window !== "undefined" && window.innerWidth >= 768
            ? { gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }
            : undefined
        }
      >
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 rounded-2xl bg-zinc-900 border border-white/5 flex flex-col items-center justify-center text-center"
        >
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">市場情緒評分</span>
          <div className={`text-5xl font-bold ${getScoreColor(data.sentiment_score)}`}>
            {data.sentiment_score}
          </div>
          <span className="text-sm text-zinc-400 mt-2">{data.trend_prediction}</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="p-6 rounded-2xl bg-zinc-900 border border-white/5 flex flex-col items-center justify-center text-center"
        >
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">核心操作建議</span>
          <div className={`px-4 py-1 rounded-full border text-sm font-medium uppercase mb-2 ${getDecisionColor(data.decision_type)}`}>
            {data.decision_type === 'buy' ? '建議買入' : data.decision_type === 'sell' ? '建議賣出' : '建議觀望'}
          </div>
          <div className="text-xl font-bold text-white">{data.operation_advice}</div>
          <span className="text-xs text-zinc-500 mt-2">信心水準: {data.confidence_level}</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="p-6 rounded-2xl bg-zinc-900 border border-white/5 flex flex-col items-center justify-center text-center"
        >
          <span className="text-xs font-mono uppercase tracking-widest text-zinc-500 mb-2">一言以蔽之</span>
          <div className="text-lg font-medium text-white italic">"{data.dashboard?.core_conclusion?.one_sentence || '尚無結論'}"</div>
          <div className="mt-2 flex gap-2">
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 uppercase">{data.dashboard?.core_conclusion?.signal_type || 'N/A'}</span>
            <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-zinc-400 uppercase">{data.dashboard?.core_conclusion?.time_sensitivity || 'N/A'}</span>
          </div>
        </motion.div>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Data Perspective: merge AI dashboard with real marketData when AI fields are empty */}
        <div className="space-y-4">
          <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> 數據透視分析
          </h3>
          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/5 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-zinc-500">趨勢狀態</span>
                <div className="flex items-center gap-2 text-white font-medium">
                  {resolved.isBullish === true ? <TrendingUp className="w-4 h-4 text-emerald-500" /> : resolved.isBullish === false ? <TrendingDown className="w-4 h-4 text-rose-500" /> : <Minus className="w-4 h-4 text-zinc-500" />}
                  {resolved.maAlignment}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-zinc-500">趨勢強度評分</span>
                <div className="text-white font-medium">{resolved.trendScore != null ? `${resolved.trendScore}/100` : '—'}</div>
              </div>
            </div>

            <div className="h-px bg-white/5" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs text-zinc-500">乖離率 (MA20)</span>
                <div className={`font-medium ${(resolved.biasMa20 ?? 0) > 5 ? 'text-rose-500' : (resolved.biasMa20 ?? 0) < -2 ? 'text-emerald-500' : 'text-zinc-300'}`}>
                  {resolved.biasMa20 != null ? `${resolved.biasMa20.toFixed(2)}% (${resolved.biasStatus})` : 'N/A'}
                </div>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-zinc-500">成交量能狀態</span>
                <div className="text-white font-medium">{resolved.volumeStatus}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="flex justify-between text-zinc-500">
                <span>關鍵支撐位</span>
                <span className="text-white">{resolved.supportLevel != null ? `$${resolved.supportLevel.toFixed(2)}` : '—'}</span>
              </div>
              <div className="flex justify-between text-zinc-500">
                <span>關鍵壓力位</span>
                <span className="text-white">{resolved.resistanceLevel != null ? `$${resolved.resistanceLevel.toFixed(2)}` : '—'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Intelligence & Sentiment */}
        <div className="space-y-4">
          <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2">
            <Zap className="w-4 h-4" /> 深度情報與催化劑
          </h3>
          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/5 space-y-4">
            <div>
              <span className="text-xs text-zinc-500 block mb-2">最新市場動態</span>
              <p className="text-sm text-zinc-300 leading-relaxed">{data.dashboard?.intelligence?.latest_news || '暫無動態'}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <ArrowUpRight className="w-3 h-3" /> 利多催化因素
                </span>
                <ul className="text-[11px] text-zinc-400 space-y-1">
                  {data.dashboard?.intelligence?.positive_catalysts?.map((c, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-500">•</span> {c}
                    </li>
                  )) || <li>無</li>}
                </ul>
              </div>
              <div className="space-y-2">
                <span className="text-xs text-rose-500 font-medium flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> 潛在風險警示
                </span>
                <ul className="text-[11px] text-zinc-400 space-y-1">
                  {data.dashboard?.intelligence?.risk_alerts?.map((r, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-rose-500">•</span> {r}
                    </li>
                  )) || <li>無</li>}
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Battle Plan */}
      <div className="space-y-4">
        <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <Target className="w-4 h-4" /> 實戰交易部署
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/5">
            <span className="text-xs text-zinc-500 block mb-4">狙擊進場位點</span>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">理想買入點</span>
                <span className="text-emerald-500 font-mono">{data.dashboard?.battle_plan?.sniper_points?.ideal_buy || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">嚴格止損位</span>
                <span className="text-rose-500 font-mono">{data.dashboard?.battle_plan?.sniper_points?.stop_loss || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-zinc-400">目標獲利位</span>
                <span className="text-white font-mono">{data.dashboard?.battle_plan?.sniper_points?.take_profit || 'N/A'}</span>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/5">
            <span className="text-xs text-zinc-500 block mb-4">倉位管理策略</span>
            <div className="space-y-2">
              <div className="text-sm text-white font-medium">{data.dashboard?.battle_plan?.position_strategy?.suggested_position || 'N/A'}</div>
              <p className="text-xs text-zinc-400 leading-relaxed">{data.dashboard?.battle_plan?.position_strategy?.entry_plan || 'N/A'}</p>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-zinc-900 border border-white/5">
            <span className="text-xs text-zinc-500 block mb-4">行動執行清單</span>
            <ul className="space-y-2">
              {data.dashboard?.battle_plan?.action_checklist?.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                  {item}
                </li>
              )) || <li>無</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Full Report Section */}
      <div className="space-y-4">
        <h3 className="text-sm font-mono uppercase tracking-widest text-zinc-500 flex items-center gap-2">
          <FileText className="w-4 h-4" /> 詳細開盤指南報告
        </h3>
        <div className="p-8 rounded-3xl bg-white shadow-sm border border-slate-200">
          <ReportDisplay report={data.full_report_markdown ?? ''} />
        </div>
      </div>
    </div>
  );
};
