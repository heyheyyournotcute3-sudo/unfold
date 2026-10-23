import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { MathHtml } from "@/components/MathHtml";
import { PathProgress } from "@/components/PathProgress";
import { getLibrary } from "@/lib/content/loader";
import { plainText, renderRichText } from "@/lib/content/richtext";
import { nodeHref } from "@/lib/content/serialize";
import { listProofs } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

type Params = { id: string };

function decodeId(raw: string): string {
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { id } = await params;
  const { library } = getLibrary();
  const path = library.paths.find((p) => p.id === decodeId(id));
  return { title: path ? `${path.title} — learning path` : "Learning path" };
}

export default async function PathPage({ params }: { params: Promise<Params> }) {
  const { id } = await params;
  const pathId = decodeId(id);
  const { library } = getLibrary();
  const path = library.paths.find((p) => p.id === pathId);
  if (!path) notFound();

  const rows = await listProofs();
  const statusById = new Map(rows.map((row) => [row.id, row]));

  const stops = path.stops.map((stop) => {
    const proof = library.proofs[stop.proof];
    const row = statusById.get(stop.proof);
    return {
      proof: stop.proof,
      title: plainText(proof?.title ?? stop.proof),
      why: stop.why,
      difficulty: proof?.difficulty ?? 3,
      reviewStatus: row?.reviewStatus ?? "pending",
    };
  });

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <nav aria-label="Breadcrumb" className="no-print font-sans text-[0.76rem] text-muted">
        <ol className="flex flex-wrap items-center gap-1.5">
          <li>
            <Link href="/paths" className="hover:text-accent">
              Learning paths
            </Link>
          </li>
          <li aria-hidden="true">›</li>
          <li aria-current="page" className="text-ink-soft">
            {path.title}
          </li>
        </ol>
      </nav>

      <header>
        <p className="font-sans text-[0.68rem] uppercase tracking-[0.2em] text-muted">
          {path.level} · {path.stops.length} stops
        </p>
        <h1 className="mt-2 text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-ink">
          {path.title}
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.85] text-ink-soft">{path.blurb}</p>
        {path.audience ? (
          <p className="mt-3 font-sans text-[0.85rem] text-muted">Written for: {path.audience}</p>
        ) : null}
      </header>

      <PathProgress pathId={path.id} stops={stops} />

      <section>
        <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">
          Assumed before you start
        </h2>
        {path.requires?.length ? (
          <ul className="mt-3 flex flex-wrap gap-2">
            {path.requires.map((req) => {
              const node = library.nodes[req] ?? library.rules[req];
              return (
                <li key={req}>
                  <Link
                    href={nodeHref(req)}
                    className="rounded-full border border-rule bg-panel px-3 py-1.5 font-sans text-[0.78rem] text-ink-soft hover:border-accent hover:text-accent"
                  >
                    {node?.title ?? req}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-2 font-sans text-[0.85rem] text-muted">Nothing beyond the statements themselves.</p>
        )}
      </section>

      <section className="rounded-xl border border-rule bg-panel p-5">
        <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-muted">Suggested reading depth</h2>
        <MathHtml
          html={renderRichText(
            "Read the first stop at **Every detail** to learn what unfolding means, then drop back to **Standard** for the rest. Return to *Every detail* whenever a step feels like a leap — the whole point is that the leap is optional.",
          )}
          className="mt-2 text-[0.95rem] leading-relaxed text-ink-soft"
        />
      </section>
    </div>
  );
}
