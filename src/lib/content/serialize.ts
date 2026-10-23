/**
 * Turn an authored `Proof` into a client-safe, pre-rendered payload.
 *
 * All KaTeX rendering happens here, on the server, during static generation. The
 * browser receives finished HTML (with MathML inside) and never loads KaTeX.
 */
import type { Justification, Library, LibraryNode, Proof, Step } from "./types";
import { plainText, renderRichText } from "./richtext";
import { WIDGETS } from "./widget-registry";

export type JustificationKind = "rule" | "axiom" | "definition" | "lemma" | "step" | "proof" | "none";

export interface RenderedJustification {
  kind: JustificationKind;
  label: string;
  href?: string;
  targetId?: string;
  note?: string;
  /** Extra citations shown alongside the primary one. */
  also: { kind: JustificationKind; label: string; href?: string; targetId?: string }[];
  grounded: boolean;
}

export interface RenderedCheckpoint {
  id: string;
  questionHtml: string;
  optionsHtml: string[];
  answer: number;
  explanationHtml: string;
  hint?: string;
}

export interface RenderedStep {
  id: string;
  depth: number;
  html: string;
  plain: string;
  aside: boolean;
  hasChildren: boolean;
  childCount: number;
  justification: RenderedJustification;
  widget?: { id: string; captionHtml?: string; title: string; description: string; controls: string };
  checkpoint?: RenderedCheckpoint;
  lean?: string;
  children: RenderedStep[];
}

export interface RenderedPrerequisite {
  id: string;
  title: string;
  href: string;
  kind: string;
}

export interface RenderedProof {
  id: string;
  titleHtml: string;
  titlePlain: string;
  statementHtml: string;
  summaryHtml: string;
  attributionHtml?: string;
  difficulty: number;
  tags: string[];
  maxDepth: number;
  stepCount: number;
  leafCount: number;
  checkpointCount: number;
  prerequisites: RenderedPrerequisite[];
  related: RenderedPrerequisite[];
  lean?: {
    name?: string;
    statement?: string;
    file?: string;
    url?: string;
    status: string;
    note?: string;
  };
  steps: RenderedStep[];
}

export function nodeHref(id: string): string {
  if (id.startsWith("rule:") || id.startsWith("ax:") || id.startsWith("def:") || id.startsWith("lem:")) {
    // Colons are legal in a path segment; keep ids verbatim so prerendered paths match links.
    return `/library/${id}`;
  }
  return `/proofs/${encodeURIComponent(id)}`;
}

function prettyStepId(id: string): string {
  return id.startsWith("s") ? id.slice(1) : id;
}

function describeTarget(
  raw: string,
  library: Library,
  proof: Proof,
): { kind: JustificationKind; label: string; href?: string; grounded: boolean } {
  const node: LibraryNode | undefined = library.nodes[raw];
  if (node) {
    const kind: JustificationKind = node.kind === "axiom" ? "axiom" : node.kind === "lemma" ? "lemma" : "definition";
    const prefix = kind === "axiom" ? "Axiom" : kind === "lemma" ? "Lemma" : "Definition";
    return {
      kind,
      label: `${prefix}: ${plainText(node.title)}`,
      href: nodeHref(raw),
      grounded: kind !== "lemma" || (node.prerequisites?.length ?? 0) > 0,
    };
  }
  const rule = library.rules[raw];
  if (rule) {
    return { kind: "rule", label: plainText(rule.title), href: nodeHref(raw), grounded: rule.groundedIn.length > 0 };
  }
  const other = library.proofs[raw];
  if (other) {
    return { kind: "proof", label: plainText(other.title), href: `/proofs/${encodeURIComponent(raw)}`, grounded: raw !== proof.id };
  }
  return { kind: "none", label: raw, grounded: false };
}

export function renderJustification(
  justification: Justification | undefined,
  step: Step,
  library: Library,
  proof: Proof,
): RenderedJustification {
  const also: RenderedJustification["also"] = [];

  if (step.axiom) {
    return { kind: "axiom", label: "Taken as an axiom", grounded: true, also, note: justification?.note };
  }
  if (step.definition) {
    return { kind: "definition", label: "True by definition", grounded: true, also, note: justification?.note };
  }
  if (!justification) {
    return { kind: "none", label: "Unjustified", grounded: false, also };
  }

  let primary: { kind: JustificationKind; label: string; href?: string; grounded: boolean } | undefined;

  if (justification.ref) {
    primary = describeTarget(justification.ref, library, proof);
  } else if (justification.step) {
    primary = {
      kind: "step",
      label: `Step ${prettyStepId(justification.step)} above`,
      href: `#step-${justification.step}`,
      grounded: true,
    };
  } else if (justification.rule) {
    primary = describeTarget(justification.rule, library, proof);
  }

  // Secondary citations.
  if (justification.ref && justification.rule) {
    const rule = describeTarget(justification.rule, library, proof);
    also.push({ kind: rule.kind, label: rule.label, href: rule.href, targetId: justification.rule });
  }
  if (justification.ref && justification.step) {
    also.push({
      kind: "step",
      label: `Step ${prettyStepId(justification.step)} above`,
      href: `#step-${justification.step}`,
      targetId: justification.step,
    });
  }
  if (!justification.ref && justification.step && justification.rule) {
    const rule = describeTarget(justification.rule, library, proof);
    also.push({ kind: rule.kind, label: rule.label, href: rule.href, targetId: justification.rule });
  }

  if (justification.label) {
    primary = { ...(primary ?? { kind: "none", href: undefined, grounded: false }), label: justification.label };
  }

  return {
    kind: primary?.kind ?? "none",
    label: primary?.label ?? "Unjustified",
    href: primary?.href,
    targetId: justification.ref ?? justification.step ?? justification.rule,
    note: justification.note,
    grounded: Boolean(primary?.grounded),
    also,
  };
}

