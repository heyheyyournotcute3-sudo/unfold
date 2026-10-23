/**
 * Build-time content validator.
 *
 * Checks, for the whole library:
 *   1. every id is unique and every reference resolves (definition, lemma, axiom,
 *      rule, other proof, or an earlier step of the same proof);
 *   2. the hard dependency graph (prerequisites, justification refs, rule grounds,
 *      path requirements) is acyclic;
 *   3. every leaf step is *grounded*: it cites a rule, an axiom, a definition, a
 *      lemma whose own prerequisites are grounded, or an earlier grounded step;
 *   4. step references point backwards, never forwards;
 *   5. every proof reaches at least `minDepth` (default 3) levels of unfolding;
 *   6. widgets and checkpoints are well formed;
 *   7. every LaTeX span actually compiles.
 */
import katex from "katex";

import type {
  DependencyGraph,
  GraphEdge,
  GraphNode,
  Justification,
  Library,
  LibraryNode,
  Proof,
  Step,
} from "./types";
import { WIDGETS } from "./widget-registry";

export interface ValidationIssue {
  level: "error" | "warning";
  code: string;
  where: string;
  message: string;
}

export interface StepStats {
  total: number;
  leaves: number;
  groundedLeaves: number;
  maxDepth: number;
  checkpoints: number;
  widgets: number;
}

export interface ProofReport {
  proofId: string;
  title: string;
  passed: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  stats: StepStats;
  /** Which kinds of ground the leaves rest on. */
  grounds: { axioms: number; definitions: number; lemmas: number; rules: number; steps: number };
}

export interface ValidationReport {
  generatedAt: string;
  passed: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  proofs: ProofReport[];
  cycles: string[][];
  counts: {
    axioms: number;
    definitions: number;
    lemmas: number;
    rules: number;
    proofs: number;
    paths: number;
    edges: number;
    steps: number;
  };
}

interface Resolved {
  ok: boolean;
  kind?: "node" | "rule" | "proof";
  id?: string;
  node?: LibraryNode;
  reason?: string;
}

function isLeaf(step: Step): boolean {
  return !step.children || step.children.length === 0;
}

function walkSteps(steps: Step[], visit: (step: Step, depth: number, parent: Step | null) => void, depth = 1, parent: Step | null = null): void {
  for (const step of steps) {
    visit(step, depth, parent);
    if (step.children?.length) walkSteps(step.children, visit, depth + 1, step);
  }
}

/** Compile every LaTeX span in a source string; return the list of failures. */
function checkLatex(src: string, where: string, errors: ValidationIssue[]): void {
  const spans: { tex: string; display: boolean }[] = [];
  const push = (tex: string, display: boolean) => spans.push({ tex, display });

  const displayBlock = /\$\$([\s\S]*?)\$\$/g;
  let working = src;
  let m: RegExpExecArray | null;
  while ((m = displayBlock.exec(src)) !== null) push(m[1], true);
  working = src.replace(displayBlock, " ");

  const inlineDollar = /\$([^$\n]+)\$/g;
  while ((m = inlineDollar.exec(working)) !== null) push(m[1], false);
  working = working.replace(inlineDollar, " ");

  const brackets = /\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g;
  while ((m = brackets.exec(working)) !== null) push(m[1] ?? m[2] ?? "", true);

  for (const span of spans) {
    try {
      katex.renderToString(span.tex.trim(), { throwOnError: true, strict: "ignore", output: "html" });
    } catch (error) {
      errors.push({
        level: "error",
        code: "latex-failed",
        where,
        message: `LaTeX does not compile: ${span.tex.slice(0, 80)} — ${error instanceof Error ? error.message : String(error)}`,
      });
    }
  }
}

