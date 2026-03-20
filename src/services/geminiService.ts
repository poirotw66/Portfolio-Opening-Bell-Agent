import { GoogleGenAI, Type, HarmCategory, HarmBlockThreshold, ThinkingLevel } from "@google/genai";
import {
  PositionAnalytics,
  MarketContext,
  MarketData,
  NewsItem,
  InvestmentStrategy,
  DecisionDashboard,
} from "../types";

const STRATEGY_LABELS: Record<InvestmentStrategy, string> = {
  value: '價值投資 (尋找被低估的股票)',
  growth: '成長投資 (專注高增長潛力)',
  index: '指數投資 (追求市場平均報酬)',
  dividend: '股息投資 (偏好穩定配息)',
  technical: '技術交易 (利用圖表與指標)',
  dca: '定期定額 (固定投入分散成本)',
};

/** Max length per dashboard text field to avoid runaway output. */
const DASHBOARD_FIELD_MAX_LENGTH = 200;
const DASHBOARD_SUMMARY_MAX_LENGTH = 30;
const DASHBOARD_TEXT_FALLBACK = "數據不足，無法評估";
const SUMMARY_PROMPT_LEAKAGE_PATTERN =
  /這是一句話結論|字數嚴格限制在三十字以內|限\s*30\s*字內|30\s*字內|禁止重複|只能輸出一個短句/u;
const PLACEHOLDER_VALUE_PATTERN = /^(?:N\/A|NA|—|-|無|暫無動態|尚無結論)$/u;
const NON_EMPTY_ARRAY_FIELD_PATHS = new Set([
  "dashboard.intelligence.risk_alerts",
  "dashboard.intelligence.positive_catalysts",
  "dashboard.battle_plan.action_checklist",
]);
const SHORT_TEXT_FIELD_PATHS = new Set([
  "trend_prediction",
  "operation_advice",
  "confidence_level",
  "dashboard.core_conclusion.one_sentence",
  "dashboard.core_conclusion.signal_type",
  "dashboard.core_conclusion.time_sensitivity",
  "dashboard.core_conclusion.position_advice.no_position",
  "dashboard.core_conclusion.position_advice.has_position",
  "dashboard.data_perspective.trend_status.ma_alignment",
  "dashboard.data_perspective.price_position.bias_status",
  "dashboard.data_perspective.volume_analysis.volume_status",
  "dashboard.data_perspective.volume_analysis.volume_meaning",
  "dashboard.data_perspective.chip_structure.chip_health",
  "dashboard.intelligence.latest_news",
  "dashboard.intelligence.risk_alerts[]",
  "dashboard.intelligence.positive_catalysts[]",
  "dashboard.intelligence.earnings_outlook",
  "dashboard.intelligence.sentiment_summary",
  "dashboard.battle_plan.sniper_points.ideal_buy",
  "dashboard.battle_plan.sniper_points.secondary_buy",
  "dashboard.battle_plan.sniper_points.stop_loss",
  "dashboard.battle_plan.sniper_points.take_profit",
  "dashboard.battle_plan.position_strategy.suggested_position",
  "dashboard.battle_plan.position_strategy.entry_plan",
  "dashboard.battle_plan.position_strategy.risk_control",
  "dashboard.battle_plan.action_checklist[]",
]);

function normalizePath(path: string): string {
  return path.replace(/\[\d+\]/g, "[]");
}

