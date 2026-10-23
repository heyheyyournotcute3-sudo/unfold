/**
 * Content → database sync.
 *
 * The YAML files on disk are the source of truth for the mathematics; Postgres
 * holds what the app needs at request time: review state, the dependency graph,
 * the full-text search corpus, and learner progress.
 *
 * Policy that matters for the acceptance criteria:
 *   - a proof that has never been seen is inserted with reviewStatus = 'pending';
 *   - a human decision is never overwritten by a sync;
 *   - if the *content* of an approved proof changes, its approval is revoked and
 *     the proof goes back to 'pending', with an audit event.
 */
import crypto from "node:crypto";

import { eq, inArray, notInArray, sql } from "drizzle-orm";

import { db } from "@/db";
import { libraryEdges, libraryNodes, pathProgress, proofs, reviewEvents, searchDocuments, syncState } from "@/db/schema";
import { getLibrary } from "@/lib/content/loader";
import { plainText } from "@/lib/content/richtext";
import { flattenSteps, renderProof } from "@/lib/content/serialize";
import type { Proof } from "@/lib/content/types";
import { buildGraph, type ValidationReport } from "@/lib/content/validator";

const SYNC_KEY = "content-hash";

export function proofHash(proof: Proof): string {
  return crypto.createHash("sha256").update(JSON.stringify(proof)).digest("hex").slice(0, 16);
}

let inFlight: Promise<SyncResult> | null = null;

export interface SyncResult {
  changed: boolean;
  contentHash: string;
  proofs: number;
  nodes: number;
  edges: number;
  documents: number;
  revoked: string[];
  validation: { passed: boolean; errors: number; warnings: number };
}

