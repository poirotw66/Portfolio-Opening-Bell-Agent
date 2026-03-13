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

function sanitizeDashboardText(node: unknown): void {
  if (!node || typeof node !== 'object') {
    return;
  }

  const obj = node as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    const value = obj[key];
    if (typeof value === 'string') {
      obj[key] = cleanRepetitiveSentences(value);
    } else if (value && typeof value === 'object') {
      sanitizeDashboardText(value);
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

/**
 * Generation flow for the single-stock decision dashboard (個人報告儀表板):
 * 1. Load API key (custom or VITE_GEMINI_API_KEY) and model from localStorage.
 * 2. Build a system instruction (trading rules, JSON rules, no repetition) + user prompt (ticker, market data, news, position).
 * 3. Call Gemini with responseSchema so the model returns structured JSON (dashboard tree).
 * 4. Parse JSON, fix escaped newlines in full_report_markdown, run sanitizeDashboardText to collapse repetitions, attach marketData/position, return.
 * Failures: empty/undefined (e.g. RECITATION), JSON parse errors, or model loops in text fields — we mitigate loops in post-processing and with lower temperature.
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

  const systemInstruction = `你是一位專注於趨勢交易的投資分析 Agent，擁有數據工具和交易策略，負責生成專業的【決策儀表盤】分析報告。

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
5. **極度重要：所有 JSON 字串欄位必須只包含「一句話」，字數嚴格限制在 20-30 字以內，絕對不可重複生成多個結論。**
6. **嚴禁循環重複：嚴禁在任何欄位中出現循環重複的字、詞或短語（例如不可出現「其韌性其韌性…」或「其其其…」）。每個欄位寫完一句就停止，立即進入下一個欄位。**
7. **禁止幻覺：若無數據支持，請回答「數據不足，無法評估」，不要編造數據或重複無意義的套話。**
`;

  let prompt = `請針對股票「${ticker}」生成決策儀表盤 JSON。
使用者的投資策略是：${STRATEGY_LABELS[strategy] || strategy}。

**極重要：JSON 內的所有文字欄位（如 trend_prediction, operation_advice 等）字數必須嚴格限制在 30 字以內，禁止任何形式的循環重複。**

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
${marketData.sma20 ? `20日均線 (SMA20): $${marketData.sma20.toFixed(2)}` : ''}
${marketData.rsi14 ? `14日相對強弱指標 (RSI14): ${marketData.rsi14.toFixed(2)}` : ''}
${marketData.oneMonthPerformance ? `近一個月歷史績效: ${marketData.oneMonthPerformance.toFixed(2)}%` : ''}

--- 您的持股部位 ---
${userPosition ? `股數: ${userPosition.shares}, 平均成本: $${userPosition.avgPrice.toFixed(2)}` : '目前未持有'}

--- 最新新聞 ---
${news.length > 0 ? news.map((n, i) => `${i + 1}. ${n.title} (來源: ${n.publisher}, 連結: ${n.link})`).join('\n') : '目前暫無新聞，請利用 Google Search 獲取最新動態。'}

請嚴格按照規定的 JSON 結構輸出。
`;

  // 為避免模型偶發回傳壞掉的 JSON，加入最多 1 次自動重試。
  const maxAttempts = 2;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        tools: [{ googleSearch: {} }],
        safetySettings: [
          { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
          { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
        ],
        maxOutputTokens: 4096,
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        temperature: 0.4,
        topP: 0.9,
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            stock_name: { type: Type.STRING },
            sentiment_score: { type: Type.NUMBER },
            trend_prediction: { type: Type.STRING, description: "一句話趨勢預測，限 30 字內，禁止重複" },
            operation_advice: { type: Type.STRING, description: "一句話操作建議，限 30 字內，禁止重複" },
            decision_type: { type: Type.STRING, enum: ["buy", "hold", "sell"] },
            confidence_level: { type: Type.STRING },
            dashboard: {
              type: Type.OBJECT,
              properties: {
                core_conclusion: {
                  type: Type.OBJECT,
                  properties: {
                    one_sentence: { type: Type.STRING, description: "一句話核心結論" },
                    signal_type: { type: Type.STRING, description: "如：買入、觀望" },
                    time_sensitivity: { type: Type.STRING, description: "如：短期、中期" },
                    position_advice: {
                      type: Type.OBJECT,
                      properties: {
                        no_position: { type: Type.STRING, description: "空倉建議" },
                        has_position: { type: Type.STRING, description: "持倉建議" }
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
                        ma_alignment: { type: Type.STRING, description: "如：多頭排列" },
                        is_bullish: { type: Type.BOOLEAN },
                        trend_score: { type: Type.NUMBER }
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
                        bias_status: { type: Type.STRING },
                        support_level: { type: Type.NUMBER },
                        resistance_level: { type: Type.NUMBER }
                      }
                    },
                    volume_analysis: {
                      type: Type.OBJECT,
                      properties: {
                        volume_ratio: { type: Type.NUMBER },
                        volume_status: { type: Type.STRING, description: "如：縮量、放量" },
                        turnover_rate: { type: Type.NUMBER },
                        volume_meaning: { type: Type.STRING, description: "一句話解釋成交量意義" }
                      }
                    },
                    chip_structure: {
                      type: Type.OBJECT,
                      properties: {
                        profit_ratio: { type: Type.NUMBER },
                        avg_cost: { type: Type.NUMBER },
                        concentration: { type: Type.NUMBER },
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

      // Clean markdown code blocks if the model accidentally included them
      let cleanJson = responseText.trim();
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
      }

      // Attempt to parse; if it fails due to truncation, try repairing first.
      let parsed: ReturnType<typeof JSON.parse>;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseErr) {
        const isUnterminated =
          parseErr instanceof SyntaxError &&
          (parseErr.message.includes("Unterminated") || parseErr.message.includes("Unexpected end"));
        if (isUnterminated) {
          console.warn("JSON truncated, attempting repair...");
          parsed = JSON.parse(repairTruncatedJson(cleanJson));
        } else {
          throw parseErr;
        }
      }
      // Fix escaped newlines if they appear as literal \n or \r\n in the string
      if (parsed.full_report_markdown && typeof parsed.full_report_markdown === 'string') {
        parsed.full_report_markdown = parsed.full_report_markdown
          .replace(/\\n/g, '\n')
          .replace(/\\r/g, '\r')
          .replace(/([^\n])\s*#\s/g, '$1\n\n# ');
      }

      // Clean up any pathological repetitions inside dashboard text fields
      sanitizeDashboardText(parsed);
      
      // Attach raw data for UI display
      parsed.marketData = marketData;
      parsed.position = userPosition;
      
      return parsed;
    } catch (e) {
      const isSyntaxError =
        e instanceof SyntaxError ||
        (e instanceof Error &&
          (e.message.includes("Unexpected token") ||
           e.message.includes("Unterminated string") ||
           e.message.includes("JSON")));

      console.error("JSON parse error:", e);

      if (isSyntaxError && attempt < maxAttempts) {
        // 自動重試一次，避免偶發壞 JSON 直接中斷使用者流程。
        // eslint-disable-next-line no-console
        console.warn("JSON 解析失敗，正在自動重試一次 generateSingleStockDashboard...");
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
