import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MathHtml } from "@/components/MathHtml";
import { getLibrary } from "@/lib/content/loader";
import { plainText, renderRichText } from "@/lib/content/richtext";
import { nodeHref } from "@/lib/content/serialize";
import type { Step } from "@/lib/content/types";

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
  return [...Object.keys(library.nodes), ...Object.keys(library.rules)].map((id) => ({ id }));
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const key = decodeId(id);
  const { library } = getLibrary();
  const node = library.nodes[key];
  const rule = library.rules[key];
  const title = node?.title ?? rule?.title ?? key;
  return {
    title,
    description: plainText(node?.statement ?? rule?.summary ?? "").slice(0, 200),
  };
}

function collectCitations(target: string): { proofId: string; stepId: string; depth: number }[] {
  const { library } = getLibrary();
  const hits: { proofId: string; stepId: string; depth: number }[] = [];
  for (const proofId of library.proofOrder) {
    const walk = (steps: Step[], depth: number) => {
      for (const step of steps) {
        const j = step.justification;
        if (j && (j.ref === target || j.rule === target)) hits.push({ proofId, stepId: step.id, depth });
        if (step.children?.length) walk(step.children, depth + 1);
      }
    };
    walk(library.proofs[proofId].steps, 1);
  }
  return hits;
}

export default async function LibraryEntryPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const key = decodeId(id);
  const { library } = getLibrary();

  const node = library.nodes[key];
  const rule = library.rules[key];
  if (!node && !rule) notFound();

  const title = node?.title ?? rule?.title ?? key;
  const statement = node?.statement ?? rule?.summary ?? "";
  const body = node?.body;
  const kind: string = node?.kind ?? "rule";
  const dependencies = node?.prerequisites ?? rule?.groundedIn ?? [];
  const citations = collectCitations(key);

  const dependents = Object.values(library.nodes)
    .filter((other) => (other.prerequisites ?? []).includes(key))
    .map((other) => ({ id: other.id, title: other.title, kind: other.kind }));

  const proofsDepending = library.proofOrder
    .filter((proofId) => (library.proofs[proofId].prerequisites ?? []).includes(key))
    .map((proofId) => library.proofs[proofId]);

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
            {key}
          </li>
        </ol>
      </nav>

      <header>
        <p className="font-sans text-[0.68rem] uppercase tracking-[0.2em] text-muted">{kind}</p>
        <h1 className="mt-2 text-[clamp(1.7rem,3.4vw,2.4rem)] font-semibold leading-tight tracking-tight text-ink">
          {title}
        </h1>
        <div className="mt-5 rounded-lg border-l-2 border-accent bg-panel px-5 py-4">
          <MathHtml html={renderRichText(statement)} className="text-[1.05rem] leading-[1.8] text-ink" />
        </div>
        {body ? (
          <div className="mt-5">
            <h2 className="font-sans text-[0.66rem] uppercase tracking-[0.16em] text-muted">Notes</h2>
            <MathHtml html={renderRichText(body)} className="mt-2 text-[0.98rem] leading-[1.85] text-ink-soft" />
          </div>
        ) : null}
      </header>

      <section className="mt-10 grid gap-6 border-t border-rule pt-8 sm:grid-cols-2">
        <div>
          <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">
            {kind === "rule" ? "Grounded in" : "Depends on"}
          </h2>
          {dependencies.length ? (
            <ul className="mt-3 space-y-2">
              {dependencies.map((dep) => {
                const target = library.nodes[dep] ?? library.rules[dep];
                return (
                  <li key={dep}>
                    <Link
                      href={nodeHref(dep)}
                      className="group block rounded border border-rule bg-panel px-3 py-2 hover:border-accent/60"
                    >
                      <span className="font-sans text-[0.64rem] uppercase tracking-[0.12em] text-muted">{dep}</span>
                      <span className="mt-0.5 block text-[0.94rem] text-ink-soft group-hover:text-accent">
                        {target?.title ?? dep}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-2 font-sans text-[0.85rem] text-muted">
              {kind === "axiom" ? "Nothing. This is bedrock." : "Nothing recorded."}
            </p>
          )}
        </div>

        <div>
          <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">Used by</h2>
          <ul className="mt-3 space-y-2">
            {dependents.map((dep) => (
              <li key={dep.id}>
                <Link href={nodeHref(dep.id)} className="block rounded border border-rule bg-panel px-3 py-2 hover:border-accent/60">
                  <span className="font-sans text-[0.64rem] uppercase tracking-[0.12em] text-muted">{dep.kind}</span>
                  <span className="mt-0.5 block text-[0.94rem] text-ink-soft">{dep.title}</span>
                </Link>
              </li>
            ))}
            {proofsDepending.map((proof) => (
              <li key={proof.id}>
                <Link href={`/proofs/${proof.id}`} className="block rounded border border-rule bg-panel px-3 py-2 hover:border-accent/60">
                  <span className="font-sans text-[0.64rem] uppercase tracking-[0.12em] text-muted">theorem · prerequisite</span>
                  <span className="mt-0.5 block text-[0.94rem] text-ink-soft">{plainText(proof.title)}</span>
                </Link>
              </li>
            ))}
          </ul>
          {!dependents.length && !proofsDepending.length && !citations.length ? (
            <p className="mt-2 font-sans text-[0.85rem] text-muted">
              Not cited anywhere yet. It is in the library because a future proof will need it.
            </p>
          ) : null}
        </div>
      </section>

      {citations.length ? (
        <section className="mt-8">
          <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">
            Cited by {citations.length} step{citations.length === 1 ? "" : "s"}
          </h2>
          <ul className="mt-3 flex flex-wrap gap-2 font-sans text-[0.78rem]">
            {citations.map((hit) => (
              <li key={`${hit.proofId}-${hit.stepId}`}>
                <Link
                  href={`/proofs/${hit.proofId}#step-${hit.stepId}`}
                  className="tabular rounded-full border border-rule bg-panel px-2.5 py-1 text-ink-soft hover:border-accent hover:text-accent"
                >
                  {plainText(library.proofs[hit.proofId]?.title ?? hit.proofId).slice(0, 28)} · {hit.stepId.replace(/^s/, "")}
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-3 font-sans text-[0.8rem] text-muted">
            Opening a citation lands you on that step in the reader, with its ancestors unfolded.
          </p>
        </section>
      ) : null}

      <section className="mt-10 border-t border-rule pt-6">
        <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">In the graph</h2>
        <p className="mt-2 font-sans text-[0.85rem] text-muted">
          <Link href={`/graph?focus=${encodeURIComponent(key)}`} className="text-accent underline underline-offset-2">
            Highlight everything {title} depends on
          </Link>{" "}
          in the dependency graph.
        </p>
      </section>
    </article>
  );
}
