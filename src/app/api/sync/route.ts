import { ensureSynced } from "@/lib/db/sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let force = false;
    try {
      const body = (await request.json()) as { force?: boolean };
      force = Boolean(body?.force);
    } catch {
      force = false;
    }
    const result = await ensureSynced(force);
    return Response.json({ ok: true, result });
  } catch (error) {
    return Response.json(
      { ok: false, error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
