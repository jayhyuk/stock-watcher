import { NextRequest, NextResponse } from "next/server";
import { fetchAlphaVantageQuote } from "@/lib/alpha-vantage";
import type { QuoteResponse } from "@/lib/types";

type QuoteRequestItem = {
  market?: string;
  symbol?: string;
};

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
  const validItems: { market: string; symbol: string }[] = [];

  for (const item of items) {
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

    validItems.push({ market, symbol });
  }

  const quoteResults = await Promise.all(
    validItems.map(async ({ market, symbol }) => {
      try {
        const quote = await fetchAlphaVantageQuote(market, symbol, apiKey);
        return { ok: true as const, quote };
      } catch (err) {
        return {
          ok: false as const,
          error: {
            market,
            symbol,
            error: err instanceof Error ? err.message : "Failed to fetch quote",
          },
        };
      }
    }),
  );

  for (const result of quoteResults) {
    if (result.ok) {
      response.quotes.push(result.quote);
      continue;
    }

    response.errors.push(result.error);
  }

  return NextResponse.json(response);
}
