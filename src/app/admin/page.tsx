import type { Metadata } from "next";
import Link from "next/link";

import { AdminConsole, type AdminEvent, type AdminProofRow } from "@/components/AdminConsole";
import { getLibraryUnchecked } from "@/lib/content/loader";
import { dashboardStats, listProofs, listReviewEvents } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Review console",
  description: "Approve or reject proofs; inspect the build-time validation report.",
};

interface IssueShape {
  level: string;
  code: string;
  where: string;
  message: string;
}

export default async function AdminPage() {
  const [rows, events, stats] = await Promise.all([listProofs(), listReviewEvents(40), dashboardStats()]);
  const { report } = getLibraryUnchecked();

  const proofs: AdminProofRow[] = rows.map((row) => ({
    id: row.id,
    title: row.title,
    difficulty: row.difficulty,
    maxDepth: row.maxDepth,
    stepCount: row.stepCount,
    leafCount: row.leafCount,
    checkpointCount: row.checkpointCount,
    grounds: row.grounds ?? {},
    validationPassed: row.validationPassed,
    validationIssues: (row.validationIssues ?? []) as IssueShape[],
    reviewStatus: row.reviewStatus,
    reviewer: row.reviewer,
    reviewNote: row.reviewNote,
    reviewedAt: row.reviewedAt ? row.reviewedAt.toISOString() : null,
    contentHash: row.contentHash,
  }));

  const adminEvents: AdminEvent[] = events.map((event) => ({
    id: event.id,
    proofId: event.proofId,
    title: event.title,
    action: event.action,
    reviewer: event.reviewer,
    note: event.note,
    createdAt: event.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <header className="max-w-3xl">
        <p className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-muted">Review console</p>
        <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-ink">
          Nothing is published as correct until a person says so
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.85] text-ink-soft">
          The validator is mechanical: it checks that references resolve, that the dependency graph is
          acyclic, that every leaf step bottoms out in a stated definition or axiom, that every formula
          compiles, and that each proof unfolds at least three levels deep. It cannot tell you whether the
          <em> reasoning</em> is right. That is this page.
        </p>
        <ul className="mt-4 space-y-1.5 font-sans text-[0.85rem] text-muted">
          <li>· Approving records your name, the time, your note, and the validation report that was current.</li>
          <li>
            · If the content of an approved proof changes on disk, the approval is revoked automatically and
            the proof returns to <em>pending</em>. The audit trail keeps the old decision.
          </li>
          <li>
            · “Pending review” is shown to every reader, on every proof page, until a decision is recorded.
          </li>
        </ul>
      </header>

      <AdminConsole
        proofs={proofs}
        events={adminEvents}
        stats={{ docCount: stats.docCount, eventCount: stats.eventCount, nodeKinds: stats.nodeKinds }}
        validation={{
          passed: report.passed,
          errors: report.errors.length,
          warnings: report.warnings.length,
          counts: report.counts as unknown as Record<string, number>,
          generatedAt: report.generatedAt,
        }}
      />

      <section className="rounded-lg border border-rule bg-panel p-4">
        <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">
          Build-time validation detail
        </h2>
        <div className="mt-3 grid gap-4 md:grid-cols-2">
          <div>
            <p className="font-sans text-[0.82rem] text-ink-soft">
              {report.errors.length === 0
                ? "No errors. Every reference resolves, the graph is acyclic, and all leaf steps are grounded."
                : `${report.errors.length} error(s) — the production build would fail.`}
            </p>
            {report.warnings.length > 0 ? (
              <ul className="mt-2 space-y-1 font-mono text-[0.72rem] text-flag">
                {report.warnings.slice(0, 12).map((issue, i) => (
                  <li key={i}>
                    [{issue.code}] {issue.where}: {issue.message}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 font-sans text-[0.8rem] text-muted">No warnings either.</p>
            )}
          </div>
          <div>
            <table className="w-full font-sans text-[0.8rem]">
              <caption className="sr-only">Per-proof validation statistics</caption>
              <thead>
                <tr className="border-b border-rule text-left text-[0.68rem] uppercase tracking-[0.12em] text-muted">
                  <th scope="col" className="py-1 pr-2">proof</th>
                  <th scope="col" className="py-1 pr-2">depth</th>
                  <th scope="col" className="py-1 pr-2">steps</th>
                  <th scope="col" className="py-1 pr-2">leaves</th>
                  <th scope="col" className="py-1">grounded</th>
                </tr>
              </thead>
              <tbody>
                {report.proofs.map((entry) => (
                  <tr key={entry.proofId} className="border-b border-rule/60">
                    <td className="py-1.5 pr-2">
                      <Link href={`/proofs/${entry.proofId}`} className="text-accent hover:underline">
                        {entry.proofId}
                      </Link>
                    </td>
                    <td className="tabular py-1.5 pr-2">{entry.stats.maxDepth}</td>
                    <td className="tabular py-1.5 pr-2">{entry.stats.total}</td>
                    <td className="tabular py-1.5 pr-2">{entry.stats.leaves}</td>
                    <td className="tabular py-1.5">
                      {entry.stats.groundedLeaves}/{entry.stats.leaves}
                      {entry.passed ? "" : " ✗"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <p className="mt-3 font-sans text-[0.78rem] text-muted">
          Full machine-readable report:{" "}
          <Link href="/api/validation" className="text-accent underline underline-offset-2">
            /api/validation
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
