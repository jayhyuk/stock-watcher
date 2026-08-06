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

export function toYahooSymbol(market: string, symbol: string): string {
  const suffix = MARKET_SUFFIX[market] ?? "";
  return `${symbol}${suffix}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

type YahooChartResult = {
  meta: {
    currency?: string;
  };
  timestamp?: number[];
  indicators?: {
    quote?: Array<{
      close?: (number | null)[];
    }>;
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

  const closes = result.indicators?.quote?.[0]?.close ?? [];
  const timestamps = result.timestamp ?? [];

  // Collect last two valid (non-null) closes
  const valid: { date: string; price: number }[] = [];
  for (let i = closes.length - 1; i >= 0 && valid.length < 2; i--) {
    const price = closes[i];
    if (price != null && !Number.isNaN(price)) {
      const date = new Date(timestamps[i] * 1000).toISOString().split("T")[0];
      valid.push({ date, price });
    }
  }

  if (valid.length < 1) {
    throw new Error("No valid close prices in Yahoo Finance response");
  }

  const currency = result.meta.currency ?? MARKET_CURRENCY[market] ?? "USD";
  const latest = valid[0];
  let change = 0;
  let changePercent = 0;

  if (valid.length >= 2) {
    const prior = valid[1].price;
    change = round2(latest.price - prior);
    changePercent = prior === 0 ? 0 : round2((change / prior) * 100);
  }

  return {
    market,
    symbol,
    lastSeen: {
      date: latest.date,
      price: latest.price,
      change,
      changePercent,
      currency,
    },
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
