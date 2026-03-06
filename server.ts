import express from "express";
import { createServer as createViteServer } from "vite";
import yahooFinance2 from "yahoo-finance2";

const yahooFinance = new yahooFinance2({ suppressNotices: ['yahooSurvey'] });

function calculateSMA(data: number[], period: number): number | null {
  if (data.length < period) return null;
  const slice = data.slice(-period);
  const sum = slice.reduce((a, b) => a + b, 0);
  return sum / period;
}

function calculateRSI(data: number[], period: number = 14): number | null {
  if (data.length <= period) return null;
  
  let gains = 0;
  let losses = 0;
  
  for (let i = 1; i <= period; i++) {
    const change = data[i] - data[i - 1];
    if (change > 0) gains += change;
    else losses -= change;
  }
  
  let avgGain = gains / period;
  let avgLoss = losses / period;
  
  for (let i = period + 1; i < data.length; i++) {
    const change = data[i] - data[i - 1];
    let gain = 0;
    let loss = 0;
    if (change > 0) gain = change;
    else loss = -change;
    
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
  }
  
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return 100 - (100 / (1 + rs));
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/market-data", async (req, res) => {
    try {
      const { tickers } = req.body;
      if (!Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ error: "Invalid tickers array" });
      }

      const results: any[] = [];
      for (const ticker of tickers) {
        try {
          const quote: any = await yahooFinance.quote(ticker);
          
          let sma20 = null;
          let rsi14 = null;
          let oneMonthPerformance = null;
          
          try {
            const endDate = new Date();
            const startDate = new Date();
            startDate.setDate(endDate.getDate() - 60);
            
            const historical = await yahooFinance.historical(ticker, {
              period1: startDate,
              period2: endDate,
              interval: '1d'
            });
            
            if (historical && historical.length > 0) {
              const closePrices = historical.map(h => h.close);
              sma20 = calculateSMA(closePrices, 20);
              rsi14 = calculateRSI(closePrices, 14);
              
              // Calculate 1-month performance (approx 21 trading days)
              if (closePrices.length >= 21) {
                const currentPrice = closePrices[closePrices.length - 1];
                const priceOneMonthAgo = closePrices[closePrices.length - 21];
                oneMonthPerformance = ((currentPrice - priceOneMonthAgo) / priceOneMonthAgo) * 100;
              }
            }
          } catch (histErr) {
            console.error(`Error fetching historical data for ${ticker}:`, histErr);
          }

          results.push({
            ticker,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            marketCap: quote.marketCap,
            sma20,
            rsi14,
            oneMonthPerformance
          });
        } catch (err) {
          console.error(`Error fetching quote for ${ticker}:`, err);
          results.push({ ticker, error: "Failed to fetch data" });
        }
      }

      res.json({ data: results });
    } catch (error) {
      console.error("Market data error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.post("/api/news", async (req, res) => {
    try {
      const { tickers } = req.body;
      if (!Array.isArray(tickers) || tickers.length === 0) {
        return res.status(400).json({ error: "Invalid tickers array" });
      }

      const newsResults: Record<string, any[]> = {};
      for (const ticker of tickers) {
        try {
          const news: any = await yahooFinance.search(ticker, { newsCount: 3 });
          newsResults[ticker] = news.news.map((item) => ({
            title: item.title,
            publisher: item.publisher,
            link: item.link,
            providerPublishTime: item.providerPublishTime,
          }));
        } catch (err) {
          console.error(`Error fetching news for ${ticker}:`, err);
          newsResults[ticker] = [];
        }
      }

      res.json({ data: newsResults });
    } catch (error) {
      console.error("News error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/market-context", async (req, res) => {
    try {
      const indices = ["^IXIC", "^GSPC"]; // NASDAQ, S&P 500
      const results: Record<string, any> = {};
      for (const index of indices) {
        try {
          const quote: any = await yahooFinance.quote(index);
          results[index] = {
            price: quote.regularMarketPrice,
            changePercent: quote.regularMarketChangePercent,
          };
        } catch (err) {
          console.error(`Error fetching index ${index}:`, err);
        }
      }
      res.json({ data: results });
    } catch (error) {
      console.error("Market context error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
