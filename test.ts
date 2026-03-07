import yahooFinance2 from 'yahoo-finance2';
const yf = new (yahooFinance2 as any)({ suppressNotices: ['yahooSurvey', 'ripHistorical'] });
console.log(typeof yf.quote);