function stripPromptLeakage(text: string): string {
  return text
    .replace(/這是一句話結論，?字數嚴格限制在三十字以內。?/gu, " ")
    .replace(/這是一句話結論。?/gu, " ")
    .replace(/字數嚴格限制在三十字以內。?/gu, " ")
    .replace(/一句話結論/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizePunctuationSpacing(text: string): string {
  return text
    .replace(/\s*([，。！？；：,.;:!?])/gu, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();
}

function keepFirstSentence(text: string): string {
  const lineBreakIndex = text.search(/[\r\n]/u);
  const sentenceEndIndex = text.search(/[。！？!?]/u);
  const cutIndex =
    lineBreakIndex >= 0 && sentenceEndIndex >= 0
      ? Math.min(lineBreakIndex, sentenceEndIndex + 1)
      : lineBreakIndex >= 0
        ? lineBreakIndex
        : sentenceEndIndex >= 0
          ? sentenceEndIndex + 1
          : -1;

  return cutIndex >= 0 ? text.slice(0, cutIndex).trim() : text.trim();
}

function truncateCleanly(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }

  const truncated = text
    .slice(0, maxLength)
    .replace(/[，、；：,.;:。！？!?\s]+$/gu, "")
    .trim();

  return truncated || text.slice(0, maxLength).trim();
}

function collapseToClauses(text: string, maxLength: number): string {
  const clauses = text
    .split(/[，、；,;]/u)
    .map((clause) => clause.trim())
    .filter(Boolean);

  if (clauses.length === 0) {
    return text.trim();
  }

  let conciseText = clauses[0];
  for (const clause of clauses.slice(1)) {
    const candidate = `${conciseText}，${clause}`;
    if (candidate.length > maxLength) {
      break;
    }
    conciseText = candidate;
  }

  return conciseText;
}

interface DashboardValidationIssue {
  path: string;
  reason: "too_long" | "multiple_sentences" | "prompt_leakage" | "runaway_repetition" | "empty" | "placeholder" | "empty_array";
  value: string;
}

function countSentenceTerminators(text: string): number {
  return (text.match(/[。！？!?]/gu) ?? []).length;
}

function hasRunawayRepetition(text: string): boolean {
  if (/(.{6,})\1{2,}/u.test(text)) {
    return true;
  }

  const deduped = cleanRepetitiveSentences(text);
  return text.length >= 80 && deduped.length <= text.length / 2;
}

function previewValidationValue(text: string): string {
  return truncateCleanly(normalizePunctuationSpacing(text), 50);
}

function collectDashboardValidationIssues(
  node: unknown,
  path = "",
  issues: DashboardValidationIssue[] = []
): DashboardValidationIssue[] {
  if (Array.isArray(node)) {
    const normalizedPath = normalizePath(path);
    if (NON_EMPTY_ARRAY_FIELD_PATHS.has(normalizedPath) && node.length === 0) {
      issues.push({ path: normalizedPath, reason: "empty_array", value: "[]" });
      return issues;
    }

    for (let index = 0; index < node.length; index += 1) {
      collectDashboardValidationIssues(node[index], `${path}[${index}]`, issues);
    }
    return issues;
  }

  if (!node || typeof node !== "object") {
    return issues;
  }

  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const currentPath = path ? `${path}.${key}` : key;
    const normalizedPath = normalizePath(currentPath);

    if (typeof value === "string" && SHORT_TEXT_FIELD_PATHS.has(normalizedPath)) {
      const normalizedValue = normalizePunctuationSpacing(value);
      const trimmedValue = stripPromptLeakage(normalizedValue);

      if (!trimmedValue) {
        issues.push({ path: normalizedPath, reason: "empty", value: value });
        continue;
      }

      if (PLACEHOLDER_VALUE_PATTERN.test(trimmedValue)) {
        issues.push({ path: normalizedPath, reason: "placeholder", value: value });
      }

      if (SUMMARY_PROMPT_LEAKAGE_PATTERN.test(value)) {
        issues.push({ path: normalizedPath, reason: "prompt_leakage", value: value });
      }

      if (trimmedValue.length > DASHBOARD_SUMMARY_MAX_LENGTH) {
        issues.push({ path: normalizedPath, reason: "too_long", value: trimmedValue });
      }

      if (/[\r\n]/u.test(value) || countSentenceTerminators(trimmedValue) > 1) {
        issues.push({ path: normalizedPath, reason: "multiple_sentences", value: trimmedValue });
      }

      if (hasRunawayRepetition(value)) {
        issues.push({ path: normalizedPath, reason: "runaway_repetition", value: value });
      }

      continue;
    }

    if (value && typeof value === "object") {
      collectDashboardValidationIssues(value, currentPath, issues);
    }
  }

  return issues;
}

function buildValidationFeedback(issues: DashboardValidationIssue[]): string {
  if (issues.length === 0) {
    return "";
  }

  const uniqueIssues = issues
    .slice(0, 10)
    .map((issue) => `- ${issue.path}: ${issue.reason} -> ${previewValidationValue(issue.value)}`);

  return `

上一次輸出失敗，請重做並修正以下欄位：
${uniqueIssues.join("\n")}

再次強調：
- 上述欄位只能保留一個短句。
- 每個短句不得超過 30 字。
- 不得輸出任何提示詞、規則說明或字數提醒。
- 不得在同一欄位連續生成第二句或長段落。
`;
}

function buildSingleStockDashboardDraftPrompt(
  ticker: string,
  marketData: MarketData,
  news: NewsItem[],
  marketContext: MarketContext,
  userPosition: { shares: number; avgPrice: number } | undefined,
  strategy: InvestmentStrategy,
): string {
  return `你現在在做第一階段：產生單股決策儀表盤的結構化分析草稿。
請針對股票「${ticker}」生成完整 JSON。
使用者的投資策略是：${STRATEGY_LABELS[strategy] || strategy}。

第一階段目標：
- 重點是資訊完整、數值合理、欄位齊全、JSON 穩定。
- 本階段先完成完整分析草稿，不必強求所有 UI 短句都很精煉。
- 之後會由第二階段專門把短句欄位壓縮成 UI 文案。
- 但你仍然必須填滿所有欄位，不可省略欄位，不可輸出空字串。

欄位填值規範：
- "confidence_level" 只能填「高」、「中」、「低」。
- "dashboard.core_conclusion.signal_type" 只能填「買入」、「觀望」、「賣出」。
- "dashboard.core_conclusion.time_sensitivity" 只能填「短期」、「中期」、「中長期」。
- "dashboard.intelligence.latest_news" 必須摘要最重要事件；若近期新聞不足，填「近期新聞稀少，先觀察量價」。
- "dashboard.intelligence.positive_catalysts" 與 "risk_alerts" 至少各填 1 項短句，不可空陣列。
- "dashboard.battle_plan.action_checklist" 至少填 2 項可執行動作，不可空陣列。
- "dashboard.battle_plan.sniper_points.ideal_buy"、"secondary_buy"、"stop_loss"、"take_profit" 必須填具體價格或價格區間，格式如 "$21.5-$22.0" 或 "$19.8"，不可填 "N/A"。
- "dashboard.battle_plan.position_strategy.suggested_position"、"entry_plan"、"risk_control" 必須填完整短句，不可留空。
- "dashboard.data_perspective.trend_status.trend_score" 必須填 0-100 的整數分數。
- "dashboard.data_perspective.volume_analysis.volume_status" 必須填「縮量整理」、「量能中性」、「放量上攻」、「放量轉弱」等狀態，不可填 "N/A"。
- "dashboard.data_perspective.price_position.support_level" 與 "resistance_level" 必須填數字；若缺少更多均線，可依現價與 SMA20 保守推估。

數值推估原則：
- 若只有 SMA20，支撐位可優先參考 SMA20 附近，壓力位可參考現價上方 3%-8% 區間。
- 趨勢分數可綜合「現價相對 SMA20、RSI14、近月績效、新聞情緒」評估。
- 量能狀態可根據當日成交量與價格漲跌描述，不得留白。

正確示例：
- trend_prediction: "短線回測支撐，中線趨勢未破"
- operation_advice: "等待縮量止穩後再分批布局"
- confidence_level: "中"
- latest_news: "商業化進展仍是股價主軸"
- ideal_buy: "$21.5-$22.0"

請務必生成一份精簡的決策數據。

包含以下區塊：
1. 核心結論 (Core Conclusion)
2. 數據透視 (Data Perspective)
3. 市場情報 (Intelligence)
4. 戰鬥計畫 (Battle Plan)

以下是相關數據：

--- 市場情境 ---
NASDAQ (^IXIC): ${marketContext["^IXIC"]?.changePercent?.toFixed(2)}%
S&P 500 (^GSPC): ${marketContext["^GSPC"]?.changePercent?.toFixed(2)}%

--- 股票數據 (${ticker}) ---
目前股價: $${marketData.price?.toFixed(2)}
漲跌幅: ${marketData.changePercent?.toFixed(2)}%
成交量: ${marketData.volume}
市值: ${marketData.marketCap}
${marketData.sma20 ? `20日均線 (SMA20): $${marketData.sma20.toFixed(2)}` : ""}
${marketData.rsi14 ? `14日相對強弱指標 (RSI14): ${marketData.rsi14.toFixed(2)}` : ""}
${marketData.oneMonthPerformance ? `近一個月歷史績效: ${marketData.oneMonthPerformance.toFixed(2)}%` : ""}

--- 您的持股部位 ---
${userPosition ? `股數: ${userPosition.shares}, 平均成本: $${userPosition.avgPrice.toFixed(2)}` : "目前未持有"}

--- 最新新聞 ---
${news.length > 0 ? news.map((n, i) => `${i + 1}. ${n.title} (來源: ${n.publisher}, 連結: ${n.link})`).join("\n") : "目前暫無新聞，請利用 Google Search 獲取最新動態。"}

請嚴格按照規定的 JSON 結構輸出。`;
}

interface SingleStockDashboardUiFields {
  trend_prediction: string;
  operation_advice: string;
  decision_type: "buy" | "hold" | "sell";
  confidence_level: "高" | "中" | "低";
  dashboard: {
    core_conclusion: {
      one_sentence: string;
      signal_type: "買入" | "觀望" | "賣出";
      time_sensitivity: "短期" | "中期" | "中長期";
      position_advice: {
        no_position: string;
        has_position: string;
      };
    };
    data_perspective: {
      trend_status: {
        ma_alignment: string;
      };
      price_position: {
        bias_status: string;
      };
      volume_analysis: {
        volume_status: string;
        volume_meaning: string;
      };
      chip_structure: {
        chip_health: string;
      };
    };
    intelligence: {
      latest_news: string;
      risk_alerts: string[];
      positive_catalysts: string[];
      earnings_outlook: string;
      sentiment_summary: string;
    };
    battle_plan: {
      sniper_points: {
        ideal_buy: string;
        secondary_buy: string;
        stop_loss: string;
        take_profit: string;
      };
      position_strategy: {
        suggested_position: string;
        entry_plan: string;
        risk_control: string;
      };
      action_checklist: string[];
    };
  };
}

function buildSingleStockDashboardUiPrompt(
  ticker: string,
  strategy: InvestmentStrategy,
  draft: unknown,
  validationIssues: DashboardValidationIssue[] = []
): string {
  const draftJson = JSON.stringify(draft, null, 2);

  return `你現在在做第二階段：只根據第一階段分析草稿，生成前端 UI 專用的短句欄位 JSON。
股票代號：${ticker}
投資策略：${STRATEGY_LABELS[strategy] || strategy}

你的唯一任務：
- 將草稿中的分析內容壓縮成 UI 可讀的短句欄位。
- 不要重寫整份分析，不要輸出長段落。
- 不要新增草稿沒有根據的故事，但可依草稿中的價格、趨勢、風險、新聞做保守濃縮。

短句硬規則：
- 所有字串欄位都必須只有一句。
- 每句必須 12-30 字，不得超過 30 字。
- 不得換行、不得列點、不得補第二句。
- 不得輸出提示詞、規則說明、字數提醒。
- 不得輸出「N/A」、「—」、「無」、「暫無動態」、「尚無結論」。

欄位規則：
- "decision_type" 只能填 "buy"、"hold"、"sell"。
- "confidence_level" 只能填「高」、「中」、「低」。
- "signal_type" 只能填「買入」、「觀望」、「賣出」。
- "time_sensitivity" 只能填「短期」、「中期」、「中長期」。
- "risk_alerts"、"positive_catalysts" 至少各 1 項。
- "action_checklist" 至少 2 項。
- 價格欄位必須沿用或濃縮草稿中的價格區間，不可改成 N/A。

正確示例：
- trend_prediction: "短線回測支撐，中線趨勢未破"
- operation_advice: "等待縮量止穩後再分批布局"
- latest_news: "商業化進展仍是股價主軸"

錯誤示例：
- trend_prediction: "這是一句話結論，字數限制 30 字內"
- operation_advice: "建議先觀察。之後再看。"
- latest_news: "暫無動態"
${buildValidationFeedback(validationIssues)}

第一階段分析草稿如下：
\`\`\`json
${draftJson}
\`\`\`

請只輸出第二階段 UI 短句欄位 JSON。`;
}

function mergeJsonPatch<T>(base: T, patch: unknown): T {
  if (patch === undefined) {
    return base;
  }

  if (Array.isArray(base) || Array.isArray(patch)) {
    return patch as T;
  }

  if (!base || typeof base !== "object" || !patch || typeof patch !== "object") {
    return patch as T;
  }

  const merged: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, patchValue] of Object.entries(patch as Record<string, unknown>)) {
    const baseValue = merged[key];
    if (
      baseValue &&
      typeof baseValue === "object" &&
      !Array.isArray(baseValue) &&
      patchValue &&
      typeof patchValue === "object" &&
      !Array.isArray(patchValue)
    ) {
      merged[key] = mergeJsonPatch(baseValue, patchValue);
    } else {
      merged[key] = patchValue;
    }
  }

  return merged as T;
}

