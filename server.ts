import express from "express";
import { createServer as createViteServer } from "vite";
import yahooFinance2 from "yahoo-finance2";

const yahooFinance = new yahooFinance2({ suppressNotices: ['yahooSurvey'] });

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
          results.push({
            ticker,
            price: quote.regularMarketPrice,
            change: quote.regularMarketChange,
            changePercent: quote.regularMarketChangePercent,
            volume: quote.regularMarketVolume,
            marketCap: quote.marketCap,
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
