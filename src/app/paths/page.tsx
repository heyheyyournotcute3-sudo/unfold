import Link from "next/link";

import { getLibrary } from "@/lib/content/loader";
import { plainText, renderRichText } from "@/lib/content/richtext";
import { MathHtml } from "@/components/MathHtml";

export const dynamic = "force-static";

export const metadata = {
  title: "Learning paths",
  description: "Curated sequences through the Unfold library.",
};

export default function PathsPage() {
  const { library } = getLibrary();

  return (
    <div className="space-y-10">
      <header className="max-w-3xl">
        <p className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-muted">Learning paths</p>
        <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-tight tracking-tight text-ink">
          Orders through the library that actually build on each other
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.85] text-ink-soft">
          A path is a curated sequence, not a syllabus dump: each stop says why it belongs there and what
          to unfold. Your progress is stored in the database, so you can leave and come back.
        </p>
      </header>

      <ul className="grid gap-5 md:grid-cols-2">
        {library.paths.map((path) => (
          <li key={path.id}>
            <Link
              href={`/paths/${path.id}`}
              className="group flex h-full flex-col rounded-xl border border-rule bg-panel p-6 transition-colors hover:border-accent/60"
            >
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-[1.35rem] font-semibold tracking-tight text-ink group-hover:text-accent">
                  {path.title}
                </span>
                <span className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">{path.level}</span>
                <span className="ml-auto tabular font-sans text-[0.72rem] text-muted">{path.stops.length} stops</span>
              </p>
              <p className="mt-3 font-sans text-[0.88rem] leading-relaxed text-ink-soft">{path.blurb}</p>
              <ol className="mt-4 space-y-1.5 border-t border-rule pt-3 font-sans text-[0.82rem] text-muted">
                {path.stops.map((stop, i) => (
                  <li key={stop.proof} className="flex gap-2">
                    <span className="tabular">{i + 1}.</span>
                    <span className="text-ink-soft">{plainText(library.proofs[stop.proof]?.title ?? stop.proof)}</span>
                  </li>
                ))}
              </ol>
              {path.audience ? (
                <p className="mt-4 font-sans text-[0.76rem] text-muted">For: {path.audience}</p>
              ) : null}
            </Link>
          </li>
        ))}
      </ul>

      <section className="max-w-3xl rounded-xl border border-rule bg-panel-alt p-6">
        <h2 className="text-[1.2rem] font-semibold tracking-tight text-ink">How to read a proof here</h2>
        <ol className="mt-3 space-y-2 font-sans text-[0.86rem] leading-relaxed text-ink-soft">
          <li>1 · Read the statement, then the sketch depth. Three to six lines.</li>
          <li>2 · Press <kbd className="rounded border border-rule bg-panel px-1">→</kbd> on any step that feels like a leap. It unfolds into 2–5 finer steps.</li>
          <li>
            3 · Follow the citation pills. A pill labelled <em>definition</em> or <em>axiom</em> links to
            the exact entry the step is allowed to use.
          </li>
          <li>4 · Answer the checkpoints. They mark the places where readers most often go wrong.</li>
          <li>
            5 · Check the banner. If it says <em>pending human review</em>, the structure has been
            machine-checked but no person has signed off on the mathematics yet.
          </li>
        </ol>
        <p className="mt-4 font-sans text-[0.82rem] text-muted">
          <MathHtml as="span" html={renderRichText("Everything on this site is rendered from $\\texttt{content/}$ at build time.")} />
        </p>
      </section>
    </div>
  );
}
