import { GoogleGenAI } from "@google/genai";
import { PositionAnalytics, MarketContext, NewsItem } from "../types";

export async function generateOpeningBellBrief(
  positions: PositionAnalytics[],
  marketContext: MarketContext,
  news: Record<string, NewsItem[]>
): Promise<string> {
  const manualKey = localStorage.getItem('customGeminiApiKey');
  const apiKey = manualKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 GEMINI_API_KEY。請在環境變數中設定。");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = localStorage.getItem('geminiModel') || 'gemini-3-flash-preview';

  let prompt = `你是一個專業的金融分析助理。
你的任務是根據使用者的持股資料、市場數據與新聞，分析使用者的投資組合部位。
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
`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text || "無法產生分析報告。";
}

export async function generateSingleStockBrief(
  ticker: string,
  marketData: any,
  news: any[],
  marketContext: any,
  userPosition?: { shares: number; avgPrice: number }
): Promise<string> {
  const manualKey = localStorage.getItem('customGeminiApiKey');
  const apiKey = manualKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("缺少 GEMINI_API_KEY。請在環境變數中設定。");
  }

  const ai = new GoogleGenAI({ apiKey });
  const model = localStorage.getItem('geminiModel') || 'gemini-3-flash-preview';

  let prompt = `你是一個專業的金融分析助理。
你的任務是針對單一股票「${ticker}」提供當天的開盤指南。
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
        const now = new Date();
        const diffMs = now.getTime() - publishDate.getTime();
        const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
        const diffDays = Math.floor(diffHours / 24);
        
        if (diffHours < 1) {
          timeStr = " (剛剛)";
        } else if (diffHours < 24) {
          timeStr = ` (${diffHours}小時前)`;
        } else {
          timeStr = ` (${diffDays}天前, ${publishDate.toISOString().split('T')[0].replace(/-/g, '')})`;
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
`;

  const response = await ai.models.generateContent({
    model: model,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });

  return response.text || "無法產生分析報告。";
}
