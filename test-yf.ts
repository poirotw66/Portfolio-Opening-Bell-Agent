import yahooFinance2 from "yahoo-finance2";

const yahooFinance = new yahooFinance2();

async function test() {
  try {
    const quote = await yahooFinance.quote("AAPL");
    console.log(JSON.stringify(quote, null, 2));
  } catch (e) {
    console.error(e);
  }
}

test();
