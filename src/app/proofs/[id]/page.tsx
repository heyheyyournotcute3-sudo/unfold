import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MathHtml } from "@/components/MathHtml";
import { ProofReader } from "@/components/ProofReader";
import { ReviewBadge } from "@/components/ReviewBadge";
import { getLibrary } from "@/lib/content/loader";
import { plainText } from "@/lib/content/richtext";
import { nodeHref, renderProof } from "@/lib/content/serialize";
import { WIDGETS } from "@/lib/content/widget-registry";

export const dynamicParams = false;

type Params = { id: string };

function decodeId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export function generateStaticParams(): Params[] {
  const { library } = getLibrary();
  return library.proofOrder.map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const { library } = getLibrary();
  const proof = library.proofs[decodeId(id)];
  if (!proof) return { title: "Proof not found" };
  return {
    title: plainText(proof.title),
    description: plainText(proof.summary).slice(0, 220),
  };
}

export default async function ProofPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const proofId = decodeId(id);
  const { library } = getLibrary();
  const proof = library.proofs[proofId];
  if (!proof) notFound();

  const rendered = renderProof(proof, library);
  const order = library.proofOrder;
  const position = order.indexOf(proofId);
  const previous = position > 0 ? library.proofs[order[position - 1]] : null;
  const next = position >= 0 && position < order.length - 1 ? library.proofs[order[position + 1]] : null;

  const widgetIds = Array.from(
    new Set(
      rendered.steps.flatMap(function collect(step): string[] {
        return [...(step.widget ? [step.widget.id] : []), ...step.children.flatMap(collect)];
      }),
    ),
  );

  return (
    <article className="mx-auto max-w-3xl">
      <nav aria-label="Breadcrumb" className="no-print mb-6 font-sans text-[0.76rem] text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/" className="hover:text-accent">
              Unfold
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li>
            <Link href="/library" className="hover:text-accent">
              Library
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-ink-soft">
            {rendered.titlePlain}
          </li>
        </ol>
      </nav>

      <header>
        <p className="font-sans text-[0.68rem] uppercase tracking-[0.2em] text-muted">
          {proof.kind} · difficulty {proof.difficulty}/5 · unfolds to depth {rendered.maxDepth}
        </p>
        <h1 className="mt-3 text-[clamp(1.8rem,3.6vw,2.6rem)] font-semibold leading-[1.15] tracking-tight text-ink">
          <MathHtml as="span" html={rendered.titleHtml} />
        </h1>

        <div className="mt-5 rounded-lg border-l-2 border-accent bg-panel px-5 py-4">
          <p className="font-sans text-[0.66rem] uppercase tracking-[0.16em] text-muted">Statement</p>
          <MathHtml html={rendered.statementHtml} className="mt-1.5 text-[1.06rem] leading-[1.8] text-ink" />
        </div>

        <div className="no-print mt-5">
          <ReviewBadge proofId={proof.id} variant="banner" />
        </div>

        <div className="mt-5">
          <p className="font-sans text-[0.66rem] uppercase tracking-[0.16em] text-muted">In short</p>
          <MathHtml html={rendered.summaryHtml} className="mt-1.5 text-[0.98rem] leading-[1.8] text-ink-soft" />
        </div>

        <dl className="no-print mt-5 flex flex-wrap gap-x-6 gap-y-2 border-y border-rule py-3 font-sans text-[0.76rem] text-muted">
          <div>
            <dt className="inline">steps</dt> <dd className="tabular inline text-ink-soft">{rendered.stepCount}</dd>
          </div>
          <div>
            <dt className="inline">leaves, all grounded</dt>{" "}
            <dd className="tabular inline text-ink-soft">{rendered.leafCount}</dd>
          </div>
          <div>
            <dt className="inline">checkpoints</dt>{" "}
            <dd className="tabular inline text-ink-soft">{rendered.checkpointCount}</dd>
          </div>
          <div>
            <dt className="inline">widgets</dt> <dd className="tabular inline text-ink-soft">{widgetIds.length}</dd>
          </div>
          {rendered.tags.length ? (
            <div className="flex flex-wrap gap-1.5">
              {rendered.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/search?q=${encodeURIComponent(tag)}`}
                  className="rounded-full border border-rule bg-panel-alt px-2 py-0.5 hover:border-accent hover:text-accent"
                >
                  {tag}
                </Link>
              ))}
            </div>
          ) : null}
        </dl>
      </header>

      <section className="mt-10">
        <ProofReader proof={rendered} />
      </section>

      <section className="mt-14 space-y-8 border-t border-rule pt-8">
        <div>
          <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">What this proof rests on</h2>
          {rendered.prerequisites.length ? (
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {rendered.prerequisites.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="group flex items-baseline gap-2 rounded border border-rule bg-panel px-3 py-2 transition-colors hover:border-accent/60"
                  >
                    <span className="font-sans text-[0.64rem] uppercase tracking-[0.12em] text-muted">{item.kind}</span>
                    <span className="text-[0.92rem] text-ink-soft group-hover:text-accent">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 font-sans text-[0.85rem] text-muted">Nothing beyond the axioms of the library.</p>
          )}
          {rendered.related.length ? (
            <p className="mt-3 font-sans text-[0.82rem] text-muted">
              See also:{" "}
              {rendered.related.map((item, i) => (
                <span key={item.id}>
                  {i > 0 ? ", " : ""}
                  <Link href={item.href} className="text-accent underline underline-offset-2">
                    {item.title}
                  </Link>
                </span>
              ))}
            </p>
          ) : null}
        </div>

        {widgetIds.length ? (
          <div>
            <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">Interactive figures in this proof</h2>
            <ul className="mt-3 space-y-2">
              {widgetIds.map((widgetId) => {
                const meta = WIDGETS[widgetId];
                return (
                  <li key={widgetId} className="rounded border border-rule bg-panel px-3 py-2">
                    <p className="font-sans text-[0.85rem] text-ink">{meta?.title ?? widgetId}</p>
                    <p className="mt-0.5 font-sans text-[0.78rem] leading-relaxed text-muted">{meta?.description}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        <div>
          <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">Formal counterpart (stretch goal)</h2>
          {rendered.lean ? (
            <div className="mt-3 rounded-lg border border-rule bg-panel p-4">
              <p className="flex flex-wrap items-center gap-2 font-sans text-[0.78rem]">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[0.66rem] uppercase tracking-[0.1em] ${
                    rendered.lean.status === "verified"
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : rendered.lean.status === "candidate"
                        ? "border-flag/40 bg-flag-soft text-flag"
                        : "border-rule bg-panel-alt text-muted"
                  }`}
                >
                  {rendered.lean.status === "verified" ? "Lean 4 / Mathlib" : rendered.lean.status === "candidate" ? "candidate link — unverified" : "no formal counterpart"}
                </span>
                {rendered.lean.name ? <code className="unfold-code">{rendered.lean.name}</code> : null}
                {rendered.lean.file ? <span className="text-muted">{rendered.lean.file}</span> : null}
              </p>
              {rendered.lean.statement ? (
                <pre className="mt-3 overflow-x-auto rounded border border-rule bg-panel-alt p-3 font-mono text-[0.76rem] leading-relaxed text-ink-soft">
                  {rendered.lean.statement}
                </pre>
              ) : null}
              {rendered.lean.note ? (
                <p className="mt-2 font-sans text-[0.8rem] leading-relaxed text-muted">{rendered.lean.note}</p>
              ) : null}
            </div>
          ) : (
            <p className="mt-2 font-sans text-[0.85rem] text-muted">
              No Mathlib statement recorded for this proof. Reviewers should confirm that is accurate rather than
              assume the link was forgotten.
            </p>
          )}
        </div>

        {rendered.attributionHtml ? (
          <div>
            <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">Provenance</h2>
            <MathHtml html={rendered.attributionHtml} className="mt-2 text-[0.92rem] leading-relaxed text-ink-soft" />
          </div>
        ) : null}

        <p className="font-sans text-[0.8rem] text-muted">
          Source file: <code className="unfold-code">content/proofs/{proof.id}.yaml</code>. Change it and the build
          re-validates every reference, cycle and leaf; a content change also revokes any existing approval.
        </p>
      </section>

      <nav aria-label="Proof navigation" className="no-print mt-12 grid gap-3 border-t border-rule pt-6 sm:grid-cols-2">
        {previous ? (
          <Link href={`/proofs/${previous.id}`} className="rounded-lg border border-rule bg-panel px-4 py-3 hover:border-accent/60">
            <span className="block font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">Previous</span>
            <span className="mt-1 block text-[0.98rem] text-ink">{plainText(previous.title)}</span>
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link
            href={`/proofs/${next.id}`}
            className="rounded-lg border border-rule bg-panel px-4 py-3 text-right hover:border-accent/60"
          >
            <span className="block font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">Next</span>
            <span className="mt-1 block text-[0.98rem] text-ink">{plainText(next.title)}</span>
          </Link>
        ) : null}
      </nav>

      <p className="no-print mt-8 font-sans text-[0.78rem] text-muted">
        Every citation in this proof resolves to{" "}
        <Link href={nodeHref("def:proof")} className="text-accent underline underline-offset-2">
          a library entry
        </Link>{" "}
        or an earlier step. Nothing is cited that the library does not state.
      </p>
    </article>
  );
}
