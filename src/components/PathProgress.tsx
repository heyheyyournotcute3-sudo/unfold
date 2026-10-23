"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

export type ProgressStatus = "not_started" | "in_progress" | "completed";

interface Stop {
  proof: string;
  title: string;
  why: string;
  difficulty: number;
  reviewStatus: string;
}

const LABEL: Record<ProgressStatus, string> = {
  not_started: "Not started",
  in_progress: "Reading",
  completed: "Completed",
};

export function PathProgress({ pathId, stops }: { pathId: string; stops: Stop[] }) {
  const [progress, setProgress] = useState<Record<string, ProgressStatus>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(`/api/progress?pathId=${encodeURIComponent(pathId)}`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : { progress: {} }))
      .then((data: { progress?: Record<string, ProgressStatus> }) => {
        if (!alive) return;
        setProgress(data.progress ?? {});
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
    };
  }, [pathId]);

  const update = useCallback(
    async (proofId: string, status: ProgressStatus) => {
      setProgress((prev) => ({ ...prev, [proofId]: status }));
      setSaving(proofId);
      try {
        await fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ pathId, proofId, status }),
        });
      } finally {
        setSaving(null);
      }
    },
    [pathId],
  );

  const completed = stops.filter((stop) => progress[stop.proof] === "completed").length;

  return (
    <div className="rounded-lg border border-rule bg-panel">
      <div className="border-b border-rule px-4 py-3">
        <p className="font-sans text-[0.68rem] uppercase tracking-[0.14em] text-muted">Your progress</p>
        <div className="mt-2 flex items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-rule" role="presentation">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${stops.length ? (completed / stops.length) * 100 : 0}%` }}
            />
          </div>
          <span className="tabular font-sans text-[0.78rem] text-ink-soft">
            {loaded ? `${completed} / ${stops.length}` : "—"}
          </span>
        </div>
      </div>

      <ol className="divide-y divide-rule">
        {stops.map((stop, index) => {
          const status = progress[stop.proof] ?? "not_started";
          return (
            <li key={stop.proof} className="px-4 py-3">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="tabular font-sans text-[0.72rem] text-muted">{index + 1}</span>
                <Link href={`/proofs/${encodeURIComponent(stop.proof)}`} className="text-[1rem] text-ink hover:text-accent">
                  {stop.title}
                </Link>
                <span className="font-sans text-[0.7rem] uppercase tracking-[0.1em] text-muted">
                  difficulty {stop.difficulty}/5
                </span>
                {stop.reviewStatus !== "approved" ? (
                  <span className="rounded-full border border-flag/40 bg-flag-soft px-2 py-0.5 font-sans text-[0.64rem] uppercase tracking-[0.1em] text-flag">
                    pending review
                  </span>
                ) : null}
              </div>
              <p className="mt-1 font-sans text-[0.82rem] leading-relaxed text-ink-soft">{stop.why}</p>
              <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label={`Progress for ${stop.title}`}>
                {(Object.keys(LABEL) as ProgressStatus[]).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={status === option}
                    disabled={saving === stop.proof}
                    onClick={() => void update(stop.proof, option)}
                    className={`rounded-full border px-2.5 py-1 font-sans text-[0.72rem] transition-colors disabled:opacity-50 ${
                      status === option
                        ? "border-accent bg-accent-soft text-accent"
                        : "border-rule bg-panel-alt text-muted hover:border-accent hover:text-accent"
                    }`}
                  >
                    {LABEL[option]}
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
