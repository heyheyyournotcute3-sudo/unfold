import { getLibraryUnchecked } from "@/lib/content/loader";
import { buildGraph } from "@/lib/content/validator";

export const dynamic = "force-dynamic";

/** The full build-time validation report, plus the dependency graph it checked. */
export async function GET() {
  try {
    const { library, report } = getLibraryUnchecked();
    const graph = buildGraph(library);
    return Response.json({
      passed: report.passed,
      generatedAt: report.generatedAt,
      contentHash: library.contentHash,
      counts: report.counts,
      errors: report.errors,
      warnings: report.warnings,
      cycles: report.cycles,
      files: library.files,
      proofs: report.proofs,
      graph: { nodes: graph.nodes.length, edges: graph.edges.length },
    });
  } catch (error) {
    return Response.json({ passed: false, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