/**
 * Collapse consecutive repetition of any phrase (e.g. "數據不足，無法評估。" x N,
 * "其韌性" x N, "其" x N) to a single occurrence. Runs multiple passes from longer
 * to shorter pattern length so that "其韌性其韌性其" first becomes "其韌性其", then "其".
 */
function cleanRepetitiveSentences(text: string): string {
  let cleaned = text.replace(
    /(數據不足，無法評估。)(\s*\1)+/g,
    '$1'
  );

  // Collapse any substring that repeats 3+ times consecutively (pattern length 1..20)
  let prev = '';
  while (prev !== cleaned) {
    prev = cleaned;
    for (let len = 20; len >= 1; len--) {
      const re = new RegExp(`(.{${len}})\\1{2,}`, 'g');
      cleaned = cleaned.replace(re, '$1');
    }
  }

  if (cleaned.length > DASHBOARD_FIELD_MAX_LENGTH) {
    cleaned = cleaned.slice(0, DASHBOARD_FIELD_MAX_LENGTH);
  }

  return cleaned.trim();
}

function normalizeDashboardString(text: string, path: string): string {
  const normalizedPath = normalizePath(path);
  let cleaned = stripPromptLeakage(cleanRepetitiveSentences(text));
  cleaned = normalizePunctuationSpacing(cleaned);

  if (SHORT_TEXT_FIELD_PATHS.has(normalizedPath)) {
    cleaned = keepFirstSentence(cleaned);

    if (cleaned.length > DASHBOARD_SUMMARY_MAX_LENGTH) {
      cleaned = collapseToClauses(cleaned, DASHBOARD_SUMMARY_MAX_LENGTH);
    }

    cleaned = truncateCleanly(cleaned, DASHBOARD_SUMMARY_MAX_LENGTH);
    return cleaned || DASHBOARD_TEXT_FALLBACK;
  }

  if (cleaned.length > DASHBOARD_FIELD_MAX_LENGTH) {
    cleaned = truncateCleanly(cleaned, DASHBOARD_FIELD_MAX_LENGTH);
  }

  return cleaned || DASHBOARD_TEXT_FALLBACK;
}