export function validateLibrary(library: Library): ValidationReport {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const edges: GraphEdge[] = [];

  const allNodeIds = new Set(Object.keys(library.nodes));
  const allRuleIds = new Set(Object.keys(library.rules));
  const allProofIds = new Set(Object.keys(library.proofs));

  const resolve = (raw: string): Resolved => {
    if (!raw) return { ok: false, reason: "empty reference" };
    if (library.nodes[raw]) return { ok: true, kind: "node", node: library.nodes[raw] };
    if (library.rules[raw]) return { ok: true, kind: "rule", id: raw };
    if (library.proofs[raw]) return { ok: true, kind: "proof", id: raw };
    return { ok: false, reason: `no definition, lemma, axiom, rule or proof with id "${raw}"` };
  };

  // ---------------------------------------------------------------- id hygiene
  for (const node of Object.values(library.nodes)) {
    if (!/^(ax|def|lem):/.test(node.id)) {
      errors.push({ level: "error", code: "bad-id", where: node.id, message: `Library node ids must start with ax:, def: or lem: (got "${node.id}")` });
    }
    if (!node.statement.trim()) {
      errors.push({ level: "error", code: "empty-statement", where: node.id, message: "Node has an empty statement" });
    }
    checkLatex(`${node.title} ${node.statement} ${node.body ?? ""}`, node.id, errors);
  }
  for (const rule of Object.values(library.rules)) {
    if (!rule.id.startsWith("rule:")) {
      errors.push({ level: "error", code: "bad-id", where: rule.id, message: 'Rule ids must start with "rule:"' });
    }
    if (rule.groundedIn.length === 0) {
      errors.push({ level: "error", code: "ungrounded-rule", where: rule.id, message: "Rule does not declare what it is grounded in" });
    }
    for (const target of rule.groundedIn) {
      const resolved = resolve(target);
      if (!resolved.ok) {
        errors.push({ level: "error", code: "dangling-reference", where: rule.id, message: `groundedIn: ${resolved.reason}` });
      } else {
        edges.push({ from: rule.id, to: target, relation: "rule-ground" });
      }
    }
  }

  // --------------------------------------------------- node prerequisites
  const nodeGroundedMemo = new Map<string, boolean>();
  const nodeGroundStack = new Set<string>();

  const isNodeGrounded = (id: string): boolean => {
    const cached = nodeGroundedMemo.get(id);
    if (cached !== undefined) return cached;
    if (nodeGroundStack.has(id)) return false; // cycle: handled by the cycle checker
    const resolved = resolve(id);
    if (!resolved.ok) return false;
    if (resolved.kind === "rule") {
      nodeGroundStack.add(id);
      const rule = library.rules[id];
      const ok = rule.groundedIn.length > 0 && rule.groundedIn.every(isNodeGrounded);
      nodeGroundStack.delete(id);
      nodeGroundedMemo.set(id, ok);
      return ok;
    }
    if (resolved.kind === "proof") {
      // A cross-proof citation is grounded when that proof's leaves are grounded;
      // computed after all proofs have been walked, via proofGroundedMemo below.
      return proofGroundedMemo.get(id) ?? false;
    }
    const node = resolved.node;
    if (!node) return false;
    if (node.kind === "axiom" || node.kind === "definition") {
      nodeGroundedMemo.set(id, true);
      return true;
    }
    nodeGroundStack.add(id);
    const prereqs = node.prerequisites ?? [];
    const ok = prereqs.length > 0 && prereqs.every(isNodeGrounded);
    nodeGroundStack.delete(id);
    nodeGroundedMemo.set(id, ok);
    if (!ok) {
      errors.push({
        level: "error",
        code: "ungrounded-lemma",
        where: id,
        message: prereqs.length === 0 ? "Lemma declares no prerequisites, so it cannot be grounded" : "Lemma has a prerequisite that does not resolve or is not itself grounded",
      });
    }
    return ok;
  };

  for (const node of Object.values(library.nodes)) {
    for (const target of node.prerequisites ?? []) {
      const resolved = resolve(target);
      if (!resolved.ok) {
        errors.push({ level: "error", code: "dangling-reference", where: node.id, message: `prerequisite: ${resolved.reason}` });
      } else {
        edges.push({ from: node.id, to: target, relation: "prerequisite" });
      }
    }
  }

  // ------------------------------------------------------------- proof checks
  const proofGroundedMemo = new Map<string, boolean>();
  const proofReports: ProofReport[] = [];
  let totalSteps = 0;

  for (const proofId of library.proofOrder) {
    const proof = library.proofs[proofId];
    const localErrors: ValidationIssue[] = [];
    const localWarnings: ValidationIssue[] = [];
    const stats: StepStats = { total: 0, leaves: 0, groundedLeaves: 0, maxDepth: 0, checkpoints: 0, widgets: 0 };
    const grounds = { axioms: 0, definitions: 0, lemmas: 0, rules: 0, steps: 0 };

    if (!proof.statement.trim()) {
      localErrors.push({ level: "error", code: "empty-statement", where: proofId, message: "Proof has no statement" });
    }
    if (!proof.summary.trim()) {
      localWarnings.push({ level: "warning", code: "missing-summary", where: proofId, message: "Proof has no summary; the library page will be sparse" });
    }
    if (!Number.isFinite(proof.difficulty) || proof.difficulty < 1 || proof.difficulty > 5) {
      localErrors.push({ level: "error", code: "bad-difficulty", where: proofId, message: `Difficulty must be an integer 1–5 (got ${String(proof.difficulty)})` });
    }
    if (proof.steps.length === 0) {
      localErrors.push({ level: "error", code: "no-steps", where: proofId, message: "Proof has no steps" });
    }
    checkLatex(`${proof.title} ${proof.statement} ${proof.summary}`, proofId, localErrors);

    for (const target of proof.prerequisites ?? []) {
      const resolved = resolve(target);
      if (!resolved.ok) {
        localErrors.push({ level: "error", code: "dangling-reference", where: proofId, message: `prerequisite: ${resolved.reason}` });
      } else {
        edges.push({ from: proofId, to: target, relation: "prerequisite" });
      }
    }
    for (const target of proof.related ?? []) {
      const resolved = resolve(target);
      if (!resolved.ok) {
        localErrors.push({ level: "error", code: "dangling-reference", where: proofId, message: `related: ${resolved.reason}` });
      } else {
        edges.push({ from: proofId, to: target, relation: "related" });
      }
    }

    // step id uniqueness + document order
    const order = new Map<string, number>();
    const seenIds = new Set<string>();
    let counter = 0;
    walkSteps(proof.steps, (step) => {
      counter += 1;
      order.set(step.id, counter);
      if (seenIds.has(step.id)) {
        localErrors.push({ level: "error", code: "duplicate-step-id", where: `${proofId}/${step.id}`, message: "Step id is used more than once in this proof" });
      }
      seenIds.add(step.id);
    });

    const stepGroundedMemo = new Map<string, boolean>();
    const stepStack = new Set<string>();
    const stepById = new Map<string, Step>();
    walkSteps(proof.steps, (step) => stepById.set(step.id, step));

    const groundedJustification = (justification: Justification | undefined, stepId: string): { grounded: boolean; kinds: string[] } => {
      if (!justification) return { grounded: false, kinds: [] };
      const kinds: string[] = [];
      let grounded = false;

      const consider = (raw: string | undefined, relation: GraphEdge["relation"], isStep: boolean) => {
        if (!raw) return;
        if (isStep) {
          const target = stepById.get(raw);
          if (!target) {
            localErrors.push({ level: "error", code: "dangling-step-reference", where: `${proofId}/${stepId}`, message: `justification cites step "${raw}" which does not exist in this proof` });
            return;
          }
          const here = order.get(stepId) ?? 0;
          const there = order.get(raw) ?? 0;
          if (there >= here) {
            localErrors.push({ level: "error", code: "forward-step-reference", where: `${proofId}/${stepId}`, message: `justification cites step "${raw}" which does not come earlier in the proof` });
          }
          kinds.push("step");
          if (isStepGrounded(raw)) grounded = true;
          return;
        }
        const resolved = resolve(raw);
        if (!resolved.ok) {
          localErrors.push({ level: "error", code: "dangling-reference", where: `${proofId}/${stepId}`, message: `justification: ${resolved.reason}` });
          return;
        }
        edges.push({ from: proofId, to: raw, relation });
        const targetId = resolved.id ?? raw;
        if (resolved.kind === "node") {
          kinds.push(resolved.node?.kind ?? "definition");
          if (isNodeGrounded(targetId)) grounded = true;
        } else if (resolved.kind === "rule") {
          kinds.push("rule");
          if (isNodeGrounded(targetId)) grounded = true;
        } else {
          kinds.push("proof");
          if (proofGroundedMemo.get(targetId) ?? false) grounded = true;
        }
      };

      consider(justification.ref, "justification", false);
      consider(justification.step, "justification", true);
      consider(justification.rule, "justification", false);
      return { grounded, kinds };
    };

    const isStepGrounded = (stepId: string): boolean => {
      const cached = stepGroundedMemo.get(stepId);
      if (cached !== undefined) return cached;
      if (stepStack.has(stepId)) return false;
      const step = stepById.get(stepId);
      if (!step) return false;
      stepStack.add(stepId);
      let ok = Boolean(step.axiom || step.definition);
      if (!ok) ok = groundedJustification(step.justification, stepId).grounded;
      stepStack.delete(stepId);
      stepGroundedMemo.set(stepId, ok);
      return ok;
    };

    walkSteps(proof.steps, (step, depth) => {
      stats.total += 1;
      stats.maxDepth = Math.max(stats.maxDepth, depth);
      if (!step.id) {
        localErrors.push({ level: "error", code: "missing-step-id", where: proofId, message: "A step is missing its id" });
      }
      if (!step.text || !step.text.trim()) {
        localErrors.push({ level: "error", code: "empty-step", where: `${proofId}/${step.id}`, message: "Step has no text" });
      }
      checkLatex(step.text, `${proofId}/${step.id}`, localErrors);

      if (step.widget) {
        stats.widgets += 1;
        if (!WIDGETS[step.widget.id]) {
          localErrors.push({ level: "error", code: "unknown-widget", where: `${proofId}/${step.id}`, message: `Widget "${step.widget.id}" is not in the registry (src/lib/content/widget-registry.ts)` });
        }
      }

      if (step.checkpoint) {
        stats.checkpoints += 1;
        const cp = step.checkpoint;
        if (!cp.id) localErrors.push({ level: "error", code: "checkpoint-id", where: `${proofId}/${step.id}`, message: "Checkpoint is missing an id" });
        if (!cp.options || cp.options.length < 2) {
          localErrors.push({ level: "error", code: "checkpoint-options", where: `${proofId}/${step.id}`, message: "Checkpoint needs at least two options" });
        }
        if (!Number.isInteger(cp.answer) || cp.answer < 0 || cp.answer >= (cp.options?.length ?? 0)) {
          localErrors.push({ level: "error", code: "checkpoint-answer", where: `${proofId}/${step.id}`, message: "Checkpoint answer index is out of range" });
        }
        if (!cp.explanation?.trim()) {
          localWarnings.push({ level: "warning", code: "checkpoint-explanation", where: `${proofId}/${step.id}`, message: "Checkpoint has no explanation; revealing the answer will feel abrupt" });
        }
        checkLatex(`${cp.question} ${(cp.options ?? []).join(" ")} ${cp.explanation}`, `${proofId}/${step.id}/checkpoint`, localErrors);
      }

      const leaf = isLeaf(step);
      if (leaf) {
        stats.leaves += 1;
        const hasMarker = Boolean(step.axiom || step.definition);
        if (!step.justification && !hasMarker) {
          localErrors.push({
            level: "error",
            code: "unjustified-leaf",
            where: `${proofId}/${step.id}`,
            message: "Leaf step has no justification and is not marked as an axiom or definition",
          });
        } else {
          const result = groundedJustification(step.justification, step.id);
          const ok = hasMarker || result.grounded;
          if (ok) {
            stats.groundedLeaves += 1;
            if (hasMarker && step.axiom) grounds.axioms += 1;
            else if (hasMarker && step.definition) grounds.definitions += 1;
            else {
              const kinds = result.kinds;
              if (kinds.includes("axiom")) grounds.axioms += 1;
              else if (kinds.includes("definition")) grounds.definitions += 1;
              else if (kinds.includes("lemma")) grounds.lemmas += 1;
              else if (kinds.includes("rule")) grounds.rules += 1;
              else if (kinds.includes("step")) grounds.steps += 1;
            }
          }
          if (!ok) {
            localErrors.push({
              level: "error",
              code: "ungrounded-leaf",
              where: `${proofId}/${step.id}`,
              message: `Leaf step cites ${result.kinds.join(" + ") || "nothing"}, which does not bottom out in a definition or axiom`,
            });
          }
        }
      } else if (!step.justification) {
        localWarnings.push({
          level: "warning",
          code: "unjustified-branch",
          where: `${proofId}/${step.id}`,
          message: "Branch step has no justification of its own; its children carry the detail",
        });
      } else {
        groundedJustification(step.justification, step.id);
      }
    });

    const minDepth = proof.minDepth ?? 3;
    if (stats.maxDepth < minDepth) {
      localErrors.push({
        level: "error",
        code: "insufficient-depth",
        where: proofId,
        message: `Proof only unfolds to depth ${stats.maxDepth}; the library requires at least ${minDepth}`,
      });
    }
    if (stats.groundedLeaves !== stats.leaves) {
      localErrors.push({
        level: "error",
        code: "ungrounded-leaves",
        where: proofId,
        message: `${stats.leaves - stats.groundedLeaves} of ${stats.leaves} leaf steps are not grounded in definitions or axioms`,
      });
    }

    proofGroundedMemo.set(proofId, localErrors.length === 0 && stats.groundedLeaves === stats.leaves && stats.leaves > 0);
    totalSteps += stats.total;

    proofReports.push({
      proofId,
      title: proof.title,
      passed: localErrors.length === 0,
      errors: localErrors,
      warnings: localWarnings,
      stats,
      grounds,
    });
    errors.push(...localErrors);
    warnings.push(...localWarnings);
  }

  // --------------------------------------------------------------- path checks
  for (const learningPath of library.paths) {
    if (!learningPath.id) {
      errors.push({ level: "error", code: "path-id", where: "paths", message: "A learning path is missing its id" });
    }
    if (learningPath.stops.length === 0) {
      errors.push({ level: "error", code: "path-empty", where: learningPath.id, message: "Learning path has no stops" });
    }
    const seen = new Set<string>();
    for (const stop of learningPath.stops) {
      if (!allProofIds.has(stop.proof)) {
        errors.push({ level: "error", code: "dangling-path-stop", where: learningPath.id, message: `Stop "${stop.proof}" is not a proof in the library` });
      }
      if (seen.has(stop.proof)) {
        warnings.push({ level: "warning", code: "duplicate-path-stop", where: learningPath.id, message: `Proof "${stop.proof}" appears twice in this path` });
      }
      seen.add(stop.proof);
      if (!stop.why.trim()) {
        warnings.push({ level: "warning", code: "path-stop-why", where: `${learningPath.id}/${stop.proof}`, message: "Stop does not say why it belongs in this path" });
      }
    }
    for (const target of learningPath.requires ?? []) {
      const resolved = resolve(target);
      if (!resolved.ok) {
        errors.push({ level: "error", code: "dangling-reference", where: learningPath.id, message: `requires: ${resolved.reason}` });
      } else {
        edges.push({ from: `path:${learningPath.id}`, to: target, relation: "path-requires" });
      }
    }
  }

  // --------------------------------------------------------- cycle detection
  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    if (edge.relation === "related") continue;
    const list = adjacency.get(edge.from) ?? [];
    list.push(edge.to);
    adjacency.set(edge.from, list);
  }
  const cycles: string[][] = [];
  const color = new Map<string, 0 | 1 | 2>();
  const stack: string[] = [];

  const visit = (node: string): void => {
    const state = color.get(node) ?? 0;
    if (state === 2) return;
    if (state === 1) {
      const start = stack.indexOf(node);
      const cycle = [...stack.slice(start === -1 ? 0 : start), node];
      const key = [...cycle].sort().join("|");
      if (!cycles.some((c) => [...c].sort().join("|") === key)) cycles.push(cycle);
      return;
    }
    color.set(node, 1);
    stack.push(node);
    for (const next of adjacency.get(node) ?? []) visit(next);
    stack.pop();
    color.set(node, 2);
  };

  for (const node of [...adjacency.keys(), ...allNodeIds, ...allRuleIds, ...allProofIds]) visit(node);

  for (const cycle of cycles) {
    errors.push({
      level: "error",
      code: "dependency-cycle",
      where: cycle.join(" → "),
      message: "The dependency graph contains a cycle, so no step in it can be grounded",
    });
  }

  const counts = {
    axioms: Object.values(library.nodes).filter((n) => n.kind === "axiom").length,
    definitions: Object.values(library.nodes).filter((n) => n.kind === "definition").length,
    lemmas: Object.values(library.nodes).filter((n) => n.kind === "lemma").length,
    rules: allRuleIds.size,
    proofs: allProofIds.size,
    paths: library.paths.length,
    edges: edges.length,
    steps: totalSteps,
  };

  return {
    generatedAt: new Date().toISOString(),
    passed: errors.length === 0,
    errors,
    warnings,
    proofs: proofReports,
    cycles,
    counts,
  };
}

