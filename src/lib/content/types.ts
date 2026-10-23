/**
 * Content model for the Unfold library.
 *
 * Everything in `content/` is parsed into these shapes by `loader.ts` and checked
 * by `validator.ts`. The types are intentionally strict: a proof step either cites
 * something or is explicitly marked as an axiom/definition, and leaves must be
 * grounded.
 */

export type LibraryKind = "axiom" | "definition" | "lemma";

export interface LibraryNode {
  /** Globally unique id, prefixed by kind: `ax:`, `def:` or `lem:`. */
  id: string;
  kind: LibraryKind;
  title: string;
  statement: string;
  body?: string;
  prerequisites?: string[];
  tags?: string[];
}

export interface RuleNode {
  id: string;
  title: string;
  summary: string;
  /** Ids of axioms/definitions/lemmas that license this rule. */
  groundedIn: string[];
}

/** How a step is licensed. Exactly one of the target fields should be meaningful. */
export interface Justification {
  /** Id of a named inference rule, e.g. `rule:algebra`. */
  rule?: string;
  /** Id of a library node (axiom/definition/lemma) or another proof. */
  ref?: string;
  /** Id of an earlier step inside the same proof. */
  step?: string;
  /** Explicitly declared axiom leaf. */
  axiom?: boolean;
  /** Explicitly declared definition leaf. */
  definition?: boolean;
  /** Free-text label override shown in the reader. */
  label?: string;
  /** Short prose explaining the move. */
  note?: string;
}

export interface Checkpoint {
  id: string;
  question: string;
  options: string[];
  /** Index into `options`. */
  answer: number;
  explanation: string;
  hint?: string;
}

export interface WidgetSpec {
  id: string;
  caption?: string;
  props?: Record<string, unknown>;
}

export interface LeanLink {
  name?: string;
  statement?: string;
  file?: string;
  url?: string;
  status: "verified" | "candidate" | "none";
  note?: string;
}

export interface Step {
  id: string;
  /** Markdown + LaTeX. */
  text: string;
  justification?: Justification;
  /** Leaf is an axiom by fiat (rare; the library normally cites `ax:` nodes). */
  axiom?: boolean;
  /** Leaf is a definition by fiat. */
  definition?: boolean;
  /** Editorial remark rather than a load-bearing inference. */
  aside?: boolean;
  checkpoint?: Checkpoint;
  widget?: WidgetSpec;
  lean?: string;
  children?: Step[];
}

export interface Proof {
  id: string;
  title: string;
  kind: "theorem" | "lemma" | "corollary" | "proposition";
  difficulty: number;
  statement: string;
  summary: string;
  tags?: string[];
  prerequisites?: string[];
  /** Ids of proofs/nodes shown as dashed "see also" edges; excluded from cycle checks. */
  related?: string[];
  lean?: LeanLink;
  attribution?: string;
  /** Minimum depth the validator enforces. Defaults to 3. */
  minDepth?: number;
  steps: Step[];
}

export interface PathStop {
  proof: string;
  why: string;
}

export interface LearningPath {
  id: string;
  title: string;
  blurb: string;
  level: string;
  audience?: string;
  stops: PathStop[];
  requires?: string[];
}

export interface ContentFile {
  file: string;
  hash: string;
  bytes: number;
}

export interface Library {
  nodes: Record<string, LibraryNode>;
  rules: Record<string, RuleNode>;
  proofs: Record<string, Proof>;
  proofOrder: string[];
  paths: LearningPath[];
  files: ContentFile[];
  contentHash: string;
}

/** A node of the dependency graph (library node, rule, or proof). */
export interface GraphNode {
  id: string;
  kind: LibraryKind | "rule" | "proof";
  title: string;
  statement: string;
  href: string;
  tags: string[];
  /** For proofs only. */
  difficulty?: number;
}

export interface GraphEdge {
  from: string;
  to: string;
  relation: "prerequisite" | "justification" | "rule-ground" | "path-requires" | "related";
}

export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
