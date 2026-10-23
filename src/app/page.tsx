import Link from "next/link";

import { MathHtml } from "@/components/MathHtml";
import { ReviewBadge } from "@/components/ReviewBadge";
import { SearchBox } from "@/components/SearchBox";
import { getLibrary } from "@/lib/content/loader";
import { renderProof } from "@/lib/content/serialize";

export const dynamic = "force-static";

function Difficulty({ value }: { value: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Difficulty ${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span
          key={n}
          aria-hidden="true"
          className={`inline-block h-1.5 w-3 rounded-full ${n <= value ? "bg-accent" : "bg-rule"}`}
        />
      ))}
    </span>
  );
}

export default function HomePage() {
  const { library, report } = getLibrary();
  const proofs = library.proofOrder.map((id) => library.proofs[id]);
  const rendered = proofs.map((proof) => renderProof(proof, library));
  const featured = library.proofs["primes-infinite"];
  const featuredRendered = featured ? renderProof(featured, library) : null;

  return (
    <div className="space-y-20">
      <section className="grid gap-10 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        <div>
          <p className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-muted">
            A library of unfoldable proofs
          </p>
          <h1 className="mt-4 text-[clamp(2.1rem,4.6vw,3.4rem)] font-semibold leading-[1.1] tracking-tight text-ink">
            Every proof is a tree.
            <span className="block text-ink-soft">Read the top, or climb down to the axioms.</span>
          </h1>
          <p className="mt-5 max-w-xl text-[1.05rem] leading-[1.85] text-ink-soft">
            A proof here is never a wall of text. It is three lines you can read in ten seconds — and
            every one of those lines has a <span className="text-flare">Why?</span> control that
            unfolds it into finer steps, which unfold again, until the only things left are
            definitions and axioms that the library states openly.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 font-sans text-[0.88rem]">
            <Link
              href="/proofs/primes-infinite"
              className="rounded-md border border-accent bg-accent px-4 py-2.5 text-white transition-opacity hover:opacity-90"
            >
              Read “There are infinitely many primes”
            </Link>
            <Link
              href="/graph"
              className="rounded-md border border-rule bg-panel px-4 py-2.5 text-ink-soft transition-colors hover:border-accent hover:text-accent"
            >
              See the dependency graph
            </Link>
            <Link
              href="/keyboard"
              className="rounded-md border border-transparent px-2 py-2.5 text-muted underline underline-offset-4 transition-colors hover:text-accent"
            >
              Keyboard &amp; screen-reader notes
            </Link>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-rule pt-6 font-sans text-[0.82rem] sm:grid-cols-4">
            {[
              { label: "proofs", value: report.counts.proofs },
              { label: "steps authored", value: report.counts.steps },
              { label: "definitions", value: report.counts.definitions },
              { label: "axioms", value: report.counts.axioms },
              { label: "lemmas", value: report.counts.lemmas },
              { label: "rules of inference", value: report.counts.rules },
              { label: "dependency links", value: report.counts.edges },
              { label: "validator", value: report.passed ? "passing" : "failing" },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">{item.label}</dt>
                <dd className="tabular mt-0.5 text-[1.35rem] text-ink">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-xl border border-rule bg-panel p-6 shadow-[0_1px_0_rgba(0,0,0,0.02)]">
          <p className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">
            The sketch level — infinitely many primes
          </p>
          {featuredRendered ? (
            <>
              <div className="mt-3 border-b border-rule pb-3">
                <MathHtml html={featuredRendered.statementHtml} className="text-[0.98rem] text-ink" />
              </div>
              <ol className="mt-4 space-y-3">
                {featuredRendered.steps.map((step, i) => (
                  <li key={step.id} className="flex gap-3">
                    <span className="tabular mt-1 w-5 shrink-0 text-right font-sans text-[0.7rem] text-muted">{i + 1}</span>
                    <div className="min-w-0">
                      <MathHtml html={step.html} className="text-[0.94rem] leading-[1.7] text-ink-soft" />
                      <p className="mt-1 font-sans text-[0.72rem]">
                        <span className="rounded-full border border-flare/50 bg-flare-soft px-2 py-0.5 text-flare">
                          Why? {step.childCount}
                        </span>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <p className="mt-5 font-sans text-[0.8rem] text-muted">
                Six lines. Each one unfolds into 2–5 finer steps, and those unfold again —{" "}
                <Link href="/proofs/primes-infinite" className="text-accent underline underline-offset-2">
                  open the reader
                </Link>{" "}
                to try the depth slider.
              </p>
            </>
          ) : null}
        </div>
      </section>

      <section>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-[1.7rem] font-semibold tracking-tight text-ink">The library</h2>
            <p className="mt-1 font-sans text-[0.85rem] text-muted">
              Seven proofs, each unfolding to at least three levels. Nothing here is marked correct
              until a human reviewer approves it.
            </p>
          </div>
          <Link href="/library" className="font-sans text-[0.85rem] text-accent underline underline-offset-4">
            Browse definitions, axioms and lemmas
          </Link>
        </div>

        <ul className="mt-6 grid gap-4 md:grid-cols-2">
          {rendered.map((proof, i) => (
            <li key={proof.id}>
              <Link
                href={`/proofs/${proof.id}`}
                className="group flex h-full flex-col rounded-xl border border-rule bg-panel p-5 transition-colors hover:border-accent/60"
              >
                <p className="flex items-center gap-2 font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">
                  <span>{proofs[i].kind}</span>
                  <span aria-hidden="true">·</span>
                  <span>depth {proof.maxDepth}</span>
                  <span aria-hidden="true">·</span>
                  <span>{proof.stepCount} steps</span>
                  <span className="ml-auto">
                    <Difficulty value={proof.difficulty} />
                  </span>
                </p>
                <h3 className="mt-2 text-[1.22rem] leading-snug text-ink group-hover:text-accent">
                  <MathHtml as="span" html={proof.titleHtml} />
                </h3>
                <div className="mt-2 text-[0.92rem] leading-relaxed text-ink-soft">
                  <MathHtml html={proof.statementHtml} />
                </div>
                <p className="mt-3 flex flex-wrap gap-1.5 font-sans text-[0.7rem]">
                  {proof.tags.slice(0, 4).map((tag) => (
                    <span key={tag} className="rounded-full border border-rule bg-panel-alt px-2 py-0.5 text-muted">
                      {tag}
                    </span>
                  ))}
                </p>
              </Link>
              <div className="mt-2 px-1">
                <ReviewBadge proofId={proof.id} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
        <div>
          <h2 className="text-[1.7rem] font-semibold tracking-tight text-ink">Learning paths</h2>
          <p className="mt-1 font-sans text-[0.85rem] text-muted">
            Curated orders through the library, with progress you can keep.
          </p>
          <ul className="mt-5 space-y-3">
            {library.paths.map((path) => (
              <li key={path.id}>
                <Link
                  href={`/paths/${path.id}`}
                  className="group block rounded-xl border border-rule bg-panel p-5 transition-colors hover:border-accent/60"
                >
                  <p className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[1.15rem] text-ink group-hover:text-accent">{path.title}</span>
                    <span className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">{path.level}</span>
                    <span className="ml-auto font-sans text-[0.72rem] text-muted">{path.stops.length} stops</span>
                  </p>
                  <p className="mt-2 font-sans text-[0.85rem] leading-relaxed text-ink-soft">{path.blurb}</p>
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="text-[1.7rem] font-semibold tracking-tight text-ink">Search everything</h2>
          <p className="mt-1 font-sans text-[0.85rem] text-muted">
            Postgres full-text search over theorem statements, every individual step, definitions,
            lemmas, axioms and rules.
          </p>
          <div className="mt-5 rounded-xl border border-rule bg-panel p-5">
            <SearchBox />
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-rule bg-panel-alt p-6">
        <h2 className="text-[1.3rem] font-semibold tracking-tight text-ink">What the build guarantees</h2>
        <div className="mt-4 grid gap-5 font-sans text-[0.86rem] leading-relaxed text-ink-soft md:grid-cols-3">
          <div>
            <p className="text-ink">1 · Nothing dangles</p>
            <p className="mt-1">
              Every citation — a definition, a lemma, a rule of inference, an earlier step, another
              theorem — must resolve to something that exists in <code className="unfold-code">content/</code>.
              If it does not, the build fails.
            </p>
          </div>
          <div>
            <p className="text-ink">2 · Nothing is circular</p>
            <p className="mt-1">
              The dependency graph is checked for cycles on every build. A lemma may not lean on a
              theorem that leans on the lemma.
            </p>
          </div>
          <div>
            <p className="text-ink">3 · Every leaf is grounded</p>
            <p className="mt-1">
              Walk any step down to its leaves and each one cites a stated definition, a stated
              axiom, or a named rule that is itself grounded in axioms. Currently: all{" "}
              {report.proofs.reduce((sum, p) => sum + p.stats.leaves, 0)} leaves grounded.
            </p>
          </div>
        </div>
        <p className="mt-5 font-sans text-[0.82rem] text-muted">
          Correctness of the *reasoning* is a human judgement, which is why every proof ships as{" "}
          <Link href="/admin" className="text-accent underline underline-offset-2">
            pending review
          </Link>
          . The validator checks structure; a reviewer checks mathematics.
        </p>
      </section>
    </div>
  );
}
