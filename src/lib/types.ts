export type WatchlistItem = {
  id: string;
  market: string;
  symbol: string;
};

export type StockQuote = {
  market: string;
  symbol: string;
  lastSeen: {
    date: string;
    price: number;
    change: number;
    changePercent: number;
    currency: string;
  };
};

export type QuoteError = {
  market: string;
  symbol: string;
  error: string;
};

export type QuoteResponse = {
  quotes: StockQuote[];
  errors: QuoteError[];
};
