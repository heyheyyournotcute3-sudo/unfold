/**
 * Build-time content loader.
 *
 * Reads every YAML file under `content/` and produces the in-memory `Library`.
 * Validation runs on every load: in production this happens during static
 * generation, so a broken reference or a dependency cycle fails the build.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { load as loadYaml } from "js-yaml";

import type {
  ContentFile,
  LearningPath,
  Library,
  LibraryNode,
  Proof,
  RuleNode,
} from "./types";
import { validateLibrary, type ValidationReport } from "./validator";

const CONTENT_DIR = path.join(process.cwd(), "content");

function listFiles(dir: string, ext: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(ext))
    .map((entry) => path.join(dir, entry.name))
    .sort();
}

function readYamlFile(file: string): unknown {
  const raw = fs.readFileSync(file, "utf8");
  if (!raw.trim()) return null;
  return loadYaml(raw);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function normaliseProof(raw: Record<string, unknown>, file: string): Proof {
  const id = String(raw.id ?? "");
  if (!id) throw new Error(`Proof in ${file} is missing an id`);
  const steps = Array.isArray(raw.steps) ? (raw.steps as Proof["steps"]) : [];
  const difficultyRaw = Number(raw.difficulty ?? 3);
  const leanRaw = asRecord(raw.lean);
  return {
    id,
    title: String(raw.title ?? id),
    kind: (String(raw.kind ?? "theorem") as Proof["kind"]) ?? "theorem",
    difficulty: Number.isFinite(difficultyRaw) ? difficultyRaw : 3,
    statement: String(raw.statement ?? ""),
    summary: String(raw.summary ?? ""),
    tags: asStringArray(raw.tags),
    prerequisites: asStringArray(raw.prerequisites),
    related: asStringArray(raw.related),
    attribution: raw.attribution ? String(raw.attribution) : undefined,
    minDepth: raw.minDepth === undefined ? undefined : Number(raw.minDepth),
    lean: raw.lean
      ? {
          name: leanRaw.name ? String(leanRaw.name) : undefined,
          statement: leanRaw.statement ? String(leanRaw.statement) : undefined,
          file: leanRaw.file ? String(leanRaw.file) : undefined,
          url: leanRaw.url ? String(leanRaw.url) : undefined,
          status: (String(leanRaw.status ?? "candidate") as "verified" | "candidate" | "none") ?? "candidate",
          note: leanRaw.note ? String(leanRaw.note) : undefined,
        }
      : undefined,
    steps,
  };
}

function normaliseNode(raw: Record<string, unknown>): LibraryNode {
  const id = String(raw.id ?? "");
  return {
    id,
    kind: (String(raw.kind ?? "definition") as LibraryNode["kind"]) ?? "definition",
    title: String(raw.title ?? id),
    statement: String(raw.statement ?? ""),
    body: raw.body ? String(raw.body) : undefined,
    prerequisites: asStringArray(raw.prerequisites),
    tags: asStringArray(raw.tags),
  };
}

function normaliseRule(raw: Record<string, unknown>): RuleNode {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? String(raw.id ?? "")),
    summary: String(raw.summary ?? ""),
    groundedIn: asStringArray(raw.groundedIn),
  };
}

function normalisePath(raw: Record<string, unknown>): LearningPath {
  const stops = Array.isArray(raw.stops) ? (raw.stops as Record<string, unknown>[]) : [];
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? String(raw.id ?? "")),
    blurb: String(raw.blurb ?? ""),
    level: String(raw.level ?? "Any"),
    audience: raw.audience ? String(raw.audience) : undefined,
    requires: asStringArray(raw.requires),
    stops: stops.map((stop) => ({ proof: String(stop.proof ?? ""), why: String(stop.why ?? "") })),
  };
}

function loadFromDisk(): { library: Library; report: ValidationReport } {
  const files: ContentFile[] = [];
  const hashParts: string[] = [];

  const libraryFiles = listFiles(path.join(CONTENT_DIR, "library"), ".yaml");
  const proofFiles = listFiles(path.join(CONTENT_DIR, "proofs"), ".yaml");
  const pathFiles = listFiles(path.join(CONTENT_DIR, "paths"), ".yaml");

  const nodes: Record<string, LibraryNode> = {};
  const rules: Record<string, RuleNode> = {};
  const proofs: Record<string, Proof> = {};
  const proofOrder: string[] = [];
  const paths: LearningPath[] = [];

  for (const file of [...libraryFiles, ...proofFiles, ...pathFiles]) {
    const raw = fs.readFileSync(file, "utf8");
    const digest = crypto.createHash("sha256").update(raw).digest("hex").slice(0, 16);
    files.push({ file: path.relative(process.cwd(), file), hash: digest, bytes: raw.length });
    hashParts.push(`${path.relative(process.cwd(), file)}:${digest}`);
  }

  for (const file of libraryFiles) {
    const doc = asRecord(readYamlFile(file));
    const nodeList = Array.isArray(doc.nodes) ? (doc.nodes as Record<string, unknown>[]) : [];
    for (const entry of nodeList) {
      const node = normaliseNode(asRecord(entry));
      if (!node.id) throw new Error(`Library node in ${file} is missing an id`);
      nodes[node.id] = node;
    }
    const ruleList = Array.isArray(doc.rules) ? (doc.rules as Record<string, unknown>[]) : [];
    for (const entry of ruleList) {
      const rule = normaliseRule(asRecord(entry));
      if (!rule.id) throw new Error(`Rule in ${file} is missing an id`);
      rules[rule.id] = rule;
    }
  }

  for (const file of proofFiles) {
    const proof = normaliseProof(asRecord(readYamlFile(file)), file);
    proofs[proof.id] = proof;
    proofOrder.push(proof.id);
  }

  for (const file of pathFiles) {
    const doc = asRecord(readYamlFile(file));
    const list = Array.isArray(doc.paths) ? (doc.paths as Record<string, unknown>[]) : [];
    for (const entry of list) paths.push(normalisePath(asRecord(entry)));
  }

  const library: Library = {
    nodes,
    rules,
    proofs,
    proofOrder,
    paths,
    files,
    contentHash: crypto.createHash("sha256").update(hashParts.join("|")).digest("hex").slice(0, 24),
  };

  const report = validateLibrary(library);
  return { library, report };
}

interface Cache {
  hash: string;
  library: Library;
  report: ValidationReport;
}

const globalForContent = globalThis as typeof globalThis & { __unfoldContent?: Cache };

function currentDiskFingerprint(): string {
  const files = [
    ...listFiles(path.join(CONTENT_DIR, "library"), ".yaml"),
    ...listFiles(path.join(CONTENT_DIR, "proofs"), ".yaml"),
    ...listFiles(path.join(CONTENT_DIR, "paths"), ".yaml"),
  ];
  const parts = files.map((f) => {
    const stat = fs.statSync(f);
    return `${f}:${stat.size}:${stat.mtimeMs.toFixed(0)}`;
  });
  return crypto.createHash("sha256").update(parts.join("|")).digest("hex");
}

/**
 * Load and validate the library. Throws on validation errors so that a broken
 * proof file cannot be published by a successful build.
 */
