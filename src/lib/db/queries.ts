/**
 * Database access. Every function that reads content-derived tables calls
 * `ensureSynced()` first, so a fresh database is populated on first request.
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import {
  libraryEdges,
  libraryNodes,
  pathProgress,
  proofs,
  reviewEvents,
  searchDocuments,
} from "@/db/schema";
import { ensureSynced } from "./sync";

export type ReviewStatus = "pending" | "approved" | "changes_requested";

export interface ProofRow {
  id: string;
  slug: string;
  title: string;
  kind: string;
  difficulty: number;
  statement: string;
  summary: string;
  tags: string[];
  prerequisites: string[];
  contentHash: string;
  maxDepth: number;
  stepCount: number;
  leafCount: number;
  checkpointCount: number;
  grounds: Record<string, number>;
  validationPassed: boolean;
  validationIssues: unknown[];
  reviewStatus: ReviewStatus;
  reviewer: string | null;
  reviewNote: string | null;
  reviewedAt: Date | null;
  updatedAt: Date;
}

export async function listProofs(): Promise<ProofRow[]> {
  await ensureSynced();
  const rows = await db
    .select()
    .from(proofs)
    .orderBy(asc(proofs.difficulty), asc(proofs.id));
  return rows as unknown as ProofRow[];
}

export async function getProofRow(id: string): Promise<ProofRow | null> {
  await ensureSynced();
  const rows = await db.select().from(proofs).where(eq(proofs.id, id)).limit(1);
  return (rows[0] as unknown as ProofRow) ?? null;
}

/** Review status for every proof, for the reader badges (one round trip). */
export async function reviewStatuses(): Promise<Record<string, { status: ReviewStatus; reviewer: string | null; reviewedAt: Date | null }>> {
  await ensureSynced();
  const rows = await db
    .select({ id: proofs.id, status: proofs.reviewStatus, reviewer: proofs.reviewer, reviewedAt: proofs.reviewedAt })
    .from(proofs);
  const out: Record<string, { status: ReviewStatus; reviewer: string | null; reviewedAt: Date | null }> = {};
  for (const row of rows) out[row.id] = { status: row.status, reviewer: row.reviewer, reviewedAt: row.reviewedAt };
  return out;
}

export interface ReviewInput {
  proofId: string;
  status: ReviewStatus;
  reviewer: string;
  note?: string;
}

export async function recordReview(input: ReviewInput): Promise<ProofRow | null> {
  await ensureSynced();
  const now = new Date();
  const updated = await db
    .update(proofs)
    .set({
      reviewStatus: input.status,
      reviewer: input.reviewer,
      reviewNote: input.note ?? null,
      reviewedAt: now,
      updatedAt: now,
    })
    .where(eq(proofs.id, input.proofId))
    .returning();

  await db.insert(reviewEvents).values({
    proofId: input.proofId,
    action: input.status,
    reviewer: input.reviewer,
    note: input.note ?? null,
    snapshot: { at: now.toISOString() },
  });

  return (updated[0] as unknown as ProofRow) ?? null;
}

export async function listReviewEvents(limit = 60) {
  await ensureSynced();
  return db
    .select({
      id: reviewEvents.id,
      proofId: reviewEvents.proofId,
      action: reviewEvents.action,
      reviewer: reviewEvents.reviewer,
      note: reviewEvents.note,
      createdAt: reviewEvents.createdAt,
      title: proofs.title,
    })
    .from(reviewEvents)
    .leftJoin(proofs, eq(proofs.id, reviewEvents.proofId))
    .orderBy(desc(reviewEvents.createdAt))
    .limit(limit);
}

export interface SearchHit {
  docKey: string;
  kind: string;
  title: string;
  body: string;
  href: string;
  proofId: string | null;
  stepId: string | null;
  rank: number;
}

