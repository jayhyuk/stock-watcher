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
  timestamp?: number[];
  indicators?: {
    quote?: { close?: (number | null)[] }[];
  };
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

/**
 * `meta.chartPreviousClose` is unreliable — it can reflect a different close
 * (e.g. from a stale cache) than the actual daily bars in the chart series.
 * Derive the true previous close from the daily `close` array instead: the
 * last non-null entry is today's close (matches `regularMarketPrice`), and
 * the one before it is the previous trading day's close.
 */
function derivePriorClose(result: YahooChartResult, latestPrice: number): number | undefined {
  const closes = result.indicators?.quote?.[0]?.close;
  if (!closes || closes.length === 0) return undefined;

  const nonNullIndexes: number[] = [];
  closes.forEach((c, i) => {
    if (c != null && !Number.isNaN(c)) nonNullIndexes.push(i);
  });
  if (nonNullIndexes.length === 0) return undefined;

  const lastIdx = nonNullIndexes[nonNullIndexes.length - 1];
  const lastClose = closes[lastIdx] as number;

  // If the last bar's close doesn't match the live price, treat it as
  // today's still-forming bar and use it as the "previous close" baseline.
  const lastBarIsToday = Math.abs(lastClose - latestPrice) < 0.005;

  if (lastBarIsToday) {
    if (nonNullIndexes.length < 2) return undefined;
    return closes[nonNullIndexes[nonNullIndexes.length - 2]] as number;
  }
  return lastClose;
}

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
  const priorClose = derivePriorClose(result, price) ?? meta.chartPreviousClose ?? 0;
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
