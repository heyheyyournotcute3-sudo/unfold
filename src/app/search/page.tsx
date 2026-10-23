import type { Metadata } from "next";
import Link from "next/link";

import { SearchBox } from "@/components/SearchBox";
import { getLibrary } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Search",
  description: "Full-text search across every proof, step, definition, lemma, axiom and rule.",
};

const SUGGESTIONS = [
  "diagonal",
  "even",
  "gnomon",
  "well-ordering",
  "lowest terms",
  "surjection",
  "induction",
  "area",
  "oracle",
  "decimal",
];

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const { library, report } = getLibrary();

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <p className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-muted">Search</p>
        <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-ink">
          Find the step, not just the theorem
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.85] text-ink-soft">
          The index is a Postgres <code className="unfold-code">tsvector</code> over{" "}
          {report.counts.steps} individual steps, {report.counts.definitions} definitions,{" "}
          {report.counts.lemmas} lemmas, {report.counts.axioms} axioms and {report.counts.rules} rules of
          inference — not just page titles. A hit on a step links straight to it, with its ancestors
          unfolded.
        </p>
      </header>

      <div className="rounded-xl border border-rule bg-panel p-5">
        <SearchBox initialQuery={q ?? ""} autoFocus />
      </div>

      <section className="font-sans text-[0.84rem]">
        <p className="text-[0.68rem] uppercase tracking-[0.16em] text-muted">Try one of these</p>
        <ul className="mt-2 flex flex-wrap gap-2">
          {SUGGESTIONS.map((term) => (
            <li key={term}>
              <Link
                href={`/search?q=${encodeURIComponent(term)}`}
                className="rounded-full border border-rule bg-panel px-3 py-1 text-ink-soft transition-colors hover:border-accent hover:text-accent"
              >
                {term}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="border-t border-rule pt-6 font-sans text-[0.84rem] text-muted">
        <p>
          Searching for a definition you already know the id of? Go straight to{" "}
          <Link href="/library" className="text-accent underline underline-offset-2">
            the library index
          </Link>{" "}
          or the{" "}
          <Link href="/graph" className="text-accent underline underline-offset-2">
            dependency graph
          </Link>
          . There are {Object.keys(library.nodes).length} entries.
        </p>
      </section>
    </div>
  );
}