function sanitizeDashboardText(node: unknown, path = ""): void {
  if (Array.isArray(node)) {
    for (let index = 0; index < node.length; index += 1) {
      const value = node[index];
      const currentPath = `${path}[${index}]`;
      if (typeof value === "string") {
        node[index] = normalizeDashboardString(value, currentPath);
      } else {
        sanitizeDashboardText(value, currentPath);
      }
    }
    return;
  }

  if (!node || typeof node !== 'object') {
    return;
  }

  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    const currentPath = path ? `${path}.${key}` : key;
    if (typeof value === 'string') {
      obj[key] = normalizeDashboardString(value, currentPath);
    } else if (value && typeof value === 'object') {
      sanitizeDashboardText(value, currentPath);
    }
  }
}

/**
 * Attempt to repair a JSON string that was truncated mid-stream (e.g. due to
 * maxOutputTokens being hit). Closes any open string literal, then closes
 * any unclosed arrays/objects in reverse order.
 */
function repairTruncatedJson(jsonStr: string): string {
  let inString = false;
  let escaped = false;
  const stack: string[] = [];

  for (let i = 0; i < jsonStr.length; i++) {
    const ch = jsonStr[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') stack.pop();
  }

  let repaired = jsonStr;
  if (inString) repaired += '"';   // close unterminated string
  while (stack.length > 0) repaired += stack.pop(); // close open brackets
  return repaired;
}

function parseJsonResponse(responseText: string): ReturnType<typeof JSON.parse> {
  let cleanJson = responseText.trim();
  if (cleanJson.startsWith("```")) {
    cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(cleanJson);
  } catch (parseErr) {
    const isUnterminated =
      parseErr instanceof SyntaxError &&
      (parseErr.message.includes("Unterminated") || parseErr.message.includes("Unexpected end"));
    if (isUnterminated) {
      console.warn("JSON truncated, attempting repair...");
      return JSON.parse(repairTruncatedJson(cleanJson));
    }
    throw parseErr;
  }
}

/**
 * Generation flow for the single-stock decision dashboard (個人報告儀表板):
 * 1. Load API key (custom or VITE_GEMINI_API_KEY) and model from localStorage.
 * 2. Stage 1: generate a structured analysis draft with the complete dashboard tree.
 * 3. Stage 2: generate only the UI short-text fields from the stage-1 draft.
 * 4. Validate the merged result. If short text fields leak prompt text, exceed 30 chars, or use placeholders, retry stage 2.
 * 5. Run sanitizeDashboardText as the final guardrail, attach marketData/position, return.
 * Failures: empty/undefined (e.g. RECITATION), JSON parse errors, or model loops in text fields — we mitigate them with two-stage generation, validation retries, and post-processing.
 */
export async function generateSingleStockDashboard(
  ticker: string,
  marketData: MarketData,
  news: NewsItem[],
  marketContext: MarketContext,
  userPosition?: { shares: number; avgPrice: number },
  strategy: InvestmentStrategy = 'growth'
): Promise<DecisionDashboard> {
  const manualKey = localStorage.getItem('customGeminiApiKey');
  const apiKey = manualKey || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 VITE_GEMINI_API_KEY。請在環境變數中設定。");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = localStorage.getItem('geminiModel') || 'gemini-3-flash-preview';

  const draftSystemInstruction = `你是一位專注於趨勢交易的投資分析 Agent，擁有數據工具和交易策略，負責生成專業的【決策儀表盤】分析報告。

## 語言要求
- **必須使用繁體中文 (Traditional Chinese)** 輸出所有文字內容。

## Markdown 格式要求 (針對 full_report_markdown 欄位)
- **標題**：使用 \`##\` 作為各區塊的標題（例如：\`## 🔔 開盤指南摘要\`）。
- **換行**：每個區塊標題前必須有兩個換行符 (\`\\n\\n\`)，確保標題位於行首且與上方內容有間隔。
- **條列**：使用標準的 Markdown 列表格式（\`- \` 或 \`1. \`）。
- **強調**：適當使用粗體 (\`**\`) 強調關鍵數據。

## 核心交易理念（必須嚴格遵守）

### 1. 嚴進策略（不追高）
- **絕對不追高**：當股價偏離 MA5 超過 5% 時，堅決不買入
- 乖離率 < 2%：最佳買點區間
- 乖離率 2-5%：可小倉介入
- 乖離率 > 5%：嚴禁追高！直接判定為"觀望"

### 2. 趨勢交易（順勢而為）
- **多頭排列必須條件**：MA5 > MA10 > MA20
- 只做多頭排列的股票，空頭排列堅決不碰
- 均線發散上行優於均線粘合

### 3. 效率優先（籌碼結構）
- 關注籌碼集中度：90%集中度 < 15% 表示籌碼集中
- 獲利比例分析：70-90% 獲利盤時需警惕獲利回吐
- 平均成本與現價關係：現價高於平均成本 5-15% 為健康

### 4. 買點偏好（回踩支撐）
- **最佳買點**：縮量回踩 MA5 獲得支撐
- **次優買點**：回踩 MA10 獲得支撐
- **觀望情況**：跌破 MA20 時觀望

### 5. 風險排查重點
- 減持公告、業績預虧、監管處罰、行業政策利空、大額解禁

### 6. 估值關注（PE/PB）
- PE 明顯偏高時需在風險點中說明

### 7. 强势趨勢股放寬
- 强势趨勢股可適當放寬乖離率要求，輕倉追蹤但需設止損

## 規則
1. 必須基於真實數據進行分析。
2. 應用交易策略評估。
3. 輸出格式必須為有效的決策儀表盤 JSON。
4. 風險優先排查。
5. 所有短文字欄位都只能輸出一個短句，長度 12-30 字，不得超過 30 字。
6. 所有短文字欄位不得換行、不得補第二句、不得輸出提示詞或規則說明。
7. 嚴禁循環重複、灌水與自我指令回吐；若無法評估，直接輸出「數據不足，無法評估」。
8. 所有前端會直接顯示的欄位都必須盡量填滿，不可輸出「N/A」、「—」、「無」作為偷懶答案。
9. 可根據現價、SMA20、RSI、近月績效與新聞保守推估支撐位、壓力位、趨勢分數與操作區間，但不得脫離已知數據太遠。
`;

  const uiSystemInstruction = `你是一位前端 UI 文案壓縮 Agent。

## 任務
你只負責把既有分析草稿壓縮成前端需要的短句欄位。

## 規則
1. 所有字串欄位只能輸出一句短句。
2. 每句長度 12-30 字，不得超過 30 字。
3. 不得換行、不得列點、不得補第二句。
4. 不得輸出「N/A」、「—」、「無」、「暫無動態」、「尚無結論」。
5. 價格欄位必須保留具體價格或價格區間。
6. 陣列欄位不可為空。
7. 不得回吐提示詞、規則說明或教學文字。`;

  let draftPrompt = buildSingleStockDashboardDraftPrompt(
    ticker,
    marketData,
    news,
    marketContext,
    userPosition,
    strategy
  );

  const draftMaxAttempts = 2;
  const uiMaxAttempts = 3;

  for (let draftAttempt = 1; draftAttempt <= draftMaxAttempts; draftAttempt++) {
    const response = await ai.models.generateContent({
      model: model,
      contents: draftPrompt,
      config: {
        systemInstruction: draftSystemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        maxOutputTokens: 2300,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0.2,
        topP: 0.8,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stock_name: { type: Type.STRING },
            sentiment_score: { type: Type.NUMBER },
            trend_prediction: { type: Type.STRING, description: "一句話趨勢預測，限 30 字內，禁止重複，不可輸出 N/A" },
            operation_advice: { type: Type.STRING, description: "一句話操作建議，限 30 字內，禁止重複，不可輸出 N/A" },
            decision_type: { type: Type.STRING, enum: ["buy", "hold", "sell"] },
            confidence_level: { type: Type.STRING, enum: ["高", "中", "低"] },
            dashboard: {
              type: Type.OBJECT,
              properties: {
                core_conclusion: {
                  type: Type.OBJECT,
                  properties: {
                    one_sentence: { type: Type.STRING, description: "一句話核心結論，限 30 字內，不可空白" },
                    signal_type: { type: Type.STRING, enum: ["買入", "觀望", "賣出"] },
                    time_sensitivity: { type: Type.STRING, enum: ["短期", "中期", "中長期"] },
                    position_advice: {
                      type: Type.OBJECT,
                      properties: {
                        no_position: { type: Type.STRING, description: "空倉建議，一句話，限 30 字內，不可 N/A" },
                        has_position: { type: Type.STRING, description: "持倉建議，一句話，限 30 字內，不可 N/A" }
                      }
                    }
                  }
                },
                data_perspective: {
                  type: Type.OBJECT,
                  properties: {
                    trend_status: {
                      type: Type.OBJECT,
                      properties: {
                        ma_alignment: { type: Type.STRING, description: "如：多頭排列、價在 MA20 之上，不可空白" },
                        is_bullish: { type: Type.BOOLEAN },
                        trend_score: { type: Type.NUMBER, description: "0 到 100 的趨勢強度分數" }
                      }
                    },
                    price_position: {
                      type: Type.OBJECT,
                      properties: {
                        current_price: { type: Type.NUMBER },
                        ma5: { type: Type.NUMBER },
                        ma10: { type: Type.NUMBER },
                        ma20: { type: Type.NUMBER },
                        bias_ma5: { type: Type.NUMBER },
                        bias_status: { type: Type.STRING, description: "如：偏高、合理、偏低，不可空白" },
                        support_level: { type: Type.NUMBER, description: "必填的關鍵支撐價位，不可留空" },
                        resistance_level: { type: Type.NUMBER, description: "必填的關鍵壓力價位，不可留空" }
                      }
                    },
                    volume_analysis: {
                      type: Type.OBJECT,
                      properties: {
                        volume_ratio: { type: Type.NUMBER },
                        volume_status: { type: Type.STRING, description: "如：縮量整理、量能中性、放量上攻，不可填 N/A" },
                        turnover_rate: { type: Type.NUMBER },
                        volume_meaning: { type: Type.STRING, description: "一句話解釋成交量意義，限 30 字內，不可空白" }
                      }
                    },
                    chip_structure: {
                      type: Type.OBJECT,
                      properties: {
                        profit_ratio: { type: Type.NUMBER },
                        avg_cost: { type: Type.NUMBER },
                        concentration: { type: Type.NUMBER },
                        chip_health: { type: Type.STRING, description: "一句話描述籌碼健康度，限 30 字內，不可空白" }
                      }
                    }
                  }
                },
                intelligence: {
                  type: Type.OBJECT,
                  properties: {
                    latest_news: { type: Type.STRING, description: "一句話最新市場動態，不可填暫無動態，若新聞少請寫近期新聞稀少，先觀察量價" },
                    risk_alerts: { type: Type.ARRAY, items: { type: Type.STRING, description: "一句話風險警示，限 30 字內" } },
                    positive_catalysts: { type: Type.ARRAY, items: { type: Type.STRING, description: "一句話利多催化，限 30 字內" } },
                    earnings_outlook: { type: Type.STRING, description: "一句話業績展望，限 30 字內，不可空白" },
                    sentiment_summary: { type: Type.STRING, description: "一句話市場情緒總結，限 30 字內，不可空白" }
                  }
                },
                battle_plan: {
                  type: Type.OBJECT,
                  properties: {
                    sniper_points: {
                      type: Type.OBJECT,
                      properties: {
                        ideal_buy: { type: Type.STRING, description: "必填具體買入價格或區間，例如 $21.5-$22.0" },
                        secondary_buy: { type: Type.STRING, description: "必填次要買入價格或區間，例如 $20.8-$21.2" },
                        stop_loss: { type: Type.STRING, description: "必填明確止損價位，例如 $19.8" },
                        take_profit: { type: Type.STRING, description: "必填明確目標價位，例如 $24.5" }
                      }
                    },
                    position_strategy: {
                      type: Type.OBJECT,
                      properties: {
                        suggested_position: { type: Type.STRING, description: "一句話倉位建議，限 30 字內，不可空白" },
                        entry_plan: { type: Type.STRING, description: "一句話進場策略，限 30 字內，不可空白" },
                        risk_control: { type: Type.STRING, description: "一句話風控策略，限 30 字內，不可空白" }
                      }
                    },
                    action_checklist: { type: Type.ARRAY, items: { type: Type.STRING, description: "一句話執行動作，限 30 字內" } }
                  }
                }
              }
            }
          }
        }
      },
    });

    try {
      const responseText = response.text;
      console.log("AI Raw Response:", responseText);

      if (!responseText || responseText === "undefined") {
        const candidates = (response as { candidates?: Array<{ finishReason?: string }> }).candidates;
        const finishReason = candidates?.[0]?.finishReason;
        if (finishReason === "RECITATION") {
          throw new Error("Gemini 因內容政策阻擋了此次回應 (Recitation)，請稍後再試或更換股票/輸入。");
        }
        console.error("AI returned invalid text:", responseText);
        console.log("Full Response Object:", JSON.stringify(response, null, 2));
        throw new Error("模型未返回有效內容 (Empty or Undefined)，請稍後再試。");
      }

      const draft = parseJsonResponse(responseText) as DecisionDashboard;

      let uiPrompt = buildSingleStockDashboardUiPrompt(
        ticker,
        strategy,
        draft
      );

      for (let uiAttempt = 1; uiAttempt <= uiMaxAttempts; uiAttempt++) {
        const uiResponse = await ai.models.generateContent({
          model: model,
          contents: uiPrompt,
          config: {
            systemInstruction: uiSystemInstruction,
            responseMimeType: "application/json",
            maxOutputTokens: 1200,
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            temperature: 0.1,
            topP: 0.5,
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                trend_prediction: { type: Type.STRING },
                operation_advice: { type: Type.STRING },
                decision_type: { type: Type.STRING, enum: ["buy", "hold", "sell"] },
                confidence_level: { type: Type.STRING, enum: ["高", "中", "低"] },
                dashboard: {
                  type: Type.OBJECT,
                  properties: {
                    core_conclusion: {
                      type: Type.OBJECT,
                      properties: {
                        one_sentence: { type: Type.STRING },
                        signal_type: { type: Type.STRING, enum: ["買入", "觀望", "賣出"] },
                        time_sensitivity: { type: Type.STRING, enum: ["短期", "中期", "中長期"] },
                        position_advice: {
                          type: Type.OBJECT,
                          properties: {
                            no_position: { type: Type.STRING },
                            has_position: { type: Type.STRING }
                          }
                        }
                      }
                    },
                    data_perspective: {
                      type: Type.OBJECT,
                      properties: {
                        trend_status: {
                          type: Type.OBJECT,
                          properties: {
                            ma_alignment: { type: Type.STRING }
                          }
                        },
                        price_position: {
                          type: Type.OBJECT,
                          properties: {
                            bias_status: { type: Type.STRING }
                          }
                        },
                        volume_analysis: {
                          type: Type.OBJECT,
                          properties: {
                            volume_status: { type: Type.STRING },
                            volume_meaning: { type: Type.STRING }
                          }
                        },
                        chip_structure: {
                          type: Type.OBJECT,
                          properties: {
                            chip_health: { type: Type.STRING }
                          }
                        }
                      }
                    },
                    intelligence: {
                      type: Type.OBJECT,
                      properties: {
                        latest_news: { type: Type.STRING },
                        risk_alerts: { type: Type.ARRAY, items: { type: Type.STRING } },
                        positive_catalysts: { type: Type.ARRAY, items: { type: Type.STRING } },
                        earnings_outlook: { type: Type.STRING },
                        sentiment_summary: { type: Type.STRING }
                      }
                    },
                    battle_plan: {
                      type: Type.OBJECT,
                      properties: {
                        sniper_points: {
                          type: Type.OBJECT,
                          properties: {
                            ideal_buy: { type: Type.STRING },
                            secondary_buy: { type: Type.STRING },
                            stop_loss: { type: Type.STRING },
                            take_profit: { type: Type.STRING }
                          }
                        },
                        position_strategy: {
                          type: Type.OBJECT,
                          properties: {
                            suggested_position: { type: Type.STRING },
                            entry_plan: { type: Type.STRING },
                            risk_control: { type: Type.STRING }
                          }
                        },
                        action_checklist: { type: Type.ARRAY, items: { type: Type.STRING } }
                      }
                    }
                  }
                }
              }
            }
          },
        });

        const uiResponseText = uiResponse.text;
        if (!uiResponseText || uiResponseText === "undefined") {
          throw new Error("第二階段模型未返回有效內容，請稍後再試。");
        }

        const uiFields = parseJsonResponse(uiResponseText) as SingleStockDashboardUiFields;
        const merged = mergeJsonPatch(draft, uiFields);
        const validationIssues = collectDashboardValidationIssues(merged);
        if (validationIssues.length > 0) {
          console.warn("Dashboard UI short-text validation failed:", validationIssues);
          if (uiAttempt < uiMaxAttempts) {
            uiPrompt = buildSingleStockDashboardUiPrompt(
              ticker,
              strategy,
              draft,
              validationIssues
            );
            continue;
          }

          if (draftAttempt < draftMaxAttempts) {
            draftPrompt = buildSingleStockDashboardDraftPrompt(
              ticker,
              marketData,
              news,
              marketContext,
              userPosition,
              strategy
            );
            break;
          }
        }

        sanitizeDashboardText(merged);
        merged.marketData = marketData;
        merged.position = userPosition
          ? { ticker, shares: userPosition.shares, avgPrice: userPosition.avgPrice }
          : undefined;
        return merged;
      }
    } catch (e) {
      const isSyntaxError =
        e instanceof SyntaxError ||
        (e instanceof Error &&
          (e.message.includes("Unexpected token") ||
           e.message.includes("Unterminated string") ||
           e.message.includes("JSON")));

      console.error("JSON parse error:", e);

      if (isSyntaxError && draftAttempt < draftMaxAttempts) {
        console.warn("第一階段 JSON 解析失敗，正在重試 generateSingleStockDashboard...");
        continue;
      }

      if (isSyntaxError) {
        throw new Error("模型返回的決策數據格式錯誤，請稍後再試或更換股票。");
      }

      throw e;
    }
  }

  throw new Error("無法取得有效的決策儀表盤結果，請稍後再試。");
}

