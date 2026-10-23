"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { invalidateReviewStatuses } from "@/components/ReviewBadge";

export type ReviewStatus = "pending" | "approved" | "changes_requested";

export interface AdminProofRow {
  id: string;
  title: string;
  difficulty: number;
  maxDepth: number;
  stepCount: number;
  leafCount: number;
  checkpointCount: number;
  grounds: Record<string, number>;
  validationPassed: boolean;
  validationIssues: { level: string; code: string; where: string; message: string }[];
  reviewStatus: ReviewStatus;
  reviewer: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  contentHash: string;
}

export interface AdminEvent {
  id: number;
  proofId: string;
  title: string | null;
  action: string;
  reviewer: string;
  note: string | null;
  createdAt: string;
}

const STATUS_STYLE: Record<ReviewStatus, string> = {
  pending: "border-flag/40 bg-flag-soft text-flag",
  approved: "border-accent/40 bg-accent-soft text-accent",
  changes_requested: "border-danger/40 bg-danger-soft text-danger",
};

const STATUS_LABEL: Record<ReviewStatus, string> = {
  pending: "Pending",
  approved: "Approved",
  changes_requested: "Changes requested",
};

type Filter = "all" | ReviewStatus;

export function AdminConsole({
  proofs,
  events,
  stats,
  validation,
}: {
  proofs: AdminProofRow[];
  events: AdminEvent[];
  stats: { docCount: number; eventCount: number; nodeKinds: { kind: string; n: number }[] };
  validation: { passed: boolean; errors: number; warnings: number; counts: Record<string, number>; generatedAt: string };
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [reviewer, setReviewer] = useState("reviewer");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = window.localStorage.getItem("unfold:reviewer");
    if (saved) setReviewer(saved);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem("unfold:reviewer", reviewer);
  }, [reviewer]);

  const counts = useMemo(() => {
    const base: Record<Filter, number> = { all: proofs.length, pending: 0, approved: 0, changes_requested: 0 };
    for (const proof of proofs) base[proof.reviewStatus] += 1;
    return base;
  }, [proofs]);

  const shown = useMemo(
    () => (filter === "all" ? proofs : proofs.filter((proof) => proof.reviewStatus === filter)),
    [filter, proofs],
  );

  const decide = useCallback(
    async (proofId: string, status: ReviewStatus) => {
      setBusy(proofId);
      setMessage(null);
      try {
        const response = await fetch("/api/reviews", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ proofId, status, reviewer: reviewer.trim() || "anonymous", note: notes[proofId] ?? "" }),
        });
        if (!response.ok) throw new Error(`request failed (${response.status})`);
        invalidateReviewStatuses();
        setMessage(`${proofId}: recorded as ${STATUS_LABEL[status]}.`);
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? `Could not record the decision: ${error.message}` : "Could not record the decision.");
      } finally {
        setBusy(null);
      }
    },
    [notes, reviewer, router],
  );

  const resync = useCallback(async () => {
    setSyncing(true);
    setMessage(null);
    try {
      const response = await fetch("/api/sync", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ force: true }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? `request failed (${response.status})`);
      invalidateReviewStatuses();
      setMessage(
        `Re-synced from disk: ${data.result?.proofs ?? 0} proofs, ${data.result?.nodes ?? 0} graph nodes, ${data.result?.documents ?? 0} search documents.` +
          (data.result?.revoked?.length ? ` Approval revoked for: ${data.result.revoked.join(", ")}.` : ""),
      );
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? `Sync failed: ${error.message}` : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }, [router]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Proofs in the library", value: proofs.length },
          { label: "Awaiting review", value: counts.pending },
          { label: "Approved", value: counts.approved },
          { label: "Validator", value: validation.passed ? "passing" : `${validation.errors} errors` },
        ].map((card) => (
          <div key={card.label} className="rounded-lg border border-rule bg-panel p-4">
            <p className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">{card.label}</p>
            <p className="tabular mt-1 text-2xl text-ink">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-rule bg-panel p-4">
        <label className="font-sans text-[0.82rem]">
          <span className="block text-[0.68rem] uppercase tracking-[0.14em] text-muted">Reviewer name</span>
          <input
            value={reviewer}
            onChange={(event) => setReviewer(event.target.value)}
            className="mt-1 w-56 rounded border border-rule bg-panel-alt px-2.5 py-1.5 text-[0.85rem] text-ink focus:border-accent focus:outline-none"
            placeholder="who is signing this off?"
          />
        </label>
        <button
          type="button"
          onClick={() => void resync()}
          disabled={syncing}
          className="rounded border border-accent bg-accent px-3 py-2 font-sans text-[0.82rem] text-white hover:opacity-90 disabled:opacity-50"
        >
          {syncing ? "Re-syncing…" : "Re-validate & re-sync content"}
        </button>
        <p className="font-sans text-[0.76rem] text-muted">
          Validation ran {new Date(validation.generatedAt).toISOString().slice(0, 16).replace("T", " ")} ·{" "}
          {validation.counts.steps ?? 0} steps · {validation.counts.axioms ?? 0} axioms ·{" "}
          {validation.counts.definitions ?? 0} definitions · {validation.counts.lemmas ?? 0} lemmas ·{" "}
          {validation.counts.rules ?? 0} rules · {stats.docCount} indexed documents
        </p>
        {message ? (
          <p className="w-full rounded border border-rule bg-panel-alt px-3 py-2 font-sans text-[0.82rem] text-ink-soft" role="status">
            {message}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 font-sans text-[0.8rem]" role="tablist" aria-label="Filter proofs by review status">
        {(["all", "pending", "approved", "changes_requested"] as Filter[]).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={filter === option}
            onClick={() => setFilter(option)}
            className={`rounded-full border px-3 py-1 transition-colors ${
              filter === option ? "border-accent bg-accent text-white" : "border-rule bg-panel text-ink-soft hover:border-accent"
            }`}
          >
            {option === "all" ? "All" : STATUS_LABEL[option as ReviewStatus]} · {counts[option]}
          </button>
        ))}
      </div>

      <ul className="space-y-3">
        {shown.map((proof) => (
          <li key={proof.id} className="rounded-lg border border-rule bg-panel p-4">
            <div className="flex flex-wrap items-start gap-x-4 gap-y-2">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2">
                  <Link href={`/proofs/${encodeURIComponent(proof.id)}`} className="text-[1.1rem] text-ink hover:text-accent">
                    {proof.title}
                  </Link>
                  <span className={`rounded-full border px-2 py-0.5 font-sans text-[0.66rem] uppercase tracking-[0.1em] ${STATUS_STYLE[proof.reviewStatus]}`}>
                    {STATUS_LABEL[proof.reviewStatus]}
                  </span>
                  <span
                    className={`rounded-full border px-2 py-0.5 font-sans text-[0.66rem] uppercase tracking-[0.1em] ${
                      proof.validationPassed ? "border-accent/40 bg-accent-soft text-accent" : "border-danger/40 bg-danger-soft text-danger"
                    }`}
                  >
                    {proof.validationPassed ? "validator: pass" : `validator: ${proof.validationIssues.length} issues`}
                  </span>
                </p>
                <p className="mt-1 font-sans text-[0.78rem] text-muted">
                  depth {proof.maxDepth} · {proof.stepCount} steps · {proof.leafCount} leaves · {proof.checkpointCount} checkpoints ·
                  difficulty {proof.difficulty}/5 · hash {proof.contentHash.slice(0, 8)}
                </p>
                <p className="mt-1 font-sans text-[0.78rem] text-muted">
                  leaf grounds:{" "}
                  {Object.entries(proof.grounds ?? {})
                    .filter(([, n]) => n > 0)
                    .map(([kind, n]) => `${n} ${kind}`)
                    .join(", ") || "—"}
                </p>
                {proof.reviewNote ? (
                  <p className="mt-2 border-l-2 border-rule-strong pl-3 font-sans text-[0.82rem] text-ink-soft">
                    Last note ({proof.reviewer ?? "unknown"}
                    {proof.reviewedAt ? `, ${new Date(proof.reviewedAt).toISOString().slice(0, 10)}` : ""}): {proof.reviewNote}
                  </p>
                ) : null}
                {!proof.validationPassed ? (
                  <ul className="mt-2 space-y-1 font-mono text-[0.72rem] text-danger">
                    {proof.validationIssues.slice(0, 6).map((issue, i) => (
                      <li key={i}>
                        [{issue.code}] {issue.where}: {issue.message}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>

              <div className="w-full max-w-sm space-y-2">
                <textarea
                  value={notes[proof.id] ?? ""}
                  onChange={(event) => setNotes((prev) => ({ ...prev, [proof.id]: event.target.value }))}
                  rows={2}
                  placeholder="Review note (recorded with the decision)"
                  aria-label={`Review note for ${proof.title}`}
                  className="w-full rounded border border-rule bg-panel-alt px-2.5 py-1.5 font-sans text-[0.82rem] text-ink focus:border-accent focus:outline-none"
                />
                <div className="flex flex-wrap gap-2 font-sans text-[0.8rem]">
                  <button
                    type="button"
                    disabled={busy === proof.id}
                    onClick={() => void decide(proof.id, "approved")}
                    className="rounded border border-accent bg-accent px-3 py-1.5 text-white hover:opacity-90 disabled:opacity-50"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busy === proof.id}
                    onClick={() => void decide(proof.id, "changes_requested")}
                    className="rounded border border-danger/60 bg-danger-soft px-3 py-1.5 text-danger hover:border-danger disabled:opacity-50"
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    disabled={busy === proof.id}
                    onClick={() => void decide(proof.id, "pending")}
                    className="rounded border border-rule bg-panel-alt px-3 py-1.5 text-ink-soft hover:border-flag hover:text-flag disabled:opacity-50"
                  >
                    Reset to pending
                  </button>
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <section className="rounded-lg border border-rule bg-panel p-4">
        <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">Audit trail</h2>
        {events.length === 0 ? (
          <p className="mt-2 font-sans text-[0.85rem] text-muted">
            No decisions recorded yet. Every proof starts as “pending human review”.
          </p>
        ) : (
          <ol className="mt-3 divide-y divide-rule">
            {events.map((event) => (
              <li key={event.id} className="flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 font-sans text-[0.82rem]">
                <span className="tabular text-muted">{new Date(event.createdAt).toISOString().slice(0, 16).replace("T", " ")}</span>
                <span className="text-ink">{event.action.replace(/_/g, " ")}</span>
                <Link href={`/proofs/${encodeURIComponent(event.proofId)}`} className="text-accent hover:underline">
                  {event.title ?? event.proofId}
                </Link>
                <span className="text-muted">by {event.reviewer}</span>
                {event.note ? <span className="w-full text-ink-soft italic">“{event.note}”</span> : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