/** Postgres full-text search with an ILIKE fallback for partial/inflected words. */
export async function searchLibrary(query: string, limit = 30): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length === 0) return [];
  await ensureSynced();

  const vector = sql`to_tsvector('english', ${searchDocuments.title} || ' ' || ${searchDocuments.body})`;
  const tsQuery = sql`plainto_tsquery('english', ${q})`;
  const rank = sql<number>`(ts_rank(${vector}, ${tsQuery}) + case when ${searchDocuments.title} ilike ${`%${q}%`} then 0.4 else 0 end) * ${searchDocuments.weight}`;

  const rows = await db
    .select({
      docKey: searchDocuments.docKey,
      kind: searchDocuments.kind,
      title: searchDocuments.title,
      body: searchDocuments.body,
      href: searchDocuments.href,
      proofId: searchDocuments.proofId,
      stepId: searchDocuments.stepId,
      rank,
    })
    .from(searchDocuments)
    .where(sql`${vector} @@ ${tsQuery} or ${searchDocuments.title} ilike ${`%${q}%`} or ${searchDocuments.body} ilike ${`%${q}%`}`)
    .orderBy(desc(rank))
    .limit(limit);

  return rows.map((row) => ({ ...row, rank: Number(row.rank) }));
}

export interface GraphRow {
  nodes: {
    id: string;
    kind: string;
    title: string;
    statement: string;
    body: string;
    href: string;
    tags: string[];
    difficulty: number | null;
    proofId: string | null;
  }[];
  edges: { fromId: string; toId: string; relation: string }[];
}

export async function graphFromDatabase(): Promise<GraphRow> {
  await ensureSynced();
  const [nodes, edges] = await Promise.all([
    db.select().from(libraryNodes).orderBy(asc(libraryNodes.kind), asc(libraryNodes.id)),
    db.select({ fromId: libraryEdges.fromId, toId: libraryEdges.toId, relation: libraryEdges.relation }).from(libraryEdges),
  ]);
  return { nodes, edges };
}

export async function libraryNodeRow(id: string) {
  await ensureSynced();
  const rows = await db.select().from(libraryNodes).where(eq(libraryNodes.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function relatedEdges(id: string) {
  await ensureSynced();
  const outgoing = await db
    .select()
    .from(libraryEdges)
    .where(eq(libraryEdges.fromId, id));
  const incoming = await db.select().from(libraryEdges).where(eq(libraryEdges.toId, id));
  return { outgoing, incoming };
}

export type ProgressStatus = "not_started" | "in_progress" | "completed";

export async function getPathProgress(pathId: string): Promise<Record<string, ProgressStatus>> {
  await ensureSynced();
  const rows = await db.select().from(pathProgress).where(eq(pathProgress.pathId, pathId));
  const out: Record<string, ProgressStatus> = {};
  for (const row of rows) out[row.proofId] = row.status as ProgressStatus;
  return out;
}

export async function setPathProgress(pathId: string, proofId: string, status: ProgressStatus): Promise<void> {
  await ensureSynced();
  await db
    .insert(pathProgress)
    .values({ pathId, proofId, status, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: [pathProgress.pathId, pathProgress.proofId],
      set: { status, updatedAt: new Date() },
    });
}

export async function dashboardStats() {
  await ensureSynced();
  const [byStatus, nodeKinds, docCount, eventCount] = await Promise.all([
    db.select({ status: proofs.reviewStatus, n: sql<number>`count(*)::int` }).from(proofs).groupBy(proofs.reviewStatus),
    db.select({ kind: libraryNodes.kind, n: sql<number>`count(*)::int` }).from(libraryNodes).groupBy(libraryNodes.kind),
    db.select({ n: sql<number>`count(*)::int` }).from(searchDocuments),
    db.select({ n: sql<number>`count(*)::int` }).from(reviewEvents),
  ]);
  return { byStatus, nodeKinds, docCount: docCount[0]?.n ?? 0, eventCount: eventCount[0]?.n ?? 0 };
}

export const guard = { and };
