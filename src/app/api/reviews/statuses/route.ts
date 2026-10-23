import { reviewStatuses } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const statuses = await reviewStatuses();
    return Response.json({ statuses });
  } catch (error) {
    return Response.json(
      { statuses: {}, error: error instanceof Error ? error.message : "failed" },
      { status: 500 },
    );
  }
}