export async function generateOpeningBellBrief(
  positions: PositionAnalytics[],
  marketContext: MarketContext,
  news: Record<string, NewsItem[]>,
  strategy: InvestmentStrategy = 'growth'
): Promise<string> {
  const manualKey = localStorage.getItem('customGeminiApiKey');
  const apiKey = manualKey || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 VITE_GEMINI_API_KEY。請在環境變數中設定。");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = localStorage.getItem('geminiModel') || 'gemini-3-flash-preview';

  let prompt = `你是一個專業的金融分析助理。
你的任務是根據使用者的持股資料、市場數據與新聞，分析使用者的投資組合部位。
使用者的投資策略是：${STRATEGY_LABELS[strategy] || strategy}。請務必根據此策略提供對應的建議。
請專注於以下幾點：
1. 部位風險 (Position risk)
2. 市場情境 (Market context)
3. 關鍵催化劑 (Key catalysts)
4. 具體可行的洞察 (Actionable insight)

請務必使用繁體中文 (Traditional Chinese) 提供結構化的報告。

以下是相關數據：

--- 市場情境 ---
NASDAQ (^IXIC): ${marketContext["^IXIC"]?.changePercent?.toFixed(2)}%
S&P 500 (^GSPC): ${marketContext["^GSPC"]?.changePercent?.toFixed(2)}%

--- 投資組合部位 ---
`;

  for (const pos of positions) {
    prompt += `
股票代號: ${pos.ticker}
股數: ${pos.shares}
平均成本: $${pos.avgPrice.toFixed(2)}
目前股價: $${pos.currentPrice.toFixed(2)}
未實現損益: $${pos.unrealizedPL.toFixed(2)} (${pos.returnPercent.toFixed(2)}%)

${pos.ticker} 的相關新聞:
`;
    const tickerNews = news[pos.ticker] || [];
    if (tickerNews.length === 0) {
      prompt += "近期無相關新聞。\n";
    } else {
      tickerNews.forEach((n, idx) => {
        prompt += `${idx + 1}. ${n.title} (來源: ${n.publisher}, 連結: ${n.link})\n`;
      });
    }
  }

  prompt += `
---
請根據上述數據產生一份「開盤投資組合摘要 (Portfolio Opening Bell Brief)」報告。
請使用 Markdown 格式，包含清晰的標題與條列式重點。
報告必須包含以下區塊：
- 投資組合摘要 (Portfolio Summary) - 使用表格呈現持股現況。
- 市場情境分析 (Market Context) - 說明大盤對投資組合的影響。
- 關鍵新聞分析 (Key News Analysis) - 針對每則新聞標註其來源媒體。
- AI 洞察 (包含部位洞察、風險因素、觀察重點)。
- 參考資料 (Sources) - 列出所有參考新聞的標題與原始連結。

請在報告結尾加上免責聲明：『本報告僅供參考，不構成投資建議。投資有風險，入市需謹慎。』
**注意：請勿使用 HTML 標籤 (如 <span>) 來標示顏色，請直接使用 Emoji (如 🟢/🔴) 或純文字來表示正負數值。**
`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 8192,
      temperature: 1.0,
      topP: 0.95,
    },
  });

  return response.text || "無法產生分析報告。";
}

