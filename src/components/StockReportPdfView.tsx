import { DecisionDashboard } from "../types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Width in pixels of the PDF export canvas. Must match CAPTURE_WIDTH_PX in SavedReportsPage. */
const PDF_WIDTH = 800;
const CHART_HEIGHT = 160;

interface Props {
  data: DecisionDashboard;
  reportDate: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function buildDecisionLabel(type: string): string {
  if (type === "buy") return "建議買入";
  if (type === "sell") return "建議賣出";
  return "建議觀望";
}

function buildDecisionColor(type: string): string {
  if (type === "buy") return "#059669";
  if (type === "sell") return "#e11d48";
  return "#d97706";
}

function buildDecisionBg(type: string): string {
  if (type === "buy") return "#d1fae5";
  if (type === "sell") return "#ffe4e6";
  return "#fef3c7";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ─── inline SVG sparkline (no external lib, no ResponsiveContainer) ───────────

function PriceSparkline({ history, isUp }: { history: { date: string; close: number }[]; isUp: boolean }) {
  if (!history || history.length < 2) return null;

  const prices = history.map((h) => h.close);
  const minP = Math.min(...prices);
  const maxP = Math.max(...prices);
  const range = maxP - minP || 1;
  const w = PDF_WIDTH - 64; // left+right padding inside the card
  const h = CHART_HEIGHT;
  const pad = 8;

  const toX = (i: number) => pad + (i / (prices.length - 1)) * (w - pad * 2);
  const toY = (p: number) => h - pad - ((p - minP) / range) * (h - pad * 2);

  const polyPoints = prices.map((p, i) => `${toX(i)},${toY(p)}`).join(" ");
  // closed fill path
  const fillPoints =
    `${toX(0)},${h - pad} ` + prices.map((p, i) => `${toX(i)},${toY(p)}`).join(" ") + ` ${toX(prices.length - 1)},${h - pad}`;

  const stroke = isUp ? "#10b981" : "#ef4444";
  const fillId = `grad-${Math.random().toString(36).substr(2, 9)}`;
  const fillGradient = isUp ? ["rgba(16,185,129,0.2)", "rgba(16,185,129,0)"] : ["rgba(239,68,68,0.2)", "rgba(239,68,68,0)"];

  // Y-axis labels
  const yLabels = [minP, (minP + maxP) / 2, maxP].map((v) => `$${v.toFixed(2)}`);
  const yPositions = [h - pad, h / 2, pad];

  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillGradient[0]} />
          <stop offset="100%" stopColor={fillGradient[1]} />
        </linearGradient>
      </defs>
      {/* grid lines */}
      {yPositions.map((y, i) => (
        <line key={i} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#f1f5f9" strokeWidth={1} />
      ))}
      {/* fill area */}
      <polygon points={fillPoints} fill={`url(#${fillId})`} />
      {/* price line */}
      <polyline points={polyPoints} fill="none" stroke={stroke} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
      {/* y-axis labels */}
      {yLabels.map((label, i) => (
        <text key={i} x={w - pad + 6} y={yPositions[i] + 3} fontSize={10} fill="#94a3b8" fontFamily="Inter, sans-serif">
          {label}
        </text>
      ))}
      {/* x-axis start / end dates */}
      <text x={pad} y={h + 16} fontSize={10} fill="#94a3b8" fontFamily="Inter, sans-serif">{history[0].date}</text>
      <text x={w - pad} y={h + 16} fontSize={10} fill="#94a3b8" fontFamily="Inter, sans-serif" textAnchor="end">{history[history.length - 1].date}</text>
    </svg>
  );
}

// ─── section helpers ──────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ borderBottom: "2px solid #6366f1", paddingBottom: 6, marginBottom: 12 }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#6366f1", textTransform: "uppercase", letterSpacing: 1 }}>
        {children}
      </span>
    </div>
  );
}

function KVRow({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: 12, color: "#64748b" }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: valueColor || "#1e293b" }}>{value}</span>
    </div>
  );
}

function TwoCol({ left, right }: { left: React.ReactNode; right: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 16 }}>
      <div style={{ flex: 1 }}>{left}</div>
      <div style={{ flex: 1 }}>{right}</div>
    </div>
  );
}

