import type { WatchlistItem } from "./types";

const STORAGE_KEY = "stock-check-watchlist";

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
    market: candidate.market.trim().toUpperCase(),
    symbol: candidate.symbol.trim().toUpperCase(),
  };
}

export function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeImportedItem(item));
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchlistItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
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

export function createWatchlistItem(market: string, symbol: string): WatchlistItem {
  return {
    id: crypto.randomUUID(),
    market: market.trim().toUpperCase(),
    symbol: symbol.trim().toUpperCase(),
  };
}
