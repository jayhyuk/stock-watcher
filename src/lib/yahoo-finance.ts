import type { StockQuote } from "./types";

const YAHOO_FINANCE_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";

const MARKET_SUFFIX: Record<string, string> = {
  US: "",
  HK: ".HK",
  TH: ".BK",
  JP: ".T",
  SG: ".SI",
  SHZ: ".SZ",
  SHH: ".SS",
};

const MARKET_CURRENCY: Record<string, string> = {
  US: "USD",
  HK: "HKD",
  TH: "THB",
  JP: "JPY",
  SG: "SGD",
  SHZ: "CNY",
  SHH: "CNY",
};

/**
 * Chinese A-shares: prefix 6xx → Shanghai (.SS), 0xx/3xx → Shenzhen (.SZ).
 * Both SHH and SHZ market codes go through this auto-detection so a stock
 * tagged with the wrong exchange still resolves correctly.
 */
function chineseSuffix(symbol: string): string {
  return symbol.startsWith("6") ? ".SS" : ".SZ";
}

export function toYahooSymbol(market: string, symbol: string): string {
  if (market === "SHZ" || market === "SHH") {
    return `${symbol}${chineseSuffix(symbol)}`;
  }
  const suffix = MARKET_SUFFIX[market] ?? "";
  return `${symbol}${suffix}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type YahooChartMeta = {
  currency?: string;
  regularMarketPrice?: number;
  regularMarketTime?: number;
  chartPreviousClose?: number;
};

type YahooChartResult = {
  meta: YahooChartMeta;
};

type YahooChartResponse = {
  chart?: {
    result?: YahooChartResult[];
    error?: {
      code?: string;
      description?: string;
    } | null;
  };
};

export async function fetchYahooFinanceQuote(
  market: string,
  symbol: string,
): Promise<StockQuote> {
  const yahooSymbol = toYahooSymbol(market, symbol);
  const url = `${YAHOO_FINANCE_BASE}/${encodeURIComponent(yahooSymbol)}?interval=1d&range=5d`;

  const res = await fetch(url, {
    cache: "no-store",
    headers: { "User-Agent": "Mozilla/5.0" },
  });

  if (!res.ok) {
    throw new Error(`Yahoo Finance HTTP ${res.status}`);
  }

  const data = (await res.json()) as YahooChartResponse;

  if (data.chart?.error) {
    const err = data.chart.error;
    throw new Error(err.description ?? err.code ?? "Yahoo Finance error");
  }

  const result = data.chart?.result?.[0];
  if (!result) {
    throw new Error("No chart data in Yahoo Finance response");
  }

  const meta = result.meta;
  const price = meta.regularMarketPrice;
  if (price == null || Number.isNaN(price)) {
    throw new Error("No regularMarketPrice in Yahoo Finance response");
  }

  const marketTime = meta.regularMarketTime;
  const date = marketTime
    ? new Date(marketTime * 1000).toISOString().split("T")[0]
    : new Date().toISOString().split("T")[0];

  const currency = meta.currency ?? MARKET_CURRENCY[market] ?? "USD";
  const priorClose = meta.chartPreviousClose ?? 0;
  const change = round2(price - priorClose);
  const changePercent = priorClose === 0 ? 0 : round2((change / priorClose) * 100);

  return {
    market,
    symbol,
    lastSeen: {
      date,
      price,
      change,
      changePercent,
      currency,
    },
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
