import { searchLibrary } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const started = Date.now();
  try {
    const url = new URL(request.url);
    const query = url.searchParams.get("q") ?? "";
    const limit = Math.min(60, Math.max(1, Number(url.searchParams.get("limit") ?? 30) || 30));

    if (!query.trim()) {
      return Response.json({ query, hits: [], tookMs: Date.now() - started });
    }

    const hits = await searchLibrary(query, limit);
    return Response.json({ query, hits, tookMs: Date.now() - started });
  } catch (error) {
    return Response.json(
      { hits: [], error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
