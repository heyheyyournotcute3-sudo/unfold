"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type ReviewStatus = "pending" | "approved" | "changes_requested";

interface StatusEntry {
  status: ReviewStatus;
  reviewer: string | null;
  reviewedAt: string | null;
}

let cache: Promise<Record<string, StatusEntry>> | null = null;

function loadStatuses(): Promise<Record<string, StatusEntry>> {
  if (!cache) {
    cache = fetch("/api/reviews/statuses", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : {}))
      .then((data: { statuses?: Record<string, StatusEntry> }) => data.statuses ?? {})
      .catch(() => {
        cache = null;
        return {} as Record<string, StatusEntry>;
      });
  }
  return cache;
}

/** Invalidate the shared cache after a review decision. */
export function invalidateReviewStatuses(): void {
  cache = null;
}

const LABEL: Record<ReviewStatus, string> = {
  pending: "Pending human review",
  approved: "Approved",
  changes_requested: "Changes requested",
};

const STYLE: Record<ReviewStatus, string> = {
  pending: "border-flag/40 bg-flag-soft text-flag",
  approved: "border-accent/40 bg-accent-soft text-accent",
  changes_requested: "border-danger/40 bg-danger-soft text-danger",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function ReviewBadge({ proofId, variant = "pill" }: { proofId: string; variant?: "pill" | "banner" }) {
  const [entry, setEntry] = useState<StatusEntry | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    loadStatuses().then((all) => {
      if (!alive) return;
      setEntry(all[proofId] ?? null);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [proofId]);

  const status: ReviewStatus = entry?.status ?? "pending";

  if (variant === "pill") {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[0.7rem] uppercase tracking-[0.1em] ${STYLE[status]} ${loaded ? "" : "opacity-60"}`}
        title={loaded ? `Review status: ${LABEL[status]}` : "Loading review status"}
      >
        <span aria-hidden="true">{status === "approved" ? "✓" : status === "changes_requested" ? "!" : "◷"}</span>
        {loaded ? LABEL[status] : "checking…"}
      </span>
    );
  }

  return (
    <div className={`rounded-lg border px-4 py-3 font-sans text-[0.82rem] ${STYLE[status]}`} role="note">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <strong className="uppercase tracking-[0.12em] text-[0.7rem]">{loaded ? LABEL[status] : "Checking review status…"}</strong>
        {entry?.reviewer ? <span>· reviewed by {entry.reviewer}</span> : null}
        {entry?.reviewedAt ? <span>· {formatDate(entry.reviewedAt)}</span> : null}
        <Link href="/admin" className="ml-auto underline underline-offset-2 hover:opacity-80">
          Review console
        </Link>
      </p>
      <p className="mt-1 leading-relaxed opacity-90">
        {status === "pending"
          ? "The build-time validator has checked every reference, the dependency graph and the grounding of each leaf step. A human has not yet signed off on the mathematics."
          : status === "changes_requested"
            ? "A reviewer asked for changes. Read the note in the review console before citing this proof."
            : "A human reviewer has approved this proof. The validation report is archived alongside the decision."}
      </p>
      {entry?.reviewer && status !== "pending" ? null : null}
    </div>
  );
}
