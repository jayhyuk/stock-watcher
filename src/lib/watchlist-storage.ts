import type { StockQuote, WatchlistItem } from "./types";

const WATCHLIST_STORAGE_KEY = "stock-check-watchlist";
const WATCHLIST_TABS_STORAGE_KEY = "stock-check-watch-tabs";
const QUOTE_CACHE_STORAGE_KEY = "stock-check-quote-cache";
const DEFAULT_TAB_ID = "tab-1";

export type QuoteCache = {
  quotes: StockQuote[];
  loadedAt: string | null;
};

export type WatchlistTab = {
  id: string;
  name: string;
};

function normalizeImportedItem(item: unknown): WatchlistItem {
  if (typeof item !== "object" || item === null) {
    throw new Error("Each item must be an object.");
  }

  const candidate = item as Partial<WatchlistItem>;
  if (typeof candidate.market !== "string" || candidate.market.trim() === "") {
    throw new Error("Each item must include a non-empty 'market' string.");
  }

  if (typeof candidate.symbol !== "string" || candidate.symbol.trim() === "") {
    throw new Error("Each item must include a non-empty 'symbol' string.");
  }

  const id =
    typeof candidate.id === "string" && candidate.id.trim() !== ""
      ? candidate.id.trim()
      : crypto.randomUUID();

  return {
    id,
    tabId:
      typeof candidate.tabId === "string" && candidate.tabId.trim() !== ""
        ? candidate.tabId.trim()
        : DEFAULT_TAB_ID,
    market: candidate.market.trim().toUpperCase(),
    symbol: candidate.symbol.trim().toUpperCase(),
  };
}

export function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeImportedItem(item));
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchlistItem[]): void {
  localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(items));
}

export function loadWatchTabs(): WatchlistTab[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WATCHLIST_TABS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((tab): tab is Partial<WatchlistTab> => typeof tab === "object" && tab !== null)
      .map((tab, index) => {
        const id =
          typeof tab.id === "string" && tab.id.trim() !== ""
            ? tab.id.trim()
            : `tab-${index + 1}`;
        const name =
          typeof tab.name === "string" && tab.name.trim() !== ""
            ? tab.name.trim()
            : `Tab ${index + 1}`;
        return { id, name };
      });
  } catch {
    return [];
  }
}

export function saveWatchTabs(tabs: WatchlistTab[]): void {
  localStorage.setItem(WATCHLIST_TABS_STORAGE_KEY, JSON.stringify(tabs));
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

export function exportWatchlist(items: WatchlistItem[]): string {
  return JSON.stringify(items, null, 2);
}

export function importWatchlist(rawJson: string): WatchlistItem[] {
  const parsed = JSON.parse(rawJson) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("Import JSON must be an array.");
  }
  return parsed.map((item) => normalizeImportedItem(item));
}

export function createWatchlistItem(market: string, symbol: string, tabId: string): WatchlistItem {
  return {
    id: crypto.randomUUID(),
    tabId: tabId.trim() || DEFAULT_TAB_ID,
    market: market.trim().toUpperCase(),
    symbol: symbol.trim().toUpperCase(),
  };
}
