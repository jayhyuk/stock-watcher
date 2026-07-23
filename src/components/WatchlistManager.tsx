"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import type { QuoteResponse, StockQuote, WatchlistItem } from "@/lib/types";
import {
  createWatchlistItem,
  loadQuoteCache,
  loadWatchlist,
  saveQuoteCache,
  saveWatchlist,
} from "@/lib/watchlist-storage";

type QuoteMap = Record<string, StockQuote>;

function quoteKey(market: string, symbol: string): string {
  return `${market}:${symbol}`;
}

function formatPrice(price: number, currency: string): string {
  return `${price.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
}

function formatChange(change: number, changePercent: number): string {
  const sign = change >= 0 ? "+" : "";
  return `${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)`;
}

const MARKET_OPTIONS = ["SHZ", "SHH", "US", "HK", "TH", "JP", "SG"];

export default function WatchlistManager() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteMap>({});
  const [market, setMarket] = useState("SHZ");
  const [symbol, setSymbol] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadingTarget, setLoadingTarget] = useState<"all" | string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loadedAt, setLoadedAt] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const cachedItems = loadWatchlist();
    const cachedQuotes = loadQuoteCache();
    const nextQuotes: QuoteMap = {};

    for (const quote of cachedQuotes.quotes) {
      nextQuotes[quoteKey(quote.market, quote.symbol)] = quote;
    }

    setItems(cachedItems);
    setQuotes(nextQuotes);
    setLoadedAt(cachedQuotes.loadedAt);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveQuoteCache({ quotes: Object.values(quotes), loadedAt });
  }, [quotes, loadedAt, hydrated]);

  const persist = useCallback((next: WatchlistItem[]) => {
    setItems(next);
    saveWatchlist(next);
  }, []);

  function resetForm() {
    setMarket("SHZ");
    setSymbol("");
    setEditingId(null);
    setError(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmedSymbol = symbol.trim();
    if (!trimmedSymbol) {
      setError("Symbol is required.");
      return;
    }

    const normalizedMarket = market.trim().toUpperCase();
    const normalizedSymbol = trimmedSymbol.toUpperCase();

    const duplicate = items.some(
      (item) =>
        item.market === normalizedMarket &&
        item.symbol === normalizedSymbol &&
        item.id !== editingId,
    );
    if (duplicate) {
      setError(`${normalizedMarket}/${normalizedSymbol} is already on the watchlist.`);
      return;
    }

    if (editingId) {
      persist(
        items.map((item) =>
          item.id === editingId
            ? { ...item, market: normalizedMarket, symbol: normalizedSymbol }
            : item,
        ),
      );
    } else {
      persist([
        ...items,
        createWatchlistItem(normalizedMarket, normalizedSymbol),
      ]);
    }

    resetForm();
  }

  function startEdit(item: WatchlistItem) {
    setEditingId(item.id);
    setMarket(item.market);
    setSymbol(item.symbol);
    setError(null);
  }

  function handleDelete(id: string) {
    persist(items.filter((item) => item.id !== id));
    if (editingId === id) resetForm();
  }

  async function loadQuotes(
    targetItems: Array<{ market: string; symbol: string }>,
  ): Promise<QuoteResponse> {
    const res = await fetch("/api/quote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: targetItems }),
    });

    if (!res.ok) {
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? `Request failed (${res.status})`);
    }

    return (await res.json()) as QuoteResponse;
  }

  function mergeQuotes(nextQuotes: StockQuote[]) {
    setQuotes((prev) => {
      const merged = { ...prev };
      for (const quote of nextQuotes) {
        merged[quoteKey(quote.market, quote.symbol)] = quote;
      }
      return merged;
    });
  }

  async function handleLoadAll() {
    if (items.length === 0) {
      setError("Add at least one stock before loading quotes.");
      return;
    }

    setLoadingTarget("all");
    setError(null);

    try {
      const data = await loadQuotes(
        items.map(({ market, symbol }) => ({ market, symbol })),
      );
      mergeQuotes(data.quotes);
      setLoadedAt(new Date().toLocaleString());

      if (data.errors.length > 0) {
        setError(
          `Some quotes failed: ${data.errors.map((e) => `${e.market}/${e.symbol}`).join(", ")}`,
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quotes.");
    } finally {
      setLoadingTarget(null);
    }
  }

  async function handleLoadOne(item: WatchlistItem) {
    const key = quoteKey(item.market, item.symbol);
    setLoadingTarget(key);
    setError(null);

    try {
      const data = await loadQuotes([{ market: item.market, symbol: item.symbol }]);
      mergeQuotes(data.quotes);
      setLoadedAt(new Date().toLocaleString());

      if (data.errors.length > 0) {
        setError(data.errors[0].error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quote.");
    } finally {
      setLoadingTarget(null);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Stock Watchlist</h1>
        <p className="mt-2 text-[var(--muted)]">
          Add stocks by market and symbol, then load prices from the API.
        </p>
      </header>

      <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6">
        <h2 className="mb-4 text-lg font-semibold">
          {editingId ? "Edit stock" : "Add stock"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-4">
          <label className="flex min-w-[120px] flex-1 flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--muted)]">Market</span>
            <select
              value={market}
              onChange={(e) => setMarket(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 outline-none focus:border-[var(--accent)]"
            >
              {MARKET_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>

          <label className="flex min-w-[160px] flex-[2] flex-col gap-1.5">
            <span className="text-sm font-medium text-[var(--muted)]">Symbol</span>
            <input
              type="text"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              placeholder="e.g. AAPL"
              className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2.5 uppercase outline-none focus:border-[var(--accent)]"
            />
          </label>

          <div className="flex gap-2">
            <button
              type="submit"
              className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-white transition hover:bg-[var(--accent-hover)]"
            >
              {editingId ? "Save" : "Add"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-[var(--border)] px-5 py-2.5 font-medium transition hover:bg-[var(--surface-hover)]"
              >
                Cancel
              </button>
            )}
          </div>
        </form>

        {error && (
          <p className="mt-4 rounded-lg border border-[var(--negative)]/30 bg-[var(--negative)]/10 px-4 py-2.5 text-sm text-[var(--negative)]">
            {error}
          </p>
        )}
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold">Watchlist</h2>
            {loadedAt && (
              <p className="text-sm text-[var(--muted)]">Last loaded: {loadedAt}</p>
            )}
          </div>
          <button
            type="button"
            onClick={handleLoadAll}
            disabled={loadingTarget !== null || items.length === 0}
            className="rounded-lg bg-[var(--accent)] px-6 py-2.5 font-medium text-white transition hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loadingTarget === "all" ? "Loading all…" : "Load all"}
          </button>
        </div>

        {items.length === 0 ? (
          <p className="px-6 py-10 text-center text-[var(--muted)]">
            No stocks yet. Add one above to get started.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-[var(--muted)]">
                  <th className="px-6 py-3 font-medium">Market</th>
                  <th className="px-6 py-3 font-medium">Symbol</th>
                  <th className="px-6 py-3 font-medium text-right">Last seen</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const quote = quotes[quoteKey(item.market, item.symbol)];
                  const lastSeen = quote?.lastSeen;
                  const lastSeenPositive = lastSeen ? lastSeen.change >= 0 : null;

                  return (
                    <tr
                      key={item.id}
                      className="border-b border-[var(--border)] last:border-b-0 hover:bg-[var(--surface-hover)]/50"
                    >
                      <td className="px-6 py-4 font-medium">{item.market}</td>
                      <td className="px-6 py-4 font-mono">{item.symbol}</td>
                      <td className="px-6 py-4 text-right font-mono">
                        {lastSeen ? (
                          <div className="flex flex-col items-end gap-0.5">
                            <span className="text-xs text-[var(--muted)]">{lastSeen.date}</span>
                            <span>{formatPrice(lastSeen.price, lastSeen.currency)}</span>
                            <span
                              className={
                                lastSeenPositive
                                  ? "text-[var(--positive)]"
                                  : lastSeenPositive === false
                                    ? "text-[var(--negative)]"
                                    : "text-[var(--muted)]"
                              }
                            >
                              {formatChange(lastSeen.change, lastSeen.changePercent)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="inline-flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadOne(item)}
                            disabled={loadingTarget !== null}
                            className="rounded-md border border-[var(--accent)]/40 px-3 py-1.5 text-xs font-medium text-[var(--accent)] transition hover:bg-[var(--accent)]/10 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {loadingTarget === quoteKey(item.market, item.symbol)
                              ? "Loading…"
                              : "Load"}
                          </button>
                          <button
                            type="button"
                            onClick={() => startEdit(item)}
                            disabled={loadingTarget !== null}
                            className="rounded-md border border-[var(--border)] px-3 py-1.5 text-xs font-medium transition hover:bg-[var(--surface-hover)]"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item.id)}
                            disabled={loadingTarget !== null}
                            className="rounded-md border border-[var(--negative)]/40 px-3 py-1.5 text-xs font-medium text-[var(--negative)] transition hover:bg-[var(--negative)]/10"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-6 text-center text-xs text-[var(--muted)]">
        Prices from{" "}
        <a
          href="https://www.alphavantage.co/documentation/"
          className="text-[var(--accent)] hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Alpha Vantage
        </a>
        {" "}daily close — change is vs the previous trading day.
      </p>
    </div>
  );
}