async function performSync(force: boolean): Promise<SyncResult> {
  const { library, report } = getLibrary();

  const existingState = await db.select().from(syncState).where(eq(syncState.key, SYNC_KEY)).limit(1);
  if (!force && existingState[0]?.value === library.contentHash) {
    const nodeCount = await db.select({ n: sql<number>`count(*)::int` }).from(libraryNodes);
    return {
      changed: false,
      contentHash: library.contentHash,
      proofs: library.proofOrder.length,
      nodes: nodeCount[0]?.n ?? 0,
      edges: 0,
      documents: 0,
      revoked: [],
      validation: { passed: report.passed, errors: report.errors.length, warnings: report.warnings.length },
    };
  }

  const existingProofs = await db
    .select({ id: proofs.id, contentHash: proofs.contentHash, reviewStatus: proofs.reviewStatus })
    .from(proofs);
  const existingById = new Map(existingProofs.map((row) => [row.id, row]));
  const revoked: string[] = [];

  const rendered = library.proofOrder.map((id) => {
    const proof = library.proofs[id];
    return { proof, rendered: renderProof(proof, library) };
  });

  const reportByProof = new Map<string, ValidationReport["proofs"][number]>();
  for (const entry of report.proofs) reportByProof.set(entry.proofId, entry);

  const documents: {
    docKey: string;
    kind: string;
    title: string;
    body: string;
    href: string;
    proofId: string | null;
    stepId: string | null;
    weight: number;
  }[] = [];

  const nodeRows: typeof libraryNodes.$inferInsert[] = [];
  const edgeRows: { fromId: string; toId: string; relation: string }[] = [];

  const graph = buildGraph(library);
  for (const node of graph.nodes) {
    const source = library.nodes[node.id];
    nodeRows.push({
      id: node.id,
      kind: node.kind,
      title: plainText(node.title),
      statement: plainText(node.statement),
      body: source?.body ? plainText(source.body) : "",
      href: node.href,
      tags: node.tags,
      difficulty: node.difficulty ?? null,
      proofId: node.kind === "proof" ? node.id : null,
    });
    documents.push({
      docKey: `node:${node.id}`,
      kind: node.kind,
      title: plainText(node.title),
      body: plainText(`${node.statement} ${source?.body ?? ""}`),
      href: node.href,
      proofId: node.kind === "proof" ? node.id : null,
      stepId: null,
      weight: node.kind === "proof" ? 10 : 5,
    });
  }
  for (const edge of graph.edges) {
    edgeRows.push({ fromId: edge.from, toId: edge.to, relation: edge.relation });
  }

  const proofRows: typeof proofs.$inferInsert[] = [];
  for (const { proof, rendered: renderedProof } of rendered) {
    const hash = proofHash(proof);
    const previous = existingById.get(proof.id);
    let reviewStatus: "pending" | "approved" | "changes_requested" = previous?.reviewStatus ?? "pending";
    if (previous && previous.contentHash !== hash && previous.reviewStatus !== "pending") {
      reviewStatus = "pending";
      revoked.push(proof.id);
    }
    const validation = reportByProof.get(proof.id);

    proofRows.push({
      id: proof.id,
      slug: proof.id,
      title: plainText(proof.title),
      kind: proof.kind,
      difficulty: proof.difficulty,
      statement: plainText(proof.statement),
      summary: plainText(proof.summary),
      tags: proof.tags ?? [],
      prerequisites: proof.prerequisites ?? [],
      lean: proof.lean ? (proof.lean as unknown as Record<string, unknown>) : null,
      contentHash: hash,
      maxDepth: renderedProof.maxDepth,
      stepCount: renderedProof.stepCount,
      leafCount: renderedProof.leafCount,
      checkpointCount: renderedProof.checkpointCount,
      grounds: validation?.grounds ?? {},
      validationPassed: validation ? validation.errors.length === 0 : true,
      validationIssues: validation ? [...validation.errors, ...validation.warnings] : [],
      reviewStatus,
      reviewer: previous && previous.contentHash === hash ? undefined : null,
      reviewNote: previous && previous.contentHash === hash ? undefined : null,
      reviewedAt: previous && previous.contentHash === hash ? undefined : null,
      updatedAt: new Date(),
    });

    documents.push({
      docKey: `proof:${proof.id}`,
      kind: "proof",
      title: plainText(proof.title),
      body: plainText(`${proof.statement} ${proof.summary} ${(proof.tags ?? []).join(" ")}`),
      href: `/proofs/${encodeURIComponent(proof.id)}`,
      proofId: proof.id,
      stepId: null,
      weight: 10,
    });

    for (const step of flattenSteps(renderedProof.steps)) {
      documents.push({
        docKey: `step:${proof.id}:${step.id}`,
        kind: "step",
        title: `${plainText(proof.title)} — step ${step.id.replace(/^s/, "")}`,
        body: step.plain.slice(0, 1200),
        href: `/proofs/${encodeURIComponent(proof.id)}#step-${step.id}`,
        proofId: proof.id,
        stepId: step.id,
        weight: step.depth <= 2 ? 3 : 1,
      });
    }
  }

  for (const learningPath of library.paths) {
    documents.push({
      docKey: `path:${learningPath.id}`,
      kind: "path",
      title: learningPath.title,
      body: plainText(`${learningPath.blurb} ${learningPath.level}`),
      href: `/paths/${encodeURIComponent(learningPath.id)}`,
      proofId: null,
      stepId: null,
      weight: 6,
    });
  }

  const liveIds = library.proofOrder;
  const staleIds = existingProofs.map((row) => row.id).filter((id) => !liveIds.includes(id));

  await db.transaction(async (tx) => {
    if (staleIds.length > 0) {
      await tx.delete(proofs).where(inArray(proofs.id, staleIds));
      await tx.delete(pathProgress).where(notInArray(pathProgress.proofId, liveIds));
    }

    for (const row of proofRows) {
      const { id, ...rest } = row;
      await tx
        .insert(proofs)
        .values({ id, ...rest })
        .onConflictDoUpdate({
          target: proofs.id,
          set: { ...rest },
        });
    }

    for (const proofId of revoked) {
      await tx.insert(reviewEvents).values({
        proofId,
        action: "content_changed",
        reviewer: "build",
        note: "Content changed after review; approval revoked and status reset to pending.",
      });
    }

    await tx.delete(libraryEdges);
    await tx.delete(libraryNodes);
    if (nodeRows.length > 0) await tx.insert(libraryNodes).values(nodeRows);

    const uniqueEdges: typeof edgeRows = [];
    const seen = new Set<string>();
    for (const edge of edgeRows) {
      const key = `${edge.fromId}|${edge.toId}|${edge.relation}`;
      if (seen.has(key)) continue;
      seen.add(key);
      uniqueEdges.push(edge);
    }
    if (uniqueEdges.length > 0) {
      await tx.insert(libraryEdges).values(uniqueEdges).onConflictDoNothing();
    }

    await tx.delete(searchDocuments);
    const uniqueDocs: typeof documents = [];
    const seenDocs = new Set<string>();
    for (const doc of documents) {
      if (seenDocs.has(doc.docKey)) continue;
      seenDocs.add(doc.docKey);
      uniqueDocs.push(doc);
    }
    if (uniqueDocs.length > 0) await tx.insert(searchDocuments).values(uniqueDocs);

    await tx
      .insert(syncState)
      .values({ key: SYNC_KEY, value: library.contentHash, updatedAt: new Date() })
      .onConflictDoUpdate({ target: syncState.key, set: { value: library.contentHash, updatedAt: new Date() } });
  });

  return {
    changed: true,
    contentHash: library.contentHash,
    proofs: proofRows.length,
    nodes: nodeRows.length,
    edges: edgeRows.length,
    documents: documents.length,
    revoked,
    validation: { passed: report.passed, errors: report.errors.length, warnings: report.warnings.length },
  };
}

/** Sync if the on-disk content hash differs from what the database last saw. */
export async function ensureSynced(force = false): Promise<SyncResult> {
  if (inFlight) return inFlight;
  inFlight = performSync(force).finally(() => {
    inFlight = null;
  });
  return inFlight;
}


