import { recordReview, listProofs, listReviewEvents } from "@/lib/db/queries";
import { getLibraryUnchecked } from "@/lib/content/loader";

export const dynamic = "force-dynamic";

const STATUSES = new Set(["pending", "approved", "changes_requested"]);

export async function GET() {
  try {
    const [proofs, events] = await Promise.all([listProofs(), listReviewEvents(40)]);
    return Response.json({
      proofs: proofs.map((proof) => ({
        id: proof.id,
        title: proof.title,
        difficulty: proof.difficulty,
        maxDepth: proof.maxDepth,
        stepCount: proof.stepCount,
        leafCount: proof.leafCount,
        checkpointCount: proof.checkpointCount,
        grounds: proof.grounds,
        validationPassed: proof.validationPassed,
        validationIssues: proof.validationIssues,
        reviewStatus: proof.reviewStatus,
        reviewer: proof.reviewer,
        reviewNote: proof.reviewNote,
        reviewedAt: proof.reviewedAt,
        contentHash: proof.contentHash,
      })),
      events,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      proofId?: string;
      status?: string;
      reviewer?: string;
      note?: string;
    };

    const proofId = String(body.proofId ?? "").trim();
    const status = String(body.status ?? "").trim();
    const reviewer = String(body.reviewer ?? "reviewer").trim().slice(0, 80) || "reviewer";
    const note = body.note ? String(body.note).slice(0, 2000) : undefined;

    if (!STATUSES.has(status)) {
      return Response.json({ error: `status must be one of ${[...STATUSES].join(", ")}` }, { status: 400 });
    }

    const { library } = getLibraryUnchecked();
    if (!library.proofs[proofId]) {
      return Response.json({ error: `no proof with id "${proofId}" in content/proofs` }, { status: 404 });
    }

    const proof = await recordReview({
      proofId,
      status: status as "pending" | "approved" | "changes_requested",
      reviewer,
      note,
    });

    if (!proof) return Response.json({ error: "proof row not found after update" }, { status: 404 });

    return Response.json({
      ok: true,
      proof: {
        id: proof.id,
        reviewStatus: proof.reviewStatus,
        reviewer: proof.reviewer,
        reviewNote: proof.reviewNote,
        reviewedAt: proof.reviewedAt,
      },
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "failed" }, { status: 500 });
  }
}