function Card({ children, style, accentColor }: { children: React.ReactNode; style?: React.CSSProperties; accentColor?: string }) {
  return (
    <div style={{ 
      background: "#f8fafc", 
      border: "1px solid #e2e8f0", 
      borderLeft: accentColor ? `4px solid ${accentColor}` : "1px solid #e2e8f0",
      borderRadius: 10, 
      padding: 16, 
      boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      ...style 
    }}>
      {children}
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export const StockReportPdfView: React.FC<Props> = ({ data, reportDate }) => {
  const md = data.marketData;
  const isUp = md ? md.change >= 0 : true;
  const decisionColor = buildDecisionColor(data.decision_type);
  const decisionBg = buildDecisionBg(data.decision_type);

  const biasMa20 =
    md?.sma20 != null && md.price != null && md.sma20 > 0
      ? ((md.price - md.sma20) / md.sma20) * 100
      : null;

  const dp = data.dashboard?.data_perspective;
  const supportLevel = dp?.price_position?.support_level ?? (md?.sma20 != null ? md.sma20 * 0.97 : null);
  const resistanceLevel = dp?.price_position?.resistance_level ?? (md?.sma20 != null ? md.sma20 * 1.03 : null);

  return (
    <div
      id="pdf-export-root"
      style={{
        width: PDF_WIDTH,
        minWidth: PDF_WIDTH,
        maxWidth: PDF_WIDTH,
        fontFamily: "'Helvetica Neue', Arial, 'PingFang TC', 'Microsoft JhengHei', sans-serif",
        fontSize: 13,
        color: "#1e293b",
        background: "#ffffff",
        padding: 32,
        boxSizing: "border-box",
      }}
    >
      {/* ── Header ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
          <div style={{ padding: "4px 8px", background: "#1e1b4b", color: "#e0e7ff", fontSize: 10, fontWeight: 700, borderRadius: 4, letterSpacing: 1 }}>PRO ANALYSIS</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#0f172a" }}>
            {data.stock_name || md?.ticker || "—"}
          </div>
        </div>
        <div style={{ fontSize: 13, color: "#64748b", fontWeight: 500 }}>報告產生時間：{formatDate(reportDate)}</div>
        </div>
        <div style={{
          padding: "8px 20px",
          borderRadius: 99,
          background: decisionBg,
          color: decisionColor,
          fontWeight: 700,
          fontSize: 14,
          border: `1.5px solid ${decisionColor}`,
          letterSpacing: 0.5,
        }}>
          {buildDecisionLabel(data.decision_type)}
        </div>
      </div>

      {/* ── Price + chart card ── */}
      {md && (
        <Card style={{ marginBottom: 20, padding: 20 }}>
          {/* price row */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 34, fontWeight: 800, color: isUp ? "#059669" : "#e11d48", lineHeight: 1 }}>
                ${md.price.toFixed(2)}
              </div>
              <div style={{ fontSize: 13, color: isUp ? "#059669" : "#e11d48", marginTop: 4 }}>
                {md.change > 0 ? "+" : ""}{md.change.toFixed(2)} ({md.change > 0 ? "+" : ""}{md.changePercent.toFixed(2)}%)
              </div>
            </div>
            <div style={{ display: "flex", gap: 24, textAlign: "right" }}>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>SMA 20</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>${md.sma20?.toFixed(2) || "N/A"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>RSI 14</div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{md.rsi14?.toFixed(2) || "N/A"}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>近一月</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: (md.oneMonthPerformance ?? 0) >= 0 ? "#059669" : "#e11d48" }}>
                  {md.oneMonthPerformance != null ? `${md.oneMonthPerformance > 0 ? "+" : ""}${md.oneMonthPerformance.toFixed(2)}%` : "N/A"}
                </div>
              </div>
              {data.position && (
                <>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>持股數</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{data.position.shares} 股</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 2 }}>均價</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>${data.position.avgPrice.toFixed(2)}</div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* sparkline chart */}
          {md.history && md.history.length > 1 && (
            <div style={{ marginTop: 8, paddingTop: 12, borderTop: "1px solid #e2e8f0" }}>
              <PriceSparkline history={md.history} isUp={isUp} />
            </div>
          )}
        </Card>
      )}

      {/* ── Summary scores ── */}
      <div style={{ display: "flex", gap: 16, marginBottom: 20 }}>
        {/* sentiment score */}
        <Card style={{ flex: 1, textAlign: "center" }} accentColor={data.sentiment_score >= 70 ? "#059669" : data.sentiment_score >= 40 ? "#d97706" : "#e11d48"}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>市場情緒</div>
          <div style={{
            fontSize: 42, fontWeight: 800,
            color: data.sentiment_score >= 70 ? "#059669" : data.sentiment_score >= 40 ? "#d97706" : "#e11d48",
            lineHeight: 1,
            margin: "4px 0"
          }}>
            {data.sentiment_score}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#475569", marginTop: 6 }}>{data.trend_prediction}</div>
        </Card>

        {/* operation advice */}
        <Card style={{ flex: 1.8 }} accentColor="#6366f1">
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>核心建議</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#1e1b4b", marginBottom: 6, lineHeight: 1.4 }}>{data.operation_advice}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 4, height: 4, borderRadius: "50%", background: "#6366f1" }}></div>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 500 }}>信心水準：<span style={{color: "#1e293b", fontWeight: 700}}>{data.confidence_level}</span></div>
          </div>
        </Card>

        {/* one sentence */}
        <Card style={{ flex: 2, background: "#f1f5f9" }}>
          <div style={{ fontSize: 10, color: "#94a3b8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>關鍵總結</div>
          <div style={{ position: "relative", paddingLeft: 12 }}>
            <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "#cbd5e1", borderRadius: 2 }}></div>
            <div style={{ fontSize: 13, fontStyle: "italic", fontWeight: 500, color: "#334155", lineHeight: 1.6 }}>
              "{data.dashboard?.core_conclusion?.one_sentence || "—"}"
            </div>
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 6 }}>
            <span style={{ fontSize: 9, padding: "3px 10px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 99, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>
              {data.dashboard?.core_conclusion?.signal_type || "—"}
            </span>
            <span style={{ fontSize: 9, padding: "3px 10px", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 99, color: "#475569", fontWeight: 700, textTransform: "uppercase" }}>
              {data.dashboard?.core_conclusion?.time_sensitivity || "—"}
            </span>
          </div>
        </Card>
      </div>

      {/* ── Data perspective + Intelligence ── */}
      <TwoCol
        left={
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>📊 數據透視分析</SectionTitle>
            <Card>
              <KVRow label="MA20 排列" value={dp?.trend_status?.ma_alignment || (biasMa20 != null ? (biasMa20 >= 0 ? "價在 MA20 之上" : "價在 MA20 之下") : "—")} />
              <KVRow label="趨勢強度" value={dp?.trend_status?.trend_score ? `${dp.trend_status.trend_score}/100` : "—"} />
              <KVRow label="乖離率 (MA20)" value={biasMa20 != null ? `${biasMa20.toFixed(2)}%` : "N/A"} valueColor={biasMa20 != null ? (biasMa20 > 5 ? "#e11d48" : biasMa20 < -2 ? "#059669" : "#1e293b") : undefined} />
              <KVRow label="關鍵支撐位" value={supportLevel != null ? `$${supportLevel.toFixed(2)}` : "—"} valueColor="#059669" />
              <KVRow label="關鍵壓力位" value={resistanceLevel != null ? `$${resistanceLevel.toFixed(2)}` : "—"} valueColor="#e11d48" />
              <KVRow label="成交量能" value={dp?.volume_analysis?.volume_status || (md?.volume != null ? `${md.volume.toLocaleString()}` : "—")} />
            </Card>
          </div>
        }
        right={
          <div style={{ marginBottom: 20 }}>
            <SectionTitle>⚡ 深度情報與催化劑</SectionTitle>
            <Card>
              <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>最新市場動態</div>
              <div style={{ fontSize: 12, color: "#1e293b", lineHeight: 1.6, marginBottom: 10 }}>
                {data.dashboard?.intelligence?.latest_news || "暫無動態"}
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#059669", fontWeight: 700, marginBottom: 4 }}>▲ 利多催化因素</div>
                  {(data.dashboard?.intelligence?.positive_catalysts || []).map((c, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#374151", marginBottom: 3, paddingLeft: 8 }}>• {c}</div>
                  ))}
                  {!data.dashboard?.intelligence?.positive_catalysts?.length && <div style={{ fontSize: 11, color: "#94a3b8" }}>無</div>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: "#e11d48", fontWeight: 700, marginBottom: 4 }}>▼ 潛在風險警示</div>
                  {(data.dashboard?.intelligence?.risk_alerts || []).map((r, i) => (
                    <div key={i} style={{ fontSize: 11, color: "#374151", marginBottom: 3, paddingLeft: 8 }}>• {r}</div>
                  ))}
                  {!data.dashboard?.intelligence?.risk_alerts?.length && <div style={{ fontSize: 11, color: "#94a3b8" }}>無</div>}
                </div>
              </div>
            </Card>
          </div>
        }
      />

      {/* ── Battle plan ── */}
      <div style={{ marginBottom: 24 }}>
        <SectionTitle>🎯 實戰交易部署</SectionTitle>
        <div style={{ display: "flex", gap: 16 }}>
          <Card style={{ flex: 1 }} accentColor="#059669">
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>狙擊進場區間</div>
            <KVRow label="理想買入點" value={data.dashboard?.battle_plan?.sniper_points?.ideal_buy || "N/A"} valueColor="#059669" />
            <KVRow label="嚴格止損位" value={data.dashboard?.battle_plan?.sniper_points?.stop_loss || "N/A"} valueColor="#e11d48" />
            <KVRow label="目標獲利位" value={data.dashboard?.battle_plan?.sniper_points?.take_profit || "N/A"} />
          </Card>
          <Card style={{ flex: 1 }} accentColor="#d97706">
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>倉位管理策略</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#1e293b", marginBottom: 8, lineHeight: 1.4 }}>
              {data.dashboard?.battle_plan?.position_strategy?.suggested_position || "N/A"}
            </div>
            <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.6, padding: "8px", background: "#ffffff", borderRadius: 6, border: "1px dashed #e2e8f0" }}>
              {data.dashboard?.battle_plan?.position_strategy?.entry_plan || "N/A"}
            </div>
          </Card>
          <Card style={{ flex: 1 }} accentColor="#6366f1">
            <div style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 10 }}>行動執行清單</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {(data.dashboard?.battle_plan?.action_checklist || []).map((item, i) => (
                <div key={i} style={{ fontSize: 11, color: "#334155", fontWeight: 500, display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <div style={{ width: 14, height: 14, borderRadius: 3, border: "1.5px solid #6366f1", flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 6, height: 6, borderRadius: 1, background: "#6366f1" }}></div>
                  </div>
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      {/* ── Divider ── */}
      <div style={{ height: 1, background: "#e2e8f0", margin: "8px 0 20px" }} />

      {/* ── Full report text ── */}
      {data.full_report_markdown && (
        <div style={{ pageBreakBefore: "auto" }}>
          <SectionTitle>📄 詳細開盤指南報告</SectionTitle>
          <div
            style={{
              fontSize: 13,
              color: "#334155",
              lineHeight: 1.7,
            }}
          >
            <ReactMarkdown 
              remarkPlugins={[remarkGfm]}
              components={{
                h1: ({node, ...props}) => <h1 style={{fontSize: '18px', fontWeight: 700, margin: '16px 0 8px'}} {...props} />,
                h2: ({node, ...props}) => <h2 style={{fontSize: '16px', fontWeight: 700, margin: '14px 0 6px'}} {...props} />,
                h3: ({node, ...props}) => <h3 style={{fontSize: '14px', fontWeight: 700, margin: '12px 0 4px'}} {...props} />,
                p: ({node, ...props}) => <p style={{margin: '0 0 10px'}} {...props} />,
                ul: ({node, ...props}) => <ul style={{margin: '0 0 10px', paddingLeft: '20px'}} {...props} />,
                li: ({node, ...props}) => <li style={{margin: '0 0 4px'}} {...props} />,
                table: ({node, ...props}) => <table style={{width: '100%', borderCollapse: 'collapse', margin: '10px 0'}} {...props} />,
                th: ({node, ...props}) => <th style={{border: '1px solid #e2e8f0', padding: '6px', background: '#f8fafc', fontWeight: 600}} {...props} />,
                td: ({node, ...props}) => <td style={{border: '1px solid #e2e8f0', padding: '6px'}} {...props} />,
              }}
            >
              {data.full_report_markdown}
            </ReactMarkdown>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ marginTop: 24, paddingTop: 12, borderTop: "1px solid #e2e8f0", textAlign: "center" }}>
        <div style={{ fontSize: 10, color: "#94a3b8" }}>
          此報告由 AI 生成，僅供參考，不構成投資建議。投資有風險，入市需謹慎。
        </div>
      </div>
    </div>
  );
};
