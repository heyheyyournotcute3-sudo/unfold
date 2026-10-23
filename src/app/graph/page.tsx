import type { Metadata } from "next";
import Link from "next/link";

import { DependencyGraph, type GraphEdgeData, type GraphNodeData } from "@/components/DependencyGraph";
import { graphFromDatabase } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Dependency graph",
  description: "The DAG of every definition, axiom, lemma, rule and theorem in the library.",
};

export default async function GraphPage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string }>;
}) {
  const { focus } = await searchParams;
  const graph = await graphFromDatabase();

  const nodes: GraphNodeData[] = graph.nodes.map((node) => ({
    id: node.id,
    kind: node.kind,
    title: node.title,
    statement: node.statement,
    href: node.href,
  }));
  const edges: GraphEdgeData[] = graph.edges.map((edge) => ({
    fromId: edge.fromId,
    toId: edge.toId,
    relation: edge.relation,
  }));

  const byKind = graph.nodes.reduce<Record<string, number>>((acc, node) => {
    acc[node.kind] = (acc[node.kind] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-muted">Dependency graph</p>
        <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.7rem)] font-semibold leading-tight tracking-tight text-ink">
          What rests on what
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.85] text-ink-soft">
          Every definition, axiom, lemma, rule of inference and theorem in the library, as a directed
          acyclic graph. Click a theorem and everything it transitively depends on lights up — that
          highlight is the complete list of things you have to accept to accept the theorem.
        </p>
        <p className="mt-3 font-sans text-[0.82rem] text-muted">
          {nodes.length} nodes · {edges.length} links ·{" "}
          {Object.entries(byKind)
            .map(([kind, n]) => `${n} ${kind}${n === 1 ? "" : "s"}`)
            .join(", ")}
          . Read from the database, mirrored from <code className="unfold-code">content/</code> at build time.
        </p>
      </header>

      <DependencyGraph nodes={nodes} edges={edges} focus={focus} />

      <section className="grid gap-4 border-t border-rule pt-6 font-sans text-[0.85rem] text-muted md:grid-cols-3">
        <p>
          <Link href="/api/library/graph" className="text-accent underline underline-offset-2">
            /api/library/graph
          </Link>{" "}
          returns this graph as JSON.
        </p>
        <p>
          <Link href="/api/validation" className="text-accent underline underline-offset-2">
            /api/validation
          </Link>{" "}
          returns the report that proves it has no cycles.
        </p>
        <p>
          A cycle would mean a lemma resting on a theorem that rests on the lemma. The build refuses to
          produce pages in that state.
        </p>
      </section>
    </div>
  );
}