export function renderStep(
  step: Step,
  depth: number,
  library: Library,
  proof: Proof,
): RenderedStep {
  const children = (step.children ?? []).map((child) => renderStep(child, depth + 1, library, proof));
  const meta = step.widget ? WIDGETS[step.widget.id] : undefined;
  const widget = step.widget
    ? {
        id: step.widget.id,
        title: meta?.title ?? step.widget.id,
        description: meta?.description ?? "",
        controls: meta?.controls ?? "",
        captionHtml: step.widget.caption ? renderRichText(step.widget.caption) : undefined,
      }
    : undefined;

  return {
    id: step.id,
    depth,
    html: renderRichText(step.text),
    plain: plainText(step.text),
    aside: Boolean(step.aside),
    hasChildren: children.length > 0,
    childCount: children.length,
    justification: renderJustification(step.justification, step, library, proof),
    widget,
    checkpoint: step.checkpoint
      ? {
          id: step.checkpoint.id,
          questionHtml: renderRichText(step.checkpoint.question),
          optionsHtml: step.checkpoint.options.map((option) => renderRichText(option)),
          answer: step.checkpoint.answer,
          explanationHtml: renderRichText(step.checkpoint.explanation),
          hint: step.checkpoint.hint ? plainText(step.checkpoint.hint) : undefined,
        }
      : undefined,
    lean: step.lean,
    children,
  };
}

function countSteps(steps: Step[]): { total: number; leaves: number; maxDepth: number; checkpoints: number } {
  let total = 0;
  let leaves = 0;
  let maxDepth = 0;
  let checkpoints = 0;
  const walk = (list: Step[], depth: number) => {
    for (const step of list) {
      total += 1;
      maxDepth = Math.max(maxDepth, depth);
      if (step.checkpoint) checkpoints += 1;
      if (!step.children?.length) leaves += 1;
      else walk(step.children, depth + 1);
    }
  };
  walk(steps, 1);
  return { total, leaves, maxDepth, checkpoints };
}

export function renderProof(proof: Proof, library: Library): RenderedProof {
  const steps = proof.steps.map((step) => renderStep(step, 1, library, proof));
  const stats = countSteps(proof.steps);

  const prerequisite = (id: string): RenderedPrerequisite => {
    const described = describeTarget(id, library, proof);
    return {
      id,
      title: described.label.replace(/^(Axiom|Definition|Lemma|Rule):\s*/, ""),
      href: described.href ?? nodeHref(id),
      kind: described.kind,
    };
  };

  return {
    id: proof.id,
    titleHtml: renderRichText(proof.title),
    titlePlain: plainText(proof.title),
    statementHtml: renderRichText(proof.statement),
    summaryHtml: renderRichText(proof.summary),
    attributionHtml: proof.attribution ? renderRichText(proof.attribution) : undefined,
    difficulty: proof.difficulty,
    tags: proof.tags ?? [],
    maxDepth: stats.maxDepth,
    stepCount: stats.total,
    leafCount: stats.leaves,
    checkpointCount: stats.checkpoints,
    prerequisites: (proof.prerequisites ?? []).map(prerequisite),
    related: (proof.related ?? []).map(prerequisite),
    lean: proof.lean
      ? {
          name: proof.lean.name,
          statement: proof.lean.statement,
          file: proof.lean.file,
          url: proof.lean.url,
          status: proof.lean.status,
          note: proof.lean.note ? plainText(proof.lean.note) : undefined,
        }
      : undefined,
    steps,
  };
}

/** Flat list of every step, used to build the search corpus. */
export function flattenSteps(steps: RenderedStep[], acc: RenderedStep[] = []): RenderedStep[] {
  for (const step of steps) {
    acc.push(step);
    flattenSteps(step.children, acc);
  }
  return acc;
}
