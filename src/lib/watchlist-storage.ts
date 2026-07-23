import type { StockQuote, WatchlistItem } from "./types";

const WATCHLIST_STORAGE_KEY = "stock-check-watchlist";
const QUOTE_CACHE_STORAGE_KEY = "stock-check-quote-cache";

export type QuoteCache = {
  quotes: StockQuote[];
  loadedAt: string | null;
};

export function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchlistItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchlistItem[]): void {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items));
}

export function loadQuoteCache(): QuoteCache {
  if (typeof window === "undefined") {
    return { quotes: [], loadedAt: null };
  }

  try {
    const raw = localStorage.getItem(QUOTE_CACHE_STORAGE_KEY);
    if (!raw) return { quotes: [], loadedAt: null };

    const parsed = JSON.parse(raw) as Partial<QuoteCache>;
    return {
      quotes: Array.isArray(parsed.quotes) ? parsed.quotes : [],
      loadedAt: typeof parsed.loadedAt === "string" ? parsed.loadedAt : null,
    };
  } catch {
    return { quotes: [], loadedAt: null };
  }
}

export function saveQuoteCache(cache: QuoteCache): void {
  localStorage.setItem(QUOTE_CACHE_STORAGE_KEY, JSON.stringify(cache));
}

export function createWatchlistItem(market: string, symbol: string): WatchlistItem {
  return {
    id: crypto.randomUUID(),
    market: market.trim().toUpperCase(),
    symbol: symbol.trim().toUpperCase(),
  };
}
