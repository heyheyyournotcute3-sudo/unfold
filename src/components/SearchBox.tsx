"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

interface Hit {
  docKey: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  proofId: string | null;
  stepId: string | null;
  rank: number;
}

const KIND_LABEL: Record<string, string> = {
  proof: "theorem",
  lemma: "lemma",
  definition: "definition",
  axiom: "axiom",
  rule: "rule",
  step: "step",
  path: "path",
};

function snippet(body: string, query: string): string {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = body.toLowerCase();
  let at = -1;
  for (const term of terms) {
    const found = lower.indexOf(term);
    if (found !== -1 && (at === -1 || found < at)) at = found;
  }
  if (at === -1) return `${body.slice(0, 150)}${body.length > 150 ? "…" : ""}`;
  const start = Math.max(0, at - 50);
  const end = Math.min(body.length, start + 190);
  return `${start > 0 ? "…" : ""}${body.slice(start, end)}${end < body.length ? "…" : ""}`;
}

export function SearchBox({ initialQuery = "", autoFocus = false }: { initialQuery?: string; autoFocus?: boolean }) {
  const [query, setQuery] = useState(initialQuery);
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(Boolean(initialQuery));
  const inputRef = useRef<HTMLInputElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const run = useCallback(async (value: string) => {
    const q = value.trim();
    if (!q) {
      setHits([]);
      setSearched(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`search failed (${response.status})`);
      const data = (await response.json()) as { hits?: Hit[] };
      setHits(data.hits ?? []);
      setSearched(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "search failed");
      setHits([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    if (initialQuery) void run(initialQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void run(query), 260);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [query, run]);

  return (
    <div>
      <form
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void run(query);
        }}
        className="flex gap-2"
      >
        <label className="sr-only" htmlFor="unfold-search">
          Search the library
        </label>
        <input
          id="unfold-search"
          ref={inputRef}
          type="search"
          value={query}
          placeholder="Search proofs, steps, definitions…  try “diagonal”, “even”, “gnomon”"
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setQuery("");
              setHits([]);
              setSearched(false);
            }
          }}
          className="w-full rounded-md border border-rule bg-panel px-3 py-2 font-sans text-[0.9rem] text-ink placeholder:text-muted/70 focus:border-accent focus:outline-none"
        />
        <button
          type="submit"
          className="shrink-0 rounded-md border border-accent bg-accent px-4 py-2 font-sans text-[0.85rem] text-white hover:opacity-90"
        >
          Search
        </button>
      </form>

      <p className="mt-2 font-sans text-[0.76rem] text-muted" role="status" aria-live="polite">
        {loading
          ? "Searching Postgres full-text index…"
          : error
            ? `Search error: ${error}`
            : searched
              ? `${hits.length} result${hits.length === 1 ? "" : "s"} for “${query.trim()}”`
              : "Full-text search over theorem statements, every step of every proof, definitions, lemmas, axioms and rules."}
      </p>

      {hits.length > 0 ? (
        <ol className="mt-4 divide-y divide-rule border-y border-rule">
          {hits.map((hit) => (
            <li key={hit.docKey} className="py-3">
              <Link href={hit.href} className="group block">
                <p className="flex flex-wrap items-baseline gap-2">
                  <span className="rounded-full border border-rule bg-panel-alt px-2 py-0.5 font-sans text-[0.66rem] uppercase tracking-[0.1em] text-muted">
                    {KIND_LABEL[hit.kind] ?? hit.kind}
                  </span>
                  <span className="text-[1rem] text-ink group-hover:text-accent">{hit.title}</span>
                </p>
                <p className="mt-1 font-sans text-[0.82rem] leading-relaxed text-muted">{snippet(hit.body, query)}</p>
              </Link>
            </li>
          ))}
        </ol>
      ) : searched && !loading ? (
        <p className="mt-4 font-sans text-[0.85rem] text-muted">
          Nothing matched. Try a shorter word — the index uses English stemming, so “irrational” also matches
          “irrationality”.
        </p>
      ) : null}
    </div>
  );
}
