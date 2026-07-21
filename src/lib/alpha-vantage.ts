import type { StockQuote } from "./types";

const ALPHA_VANTAGE_BASE = "https://www.alphavantage.co/query";

const MARKET_CURRENCY: Record<string, string> = {
  US: "USD",
  HK: "HKD",
  TH: "THB",
  JP: "JPY",
  SG: "SGD",
  SHZ: "CNY",
  SHH: "CNY",
};

type DailyBar = {
  "1. open": string;
  "2. high": string;
  "3. low": string;
  "4. close": string;
  "5. volume": string;
};

type AlphaVantageDailyResponse = {
  "Meta Data"?: {
    "2. Symbol"?: string;
    "3. Last Refreshed"?: string;
  };
  "Time Series (Daily)"?: Record<string, DailyBar>;
  "Error Message"?: string;
  Information?: string;
  Note?: string;
};

/** Alpha Vantage uses `SYMBOL.EXCHANGE` for non-US markets (e.g. 000807.SHZ). */
export function toAlphaVantageSymbol(market: string, symbol: string): string {
  if (market === "US") return symbol;
  return `${symbol}.${market}`;
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function extractApiError(data: AlphaVantageDailyResponse): string | null {
  if (data["Error Message"]) return data["Error Message"];
  if (data.Note) return data.Note;
  if (data.Information) return data.Information;
  return null;
}

export async function fetchAlphaVantageQuote(
  market: string,
  symbol: string,
  apiKey: string,
): Promise<StockQuote> {
  const avSymbol = toAlphaVantageSymbol(market, symbol);
  const url = new URL(ALPHA_VANTAGE_BASE);
  url.searchParams.set("function", "TIME_SERIES_DAILY");
  url.searchParams.set("symbol", avSymbol);
  url.searchParams.set("outputsize", "compact");
  url.searchParams.set("apikey", apiKey);

  const res = await fetch(url.toString(), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Alpha Vantage HTTP ${res.status}`);
  }

  const data = (await res.json()) as AlphaVantageDailyResponse;
  const apiError = extractApiError(data);
  if (apiError) {
    throw new Error(apiError);
  }

  const series = data["Time Series (Daily)"];
  if (!series) {
    throw new Error("No daily time series in response");
  }

  const dates = Object.keys(series).sort((a, b) => b.localeCompare(a));
  if (dates.length < 1) {
    throw new Error("No daily time series data available");
  }

  const latestDate = dates[0];
  const latestClose = parseFloat(series[latestDate]["4. close"]);

  if (Number.isNaN(latestClose)) {
    throw new Error("Invalid close price in time series");
  }

  const currency = MARKET_CURRENCY[market] ?? "USD";
  let change = 0;
  let changePercent = 0;

  if (dates.length >= 2) {
    const priorClose = parseFloat(series[dates[1]]["4. close"]);
    if (!Number.isNaN(priorClose)) {
      change = round2(latestClose - priorClose);
      changePercent = priorClose === 0 ? 0 : round2((change / priorClose) * 100);
    }
  }

  return {
    market,
    symbol,
    lastSeen: {
      date: latestDate,
      price: latestClose,
      change,
      changePercent,
      currency,
    },
  };
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
