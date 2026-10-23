import { getPathProgress, setPathProgress, type ProgressStatus } from "@/lib/db/queries";
import { getLibraryUnchecked } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

const STATUSES = new Set<ProgressStatus>(["not_started", "in_progress", "completed"]);

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const pathId = url.searchParams.get("pathId") ?? "";
    const { library } = getLibraryUnchecked();
    if (!pathId || !library.paths.some((p) => p.id === pathId)) {
      return Response.json({ progress: {}, error: `unknown learning path "${pathId}"` }, { status: 404 });
    }
    const progress = await getPathProgress(pathId);
    return Response.json({ pathId, progress });
  } catch (error) {
    return Response.json({ progress: {}, error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { pathId?: string; proofId?: string; status?: string };
    const pathId = String(body.pathId ?? "").trim();
    const proofId = String(body.proofId ?? "").trim();
    const status = String(body.status ?? "").trim() as ProgressStatus;

    const { library } = getLibraryUnchecked();
    const path = library.paths.find((p) => p.id === pathId);
    if (!path) return Response.json({ error: `unknown learning path "${pathId}"` }, { status: 404 });
    if (!path.stops.some((stop) => stop.proof === proofId)) {
      return Response.json({ error: `"${proofId}" is not a stop on path "${pathId}"` }, { status: 400 });
    }
    if (!STATUSES.has(status)) {
      return Response.json({ error: `status must be one of ${[...STATUSES].join(", ")}` }, { status: 400 });
    }

    await setPathProgress(pathId, proofId, status);
    const progress = await getPathProgress(pathId);
    return Response.json({ ok: true, pathId, progress });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
