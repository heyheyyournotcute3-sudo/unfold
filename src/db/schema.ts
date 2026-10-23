import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/**
 * One row per authored proof.
 *
 * `reviewStatus` is the human gate required before a proof is considered live.
 * Content is authoritative on disk; this table caches the rendered metadata and
 * holds the review decision, which is never overwritten by a content sync unless
 * the content itself changed (in which case approval is revoked).
 */
export const proofs = pgTable(
  "proofs",
  {
    id: text("id").primaryKey(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("theorem"),
    difficulty: integer("difficulty").notNull().default(3),
    statement: text("statement").notNull().default(""),
    summary: text("summary").notNull().default(""),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    prerequisites: jsonb("prerequisites").$type<string[]>().notNull().default([]),
    lean: jsonb("lean").$type<Record<string, unknown> | null>(),
    contentHash: text("content_hash").notNull(),
    maxDepth: integer("max_depth").notNull().default(1),
    stepCount: integer("step_count").notNull().default(0),
    leafCount: integer("leaf_count").notNull().default(0),
    checkpointCount: integer("checkpoint_count").notNull().default(0),
    widgetCount: integer("widget_count").notNull().default(0),
    grounds: jsonb("grounds").$type<Record<string, number>>().notNull().default({}),
    validationPassed: boolean("validation_passed").notNull().default(true),
    validationIssues: jsonb("validation_issues").$type<unknown[]>().notNull().default([]),
    reviewStatus: text("review_status", {
      enum: ["pending", "approved", "changes_requested"],
    })
      .notNull()
      .default("pending"),
    reviewer: text("reviewer"),
    reviewNote: text("review_note"),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("proofs_review_status_idx").on(table.reviewStatus),
    index("proofs_difficulty_idx").on(table.difficulty),
  ],
);

/** Append-only audit trail of every human action on a proof. */
export const reviewEvents = pgTable(
  "review_events",
  {
    id: serial("id").primaryKey(),
    proofId: text("proof_id")
      .notNull()
      .references(() => proofs.id, { onDelete: "cascade" }),
    action: text("action").notNull(),
    reviewer: text("reviewer").notNull().default("reviewer"),
    note: text("note"),
    snapshot: jsonb("snapshot").$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("review_events_proof_idx").on(table.proofId)],
);

/** Every node of the dependency graph: axioms, definitions, lemmas, rules, proofs. */
export const libraryNodes = pgTable(
  "library_nodes",
  {
    id: text("id").primaryKey(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    statement: text("statement").notNull().default(""),
    body: text("body").notNull().default(""),
    href: text("href").notNull(),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    difficulty: integer("difficulty"),
    proofId: text("proof_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("library_nodes_kind_idx").on(table.kind)],
);

export const libraryEdges = pgTable(
  "library_edges",
  {
    id: serial("id").primaryKey(),
    fromId: text("from_id").notNull(),
    toId: text("to_id").notNull(),
    relation: text("relation").notNull(),
  },
  (table) => [
    uniqueIndex("library_edges_unique_idx").on(table.fromId, table.toId, table.relation),
    index("library_edges_to_idx").on(table.toId),
  ],
);

/** Full-text search corpus, one row per searchable document. */
export const searchDocuments = pgTable(
  "search_documents",
  {
    id: serial("id").primaryKey(),
    docKey: text("doc_key").notNull(),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    href: text("href").notNull(),
    proofId: text("proof_id"),
    stepId: text("step_id"),
    weight: integer("weight").notNull().default(1),
  },
  (table) => [
    uniqueIndex("search_documents_key_idx").on(table.docKey),
    index("search_documents_kind_idx").on(table.kind),
  ],
);

/** Learner progress through a curated learning path. */
export const pathProgress = pgTable(
  "path_progress",
  {
    id: serial("id").primaryKey(),
    pathId: text("path_id").notNull(),
    proofId: text("proof_id").notNull(),
    status: text("status", { enum: ["not_started", "in_progress", "completed"] })
      .notNull()
      .default("not_started"),
    note: text("note"),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("path_progress_unique_idx").on(table.pathId, table.proofId)],
);

/** Key/value bookkeeping; currently holds the content hash of the last sync. */
export const syncState = pgTable("sync_state", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