export async function generateSingleStockBrief(
  ticker: string,
  marketData: MarketData,
  news: NewsItem[],
  marketContext: MarketContext,
  userPosition?: { shares: number; avgPrice: number },
  strategy: InvestmentStrategy = 'growth'
): Promise<string> {
  const manualKey = localStorage.getItem('customGeminiApiKey');
  const apiKey = manualKey || import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 VITE_GEMINI_API_KEY。請在環境變數中設定。");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = localStorage.getItem('geminiModel') || 'gemini-3-flash-preview';

  let prompt = `你是一個專業的金融分析助理。
你的任務是針對單一股票「${ticker}」提供當天的開盤指南。
使用者的投資策略是：${STRATEGY_LABELS[strategy] || strategy}。請務必根據此策略提供對應的建議。
請專注於以下幾點：
1. 價格動能與技術面暗示 (Price momentum & technical hints) - **請分析目前股價與均線(SMA)的關係，以及RSI指標是否顯示超買或超賣。**
2. 歷史績效趨勢 (Historical performance trends) - **請分析該股票過去一個月的歷史績效表現，並說明這對短期走勢的潛在影響。**
3. 關鍵新聞與催化劑 (Key news & catalysts)
4. 大盤環境影響 (Market context impact)
5. 今日交易策略/觀察重點 (Trading strategy / Key levels to watch) - **請務必結合使用者的持股數量與均價，提供具體且可執行的開盤操作建議。必須包含明確的建議買進/賣出價位（Buy/Sell points）或停損點（Stop-loss levels）。**

請務必使用繁體中文 (Traditional Chinese) 提供結構化的報告。

以下是相關數據：

--- 市場情境 ---
NASDAQ (^IXIC): ${marketContext["^IXIC"]?.changePercent?.toFixed(2)}%
S&P 500 (^GSPC): ${marketContext["^GSPC"]?.changePercent?.toFixed(2)}%

--- 股票數據 (${ticker}) ---
目前股價: $${marketData.price?.toFixed(2)}
漲跌幅: ${marketData.changePercent?.toFixed(2)}%
成交量: ${marketData.volume}
市值: ${marketData.marketCap}
${marketData.sma20 ? `20日均線 (SMA20): $${marketData.sma20.toFixed(2)}` : ''}
${marketData.rsi14 ? `14日相對強弱指標 (RSI14): ${marketData.rsi14.toFixed(2)}` : ''}
${marketData.oneMonthPerformance ? `近一個月歷史績效: ${marketData.oneMonthPerformance.toFixed(2)}%` : ''}
`;

  if (userPosition) {
    const currentPrice = marketData.price || userPosition.avgPrice;
    const pl = (currentPrice - userPosition.avgPrice) * userPosition.shares;
    const plPercent = ((currentPrice - userPosition.avgPrice) / userPosition.avgPrice) * 100;
    prompt += `
--- 您的持股部位 ---
股數: ${userPosition.shares} 股
平均成本: $${userPosition.avgPrice.toFixed(2)}
目前未實現損益: $${pl.toFixed(2)} (${plPercent.toFixed(2)}%)
`;
  } else {
    prompt += `
--- 您的持股部位 ---
目前未持有此股票，請提供潛在的建倉建議或觀望重點。
`;
  }

  prompt += `
--- 最新新聞 ---
`;

  if (!news || news.length === 0) {
    prompt += "近期無相關新聞。\n";
  } else {
    news.forEach((n, idx) => {
      let timeStr = "";
      if (n.providerPublishTime) {
        const publishDate = new Date(n.providerPublishTime);
        if (!Number.isNaN(publishDate.getTime())) {
          const now = new Date();
          const diffMs = now.getTime() - publishDate.getTime();
          const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
          const diffDays = Math.floor(diffHours / 24);

          if (diffHours < 1) {
            timeStr = " (剛剛)";
          } else if (diffHours < 24) {
            timeStr = ` (${diffHours}小時前)`;
          } else {
            const isoDate = publishDate.toISOString().split("T")[0].replace(/-/g, "");
            timeStr = ` (${diffDays}天前, ${isoDate})`;
          }
        }
      }
      prompt += `${idx + 1}. ${n.title}${timeStr} (來源: ${n.publisher}, 連結: ${n.link})\n`;
    });
  }

  prompt += `
---
請根據上述數據產生一份「${ticker} 開盤指南 (Opening Bell Guide)」。
請使用 Markdown 格式，包含豐富的 Emoji、清晰的標題與條列式重點。
報告必須包含以下區塊：
1. 🔔 開盤指南摘要 (Executive Summary)
2. 📈 價格動能與技術面分析 (Technical Analysis)
3. 📰 關鍵新聞與催化劑 (News & Catalysts) - 請務必標註新聞來源。
4. 🌍 大盤環境影響 (Market Context)
5. 🛠 今日交易策略 (Trading Strategy) - 結合持股部位提供具體的 Buy/Sell/Stop-loss 建議。
6. 🔗 參考資料 (Sources) - 列出所有參考新聞的標題與原始連結。

請在報告結尾加上免責聲明：『本報告僅供參考，不構成投資建議。投資有風險，入市需謹慎。』
**注意：請勿使用 HTML 標籤 (如 <span>) 來標示顏色，請直接使用 Emoji (如 🟢/🔴) 或純文字來表示正負數值。**
`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      maxOutputTokens: 8192,
      temperature: 1.0,
      topP: 0.95,
    },
  });

  return response.text || "無法產生分析報告。";
}
