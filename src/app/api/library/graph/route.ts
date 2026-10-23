import { graphFromDatabase } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const graph = await graphFromDatabase();
    return Response.json(graph);
  } catch (error) {
    return Response.json({ nodes: [], edges: [], error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
