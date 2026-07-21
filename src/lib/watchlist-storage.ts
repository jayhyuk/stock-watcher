import type { WatchlistItem } from "./types";

const STORAGE_KEY = "stock-check-watchlist";

export function loadWatchlist(): WatchlistItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as WatchlistItem[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveWatchlist(items: WatchlistItem[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function createWatchlistItem(market: string, symbol: string): WatchlistItem {
  return {
    id: crypto.randomUUID(),
    market: market.trim().toUpperCase(),
    symbol: symbol.trim().toUpperCase(),
  };
}