export function getLibrary(): { library: Library; report: ValidationReport } {
  const fingerprint = currentDiskFingerprint();
  const cached = globalForContent.__unfoldContent;
  if (cached && cached.hash === fingerprint) {
    return { library: cached.library, report: cached.report };
  }

  const { library, report } = loadFromDisk();

  if (report.errors.length > 0) {
    const detail = report.errors
      .slice(0, 25)
      .map((issue) => `  - [${issue.code}] ${issue.where}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Unfold content validation failed with ${report.errors.length} error(s):\n${detail}\n` +
        `Run the validator for the full report.`,
    );
  }

  globalForContent.__unfoldContent = { hash: fingerprint, library, report };
  return { library, report };
}

/**
 * Same as `getLibrary()` but does not throw on validation errors — used by the
 * review console and the JSON report so a broken content tree can still be
 * inspected rather than only reported as a build failure.
 */
export function getLibraryUnchecked(): { library: Library; report: ValidationReport } {
  const fingerprint = currentDiskFingerprint();
  const cached = globalForContent.__unfoldContent;
  if (cached && cached.hash === fingerprint) {
    return { library: cached.library, report: cached.report };
  }
  return loadFromDisk();
}

export function getProof(id: string): Proof | undefined {
  return getLibrary().library.proofs[id];
}

export function allProofs(): Proof[] {
  const { library } = getLibrary();
  return library.proofOrder.map((id) => library.proofs[id]).filter(Boolean);
}
