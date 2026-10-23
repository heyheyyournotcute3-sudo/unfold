import Link from "next/link";

import { MathHtml } from "@/components/MathHtml";
import { ReviewBadge } from "@/components/ReviewBadge";
import { SearchBox } from "@/components/SearchBox";
import { getLibrary } from "@/lib/content/loader";
import { renderRichText } from "@/lib/content/richtext";
import { nodeHref } from "@/lib/content/serialize";

export const dynamic = "force-static";

export const metadata = {
  title: "Library",
  description: "Every theorem, lemma, definition, axiom and rule of inference in the Unfold library.",
};

export default function LibraryPage() {
  const { library } = getLibrary();
  const nodes = Object.values(library.nodes);
  const rules = Object.values(library.rules);
  const proofs = library.proofOrder.map((id) => library.proofs[id]);

  const groups = [
    { key: "axiom", label: "Axioms", blurb: "Stated, not proved. Everything else bottoms out here.", items: nodes.filter((n) => n.kind === "axiom") },
    { key: "definition", label: "Definitions", blurb: "Notation and meaning. No justification required, but dependencies are tracked.", items: nodes.filter((n) => n.kind === "definition") },
    { key: "lemma", label: "Lemmas", blurb: "Reusable facts with their own prerequisites and a proof sketch.", items: nodes.filter((n) => n.kind === "lemma") },
  ];

  return (
    <div className="space-y-14">
      <header className="max-w-3xl">
        <p className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-muted">Library</p>
        <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-tight tracking-tight text-ink">
          Everything the proofs are allowed to use
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.85] text-ink-soft">
          A proof may cite only what is listed here: an axiom, a definition, a lemma, a named rule of
          inference, or an earlier step of itself. The build-time validator rejects anything else, so
          there are no hidden assumptions — if you want to know what a proof rests on, this page and the{" "}
          <Link href="/graph" className="text-accent underline underline-offset-2">
            dependency graph
          </Link>{" "}
          are the complete answer.
        </p>
        <div className="mt-6 rounded-xl border border-rule bg-panel p-5">
          <SearchBox />
        </div>
      </header>

      <section>
        <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">Theorems with proofs</h2>
        <ul className="mt-4 grid gap-3 md:grid-cols-2">
          {proofs.map((proof) => (
            <li key={proof.id} className="rounded-lg border border-rule bg-panel p-4">
              <Link href={`/proofs/${proof.id}`} className="group">
                <h3 className="text-[1.1rem] leading-snug text-ink group-hover:text-accent">
                  <MathHtml as="span" html={renderRichText(proof.title)} />
                </h3>
              </Link>
              <div className="mt-2 text-[0.9rem] leading-relaxed text-ink-soft">
                <MathHtml html={renderRichText(proof.statement)} />
              </div>
              <p className="mt-2 font-sans text-[0.72rem] uppercase tracking-[0.12em] text-muted">
                {(proof.prerequisites ?? []).length} prerequisites · {(proof.tags ?? []).join(" / ")}
              </p>
              <div className="mt-2">
                <ReviewBadge proofId={proof.id} />
              </div>
            </li>
          ))}
        </ul>
      </section>

      {groups.map((group) => (
        <section key={group.key}>
          <div className="flex flex-wrap items-baseline gap-x-3">
            <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">{group.label}</h2>
            <span className="tabular font-sans text-[0.8rem] text-muted">{group.items.length}</span>
          </div>
          <p className="mt-1 max-w-2xl font-sans text-[0.85rem] text-muted">{group.blurb}</p>
          <ul className="mt-4 grid gap-2 md:grid-cols-2">
            {group.items.map((node) => (
              <li key={node.id}>
                <Link
                  href={nodeHref(node.id)}
                  className="group block h-full rounded-lg border border-rule bg-panel px-4 py-3 transition-colors hover:border-accent/60"
                >
                  <p className="flex items-baseline gap-2">
                    <span className="font-sans text-[0.64rem] uppercase tracking-[0.12em] text-muted">{node.id}</span>
                  </p>
                  <p className="mt-0.5 text-[1rem] text-ink group-hover:text-accent">{node.title}</p>
                  <p className="mt-1 line-clamp-3 text-[0.88rem] leading-relaxed text-ink-soft">
                    <MathHtml as="span" html={renderRichText(node.statement)} />
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}

      <section>
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-[1.5rem] font-semibold tracking-tight text-ink">Rules of inference</h2>
          <span className="tabular font-sans text-[0.8rem] text-muted">{rules.length}</span>
        </div>
        <p className="mt-1 max-w-2xl font-sans text-[0.85rem] text-muted">
          Licensed moves such as “by algebra” or “by contradiction”. Each is grounded in specific axioms,
          so a leaf step that cites a rule is still grounded.
        </p>
        <ul className="mt-4 grid gap-2 md:grid-cols-2">
          {rules.map((rule) => (
            <li key={rule.id}>
              <Link
                href={nodeHref(rule.id)}
                className="group block h-full rounded-lg border border-rule bg-panel px-4 py-3 transition-colors hover:border-accent/60"
              >
                <p className="text-[1rem] text-ink group-hover:text-accent">{rule.title}</p>
                <p className="mt-1 text-[0.88rem] leading-relaxed text-ink-soft">
                  <MathHtml as="span" html={renderRichText(rule.summary)} />
                </p>
                <p className="mt-1.5 font-sans text-[0.7rem] text-muted">
                  grounded in {rule.groundedIn.join(", ")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