/** Build the DAG used by the graph page. */
export function buildGraph(library: Library): DependencyGraph {
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const hrefForNode = (id: string) =>
    id.startsWith("ax:") || id.startsWith("def:") || id.startsWith("lem:")
      ? `/library/${id}`
      : id.startsWith("rule:")
        ? `/library/${id}`
        : `/proofs/${id}`;

  for (const node of Object.values(library.nodes)) {
    nodes.push({
      id: node.id,
      kind: node.kind,
      title: node.title,
      statement: node.statement,
      href: hrefForNode(node.id),
      tags: node.tags ?? [],
    });
    for (const target of node.prerequisites ?? []) {
      edges.push({ from: node.id, to: target, relation: "prerequisite" });
    }
  }

  for (const rule of Object.values(library.rules)) {
    nodes.push({
      id: rule.id,
      kind: "rule",
      title: rule.title,
      statement: rule.summary,
      href: hrefForNode(rule.id),
      tags: [],
    });
    for (const target of rule.groundedIn) {
      edges.push({ from: rule.id, to: target, relation: "rule-ground" });
    }
  }

  for (const proofId of library.proofOrder) {
    const proof = library.proofs[proofId];
    nodes.push({
      id: proofId,
      kind: "proof",
      title: proof.title,
      statement: proof.statement,
      href: `/proofs/${encodeURIComponent(proofId)}`,
      tags: proof.tags ?? [],
      difficulty: proof.difficulty,
    });
    for (const target of proof.prerequisites ?? []) {
      edges.push({ from: proofId, to: target, relation: "prerequisite" });
    }
    for (const target of proof.related ?? []) {
      edges.push({ from: proofId, to: target, relation: "related" });
    }
    const cited = new Set<string>();
    walkSteps(proof.steps, (step) => {
      const j = step.justification;
      if (!j) return;
      for (const raw of [j.ref, j.rule]) {
        if (!raw || cited.has(raw)) continue;
        cited.add(raw);
        edges.push({ from: proofId, to: raw, relation: "justification" });
      }
    });
  }

  return { nodes, edges };
}

/** Ancestors (dependencies) and descendants (dependents) of a node in the graph. */
export function closure(graph: DependencyGraph, rootId: string): { dependsOn: Set<string>; dependedOnBy: Set<string> } {
  const outgoing = new Map<string, string[]>();
  const incoming = new Map<string, string[]>();
  for (const edge of graph.edges) {
    if (edge.relation === "related") continue;
    (outgoing.get(edge.from) ?? outgoing.set(edge.from, []).get(edge.from)!).push(edge.to);
    (incoming.get(edge.to) ?? incoming.set(edge.to, []).get(edge.to)!).push(edge.from);
  }
  const walk = (start: string, adjacency: Map<string, string[]>): Set<string> => {
    const seen = new Set<string>();
    const queue = [start];
    while (queue.length) {
      const current = queue.shift() as string;
      for (const next of adjacency.get(current) ?? []) {
        if (!seen.has(next)) {
          seen.add(next);
          queue.push(next);
        }
      }
    }
    return seen;
  };
  return { dependsOn: walk(rootId, outgoing), dependedOnBy: walk(rootId, incoming) };
}
