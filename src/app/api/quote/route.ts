import { NextRequest, NextResponse } from "next/server";
import { delay, fetchAlphaVantageQuote } from "@/lib/alpha-vantage";
import type { QuoteResponse } from "@/lib/types";

type QuoteRequestItem = {
  market?: string;
  symbol?: string;
};

const REQUEST_GAP_MS = 1100;

function normalizeMarket(value: string | undefined): string | null {
  const market = value?.trim().toUpperCase();
  return market ? market : null;
}

function normalizeSymbol(value: string | undefined): string | null {
  const symbol = value?.trim().toUpperCase();
  return symbol ? symbol : null;
}

function getApiKey(): string {
  const apiKey = process.env.ALPHAVANTAGE_API_KEY;
  if (!apiKey) {
    throw new Error("ALPHAVANTAGE_API_KEY is not configured");
  }
  return apiKey;
}

/** GET /api/quote?market=SHZ&symbol=000807 */
export async function GET(request: NextRequest) {
  const market = normalizeMarket(request.nextUrl.searchParams.get("market") ?? undefined);
  const symbol = normalizeSymbol(request.nextUrl.searchParams.get("symbol") ?? undefined);

  if (!market || !symbol) {
    return NextResponse.json(
      { error: "Query params market and symbol are required." },
      { status: 400 },
    );
  }

  try {
    const quote = await fetchAlphaVantageQuote(market, symbol, getApiKey());
    return NextResponse.json(quote);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch quote";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/** POST /api/quote  body: { items: [{ market, symbol }] } */
export async function POST(request: NextRequest) {
  let body: { items?: QuoteRequestItem[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const items = body.items;
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json(
      { error: "Body must include a non-empty items array." },
      { status: 400 },
    );
  }

  let apiKey: string;
  try {
    apiKey = getApiKey();
  } catch (err) {
    const message = err instanceof Error ? err.message : "API key missing";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const response: QuoteResponse = { quotes: [], errors: [] };

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const market = normalizeMarket(item.market);
    const symbol = normalizeSymbol(item.symbol);

    if (!market || !symbol) {
      response.errors.push({
        market: item.market ?? "",
        symbol: item.symbol ?? "",
        error: "market and symbol are required",
      });
      continue;
    }

    if (i > 0) {
      await delay(REQUEST_GAP_MS);
    }

    try {
      const quote = await fetchAlphaVantageQuote(market, symbol, apiKey);
      response.quotes.push(quote);
    } catch (err) {
      response.errors.push({
        market,
        symbol,
        error: err instanceof Error ? err.message : "Failed to fetch quote",
      });
    }
  }

  return NextResponse.json(response);
}
