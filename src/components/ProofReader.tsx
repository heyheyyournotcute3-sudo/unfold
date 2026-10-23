"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MathHtml } from "@/components/MathHtml";
import { WidgetHost } from "@/components/widgets";
import type { RenderedCheckpoint, RenderedJustification, RenderedProof, RenderedStep } from "@/lib/content/serialize";

type DepthMode = 1 | 2 | 99;

const MODES: { value: DepthMode; label: string; hint: string }[] = [
  { value: 1, label: "Sketch", hint: "the top-level argument only" },
  { value: 2, label: "Standard", hint: "each step unfolded once" },
  { value: 99, label: "Every detail", hint: "all the way down to axioms" },
];

const KIND_ICON: Record<RenderedJustification["kind"], string> = {
  rule: "§",
  axiom: "◈",
  definition: "◇",
  lemma: "△",
  step: "↑",
  proof: "▣",
  none: "?",
};

const KIND_LABEL: Record<RenderedJustification["kind"], string> = {
  rule: "rule",
  axiom: "axiom",
  definition: "definition",
  lemma: "lemma",
  step: "earlier step",
  proof: "theorem",
  none: "unjustified",
};

function stepNumber(id: string): string {
  return id.startsWith("s") ? id.slice(1) : id;
}

interface IndexEntry {
  step: RenderedStep;
  ancestors: string[];
}

function buildIndex(steps: RenderedStep[], ancestors: string[] = [], acc: IndexEntry[] = []): IndexEntry[] {
  for (const step of steps) {
    acc.push({ step, ancestors });
    if (step.children.length) buildIndex(step.children, [...ancestors, step.id], acc);
  }
  return acc;
}

/* ---------------------------------------------------------------- checkpoint */

function Checkpoint({
  checkpoint,
  stepId,
  chosen,
  revealed,
  onChoose,
  onReveal,
  onReset,
}: {
  checkpoint: RenderedCheckpoint;
  stepId: string;
  chosen: number | null;
  revealed: boolean;
  onChoose: (index: number) => void;
  onReveal: () => void;
  onReset: () => void;
}) {
  const correct = revealed && chosen === checkpoint.answer;
  const wrong = revealed && chosen !== null && chosen !== checkpoint.answer;

  return (
    <section
      aria-labelledby={`cp-${stepId}`}
      className="my-4 rounded-lg border border-flag/40 bg-flag-soft/60 p-4"
    >
      <p id={`cp-${stepId}`} className="font-sans text-[0.7rem] uppercase tracking-[0.14em] text-flag">
        Try it — checkpoint
      </p>
      <MathHtml html={checkpoint.questionHtml} className="mt-2 text-[0.98rem] text-ink" />

      <div role="radiogroup" aria-labelledby={`cp-${stepId}`} className="mt-3 space-y-2">
        {checkpoint.optionsHtml.map((option, index) => {
          const selected = chosen === index;
          const isAnswer = index === checkpoint.answer;
          const state = revealed ? (isAnswer ? "correct" : selected ? "wrong" : "idle") : "idle";
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => {
                onChoose(index);
                onReveal();
              }}
              className={`block w-full rounded-md border px-3 py-2 text-left transition-colors ${
                state === "correct"
                  ? "border-accent bg-accent-soft"
                  : state === "wrong"
                    ? "border-danger bg-danger-soft"
                    : selected
                      ? "border-accent bg-panel"
                      : "border-rule bg-panel hover:border-accent/60"
              }`}
            >
              <span className="mr-2 font-sans text-[0.72rem] uppercase tracking-wide text-muted">
                {String.fromCharCode(97 + index)}
              </span>
              <MathHtml as="span" html={option} className="inline text-[0.92rem]" />
              {state === "correct" ? <span className="ml-2 font-sans text-[0.72rem] text-accent">✓ correct</span> : null}
              {state === "wrong" ? <span className="ml-2 font-sans text-[0.72rem] text-danger">✗ not quite</span> : null}
            </button>
          );
        })}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 font-sans text-[0.78rem]">
        {checkpoint.hint && !revealed ? <span className="text-muted">Hint: {checkpoint.hint}</span> : null}
        {revealed ? (
          <button type="button" onClick={onReset} className="text-muted underline underline-offset-2 hover:text-accent">
            Try again
          </button>
        ) : (
          <button type="button" onClick={onReveal} className="text-flag underline underline-offset-2 hover:text-accent">
            Reveal the answer
          </button>
        )}
        {correct ? <span className="text-accent">{/* announced below */}</span> : null}
      </div>

      {revealed ? (
        <div className="reveal-fade mt-3 border-t border-flag/30 pt-3">
          <p className="font-sans text-[0.7rem] uppercase tracking-[0.12em] text-flag">
            {correct ? "Correct — why it works" : wrong ? "Answer " + String.fromCharCode(97 + checkpoint.answer) + " — why" : "Why"}
          </p>
          <MathHtml html={checkpoint.explanationHtml} className="mt-1 text-[0.92rem] text-ink-soft" />
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {correct ? "Correct." : wrong ? "Not quite; the explanation is shown." : ""}
      </p>
    </section>
  );
}

/* ------------------------------------------------------------- justification */

function JustificationPill({
  justification,
  onJump,
}: {
  justification: RenderedJustification;
  onJump: (id: string) => void;
}) {
  if (justification.kind === "none") return null;

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const href = justification.href ?? "";
    if (href.startsWith("#step-")) {
      event.preventDefault();
      onJump(href.slice("#step-".length));
    }
  };

  const inner = (
    <>
      <span aria-hidden="true" className="mr-1.5 text-[0.85em]">
        {KIND_ICON[justification.kind]}
      </span>
      <span className="font-sans text-[0.72rem] uppercase tracking-[0.1em] text-muted">
        {justification.label.startsWith("Step ") ? "" : `${KIND_LABEL[justification.kind]} · `}
      </span>
      <span className="text-[0.85rem]">{justification.label}</span>
    </>
  );

  return (
    <span className="inline-flex flex-col gap-0.5">
      {justification.href ? (
        <a
          href={justification.href}
          onClick={handleClick}
          className="inline-flex items-center rounded-full border border-rule bg-panel px-2.5 py-1 text-ink-soft transition-colors hover:border-accent hover:text-accent"
        >
          {inner}
        </a>
      ) : (
        <span className="inline-flex items-center rounded-full border border-rule bg-panel px-2.5 py-1 text-ink-soft">
          {inner}
        </span>
      )}
      {justification.also.length > 0 ? (
        <span className="flex flex-wrap gap-1 pl-1">
          {justification.also.map((extra, i) => (
            <a
              key={i}
              href={extra.href ?? "#"}
              onClick={(event) => {
                if (extra.href?.startsWith("#step-")) {
                  event.preventDefault();
                  onJump(extra.href.slice("#step-".length));
                }
              }}
              className="rounded-full border border-rule/70 bg-panel-alt px-2 py-0.5 font-sans text-[0.7rem] text-muted transition-colors hover:border-accent hover:text-accent"
            >
              + {extra.label}
            </a>
          ))}
        </span>
      ) : null}
      {justification.note ? (
        <span className="pl-1 font-sans text-[0.76rem] italic leading-snug text-muted">{justification.note}</span>
      ) : null}
    </span>
  );
}

/* ------------------------------------------------------------------ the tree */

interface StepViewProps {
  step: RenderedStep;
  expanded: Set<string>;
  activeId: string;
  answers: Record<string, number | null>;
  revealed: Record<string, boolean>;
  registerRef: (id: string, el: HTMLElement | null) => void;
  onToggle: (id: string) => void;
  onActivate: (id: string) => void;
  onJump: (id: string) => void;
  onAnswer: (stepId: string, index: number) => void;
  onReveal: (stepId: string) => void;
  onResetAnswer: (stepId: string) => void;
}

function StepView(props: StepViewProps) {
  const { step, expanded, activeId, answers, revealed, registerRef, onToggle, onActivate, onJump, onAnswer, onReveal, onResetAnswer } = props;
  const isOpen = expanded.has(step.id);
  const isActive = activeId === step.id;
  const hasChildren = step.hasChildren;

  return (
    <li role="none" className="relative">
      <div
        id={`step-${step.id}`}
        role="treeitem"
        aria-level={step.depth}
        aria-expanded={hasChildren ? isOpen : undefined}
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        ref={(el) => registerRef(step.id, el)}
        onClick={() => onActivate(step.id)}
        className={`step-row relative scroll-mt-28 rounded-md py-2 pr-2 transition-colors ${isActive ? "bg-accent/[0.06]" : ""}`}
        data-active={isActive}
      >
        <div className="flex gap-3">
          <span
            aria-hidden="true"
            className="mt-[0.35rem] w-9 shrink-0 text-right font-sans text-[0.7rem] tabular text-muted"
          >
            {stepNumber(step.id)}
          </span>
          <div className="min-w-0 flex-1">
            <div className={`relative ${step.aside ? "border-l-2 border-rule-strong pl-3 text-ink-soft" : ""}`}>
              {step.aside ? (
                <span className="mb-1 block font-sans text-[0.66rem] uppercase tracking-[0.14em] text-muted">
                  aside · not load-bearing
                </span>
              ) : null}
              <MathHtml html={step.html} className="text-[1.02rem] leading-[1.8]" />
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {hasChildren ? (
                <button
                  type="button"
                  tabIndex={-1}
                  aria-label={isOpen ? `Collapse the detail under step ${stepNumber(step.id)}` : `Unfold step ${stepNumber(step.id)} into ${step.childCount} finer steps`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggle(step.id);
                  }}
                  className={`no-print inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-sans text-[0.74rem] transition-colors ${
                    isOpen
                      ? "border-accent/50 bg-accent-soft text-accent"
                      : "border-flare/50 bg-flare-soft text-flare hover:border-flare"
                  } ${isOpen ? "why-pulse" : ""}`}
                >
                  <span aria-hidden="true">{isOpen ? "−" : "+"}</span>
                  {isOpen ? "Collapse" : "Why?"}
                  <span className="tabular rounded-full bg-panel/70 px-1.5 text-[0.68rem] text-muted">{step.childCount}</span>
                </button>
              ) : (
                <span className="no-print inline-flex items-center gap-1 rounded-full border border-rule bg-panel-alt px-2 py-0.5 font-sans text-[0.66rem] uppercase tracking-[0.1em] text-muted">
                  leaf · {step.justification.grounded ? "grounded" : "check me"}
                </span>
              )}
              <JustificationPill justification={step.justification} onJump={onJump} />
            </div>

            {step.widget ? <WidgetHost widget={step.widget} /> : null}

            {step.checkpoint ? (
              <Checkpoint
                checkpoint={step.checkpoint}
                stepId={step.id}
                chosen={answers[step.id] ?? null}
                revealed={Boolean(revealed[step.id])}
                onChoose={(index) => onAnswer(step.id, index)}
                onReveal={() => onReveal(step.id)}
                onReset={() => onResetAnswer(step.id)}
              />
            ) : null}
          </div>
        </div>
      </div>

      {hasChildren ? (
        <div className="step-collapse" data-open={isOpen} aria-hidden={!isOpen}>
          <div className="step-collapse-inner" style={{ visibility: isOpen ? "visible" : "hidden" }}>
            <ul role="group" className="relative ml-[2.7rem] border-l border-rule pl-4 sm:ml-[3.1rem]">
              {step.children.map((child) => (
                <StepView key={child.id} {...props} step={child} />
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/* ------------------------------------------------------------------- reader */

export function ProofReader({ proof }: { proof: RenderedProof }) {
  const index = useMemo(() => buildIndex(proof.steps), [proof.steps]);
  const byId = useMemo(() => new Map(index.map((entry) => [entry.step.id, entry])), [index]);

  const [mode, setMode] = useState<DepthMode>(1);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [activeId, setActiveId] = useState<string>(proof.steps[0]?.id ?? "");
  const [answers, setAnswers] = useState<Record<string, number | null>>({});
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [showHelp, setShowHelp] = useState(false);
  const elementRefs = useRef(new Map<string, HTMLElement>());
  const treeRef = useRef<HTMLUListElement | null>(null);

  const registerRef = useCallback((id: string, el: HTMLElement | null) => {
    if (el) elementRefs.current.set(id, el);
    else elementRefs.current.delete(id);
  }, []);

  const expandFor = useCallback(
    (target: DepthMode) => {
      const next = new Set<string>();
      for (const entry of index) {
        if (entry.step.depth < target && entry.step.hasChildren) next.add(entry.step.id);
      }
      setExpanded(next);
    },
    [index],
  );

  useEffect(() => {
    expandFor(mode);
    // Only on mode change; initial state is the Sketch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  const visible = useMemo(() => {
    const out: RenderedStep[] = [];
    const walk = (steps: RenderedStep[]) => {
      for (const step of steps) {
        out.push(step);
        if (expanded.has(step.id)) walk(step.children);
      }
    };
    walk(proof.steps);
    return out;
  }, [expanded, proof.steps]);

  const openAncestors = useCallback(
    (id: string) => {
      const entry = byId.get(id);
      if (!entry) return;
      setExpanded((prev) => {
        const next = new Set(prev);
        for (const ancestor of entry.ancestors) next.add(ancestor);
        return next;
      });
    },
    [byId],
  );

  const focusStep = useCallback(
    (id: string, options: { scroll?: boolean } = {}) => {
      openAncestors(id);
      setActiveId(id);
      window.setTimeout(() => {
        const el = elementRefs.current.get(id);
        if (el) {
          el.focus({ preventScroll: true });
          if (options.scroll !== false) el.scrollIntoView({ block: "center", behavior: "smooth" });
        }
      }, 40);
    },
    [openAncestors],
  );

  const toggle = useCallback(
    (id: string) => {
      setExpanded((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
      setActiveId(id);
    },
    [],
  );

  const moveBy = useCallback(
    (delta: number) => {
      const current = visible.findIndex((step) => step.id === activeId);
      const base = current === -1 ? 0 : current;
      const nextIndex = Math.min(visible.length - 1, Math.max(0, base + delta));
      const next = visible[nextIndex];
      if (next) focusStep(next.id);
    },
    [visible, activeId, focusStep],
  );

  const onKeyDown = useCallback(
    (event: React.KeyboardEvent) => {
      const entry = byId.get(activeId);
      const step = entry?.step;
      switch (event.key) {
        case "ArrowDown":
          event.preventDefault();
          moveBy(1);
          break;
        case "ArrowUp":
          event.preventDefault();
          moveBy(-1);
          break;
        case "ArrowRight":
          event.preventDefault();
          if (step?.hasChildren && !expanded.has(step.id)) toggle(step.id);
          else moveBy(1);
          break;
        case "ArrowLeft":
          event.preventDefault();
          if (step && expanded.has(step.id)) toggle(step.id);
          else if (entry?.ancestors.length) focusStep(entry.ancestors[entry.ancestors.length - 1]);
          else moveBy(-1);
          break;
        case "Home":
          event.preventDefault();
          if (visible[0]) focusStep(visible[0].id);
          break;
        case "End":
          event.preventDefault();
          if (visible.length) focusStep(visible[visible.length - 1].id);
          break;
        case "Enter":
        case " ":
          if (step?.hasChildren) {
            event.preventDefault();
            toggle(step.id);
          }
          break;
        default:
          break;
      }
    },
    [activeId, byId, expanded, moveBy, toggle, visible, focusStep],
  );

  const activeEntry = byId.get(activeId);
  const expandedCount = expanded.size;

  return (
    <div>
      <div className="no-print sticky top-[3.4rem] z-20 -mx-5 mb-6 border-y border-rule bg-paper/95 px-5 py-3 backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <div>
            <p className="font-sans text-[0.66rem] uppercase tracking-[0.16em] text-muted">Depth</p>
            <div className="mt-1 flex items-center gap-2" role="group" aria-label="Proof depth">
              {MODES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  aria-pressed={mode === option.value}
                  title={option.hint}
                  onClick={() => setMode(option.value)}
                  className={`rounded-full border px-3 py-1 font-sans text-[0.76rem] transition-colors ${
                    mode === option.value
                      ? "border-accent bg-accent text-white"
                      : "border-rule bg-panel text-ink-soft hover:border-accent hover:text-accent"
                  }`}
                >
                  {option.label}
                </button>
              ))}
              <input
                type="range"
                className="unfold-range ml-1 w-24"
                min={0}
                max={2}
                step={1}
                value={mode === 1 ? 0 : mode === 2 ? 1 : 2}
                aria-label="Depth slider"
                aria-valuetext={MODES.find((m) => m.value === mode)?.label}
                onChange={(event) => setMode(MODES[Number(event.target.value)].value)}
              />
            </div>
          </div>

          <nav aria-label="Breadcrumb of the focused step" className="min-w-0 flex-1">
            <p className="font-sans text-[0.66rem] uppercase tracking-[0.16em] text-muted">You are at</p>
            <ol className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 font-sans text-[0.78rem]">
              <li>
                <button
                  type="button"
                  onClick={() => focusStep(proof.steps[0]?.id ?? "", { scroll: false })}
                  className="text-ink-soft hover:text-accent"
                >
                  {proof.titlePlain}
                </button>
              </li>
              {(activeEntry?.ancestors ?? []).map((ancestor) => (
                <li key={ancestor} className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="text-muted">
                    ›
                  </span>
                  <button type="button" onClick={() => focusStep(ancestor, { scroll: false })} className="tabular text-ink-soft hover:text-accent">
                    {stepNumber(ancestor)}
                  </button>
                </li>
              ))}
              <li className="flex items-center gap-1.5">
                <span aria-hidden="true" className="text-muted">
                  ›
                </span>
                <span className="tabular rounded bg-accent-soft px-1.5 py-0.5 text-accent" aria-current="step">
                  {activeId ? stepNumber(activeId) : "—"}
                </span>
                <span className="text-muted">· depth {activeEntry?.step.depth ?? 1}</span>
              </li>
            </ol>
          </nav>

          <div className="flex items-center gap-2 font-sans text-[0.76rem]">
            <button
              type="button"
              onClick={() => {
                setMode(99);
                expandFor(99);
              }}
              className="rounded border border-rule bg-panel px-2.5 py-1 text-ink-soft hover:border-accent hover:text-accent"
            >
              Unfold all
            </button>
            <button
              type="button"
              onClick={() => {
                setMode(1);
                expandFor(1);
              }}
              className="rounded border border-rule bg-panel px-2.5 py-1 text-ink-soft hover:border-accent hover:text-accent"
            >
              Collapse
            </button>
            <button
              type="button"
              onClick={() => setShowHelp((v) => !v)}
              aria-expanded={showHelp}
              className="rounded border border-rule bg-panel px-2.5 py-1 text-ink-soft hover:border-accent hover:text-accent"
            >
              Keys
            </button>
          </div>
        </div>

        {showHelp ? (
          <div className="reveal-fade mt-3 grid gap-x-6 gap-y-1 border-t border-rule pt-3 font-sans text-[0.76rem] text-ink-soft sm:grid-cols-2 lg:grid-cols-3">
            <p>
              <kbd className="rounded border border-rule bg-panel px-1">↑</kbd>{" "}
              <kbd className="rounded border border-rule bg-panel px-1">↓</kbd> move between visible steps
            </p>
            <p>
              <kbd className="rounded border border-rule bg-panel px-1">→</kbd> unfold the focused step
            </p>
            <p>
              <kbd className="rounded border border-rule bg-panel px-1">←</kbd> collapse, or jump to the parent
            </p>
            <p>
              <kbd className="rounded border border-rule bg-panel px-1">Enter</kbd> /{" "}
              <kbd className="rounded border border-rule bg-panel px-1">Space</kbd> toggle “Why?”
            </p>
            <p>
              <kbd className="rounded border border-rule bg-panel px-1">Home</kbd>{" "}
              <kbd className="rounded border border-rule bg-panel px-1">End</kbd> first / last visible step
            </p>
            <p>
              <kbd className="rounded border border-rule bg-panel px-1">Tab</kbd> enters the tree, then arrows take over
            </p>
          </div>
        ) : null}
      </div>

      <p className="no-print mb-4 font-sans text-[0.78rem] text-muted" role="status" aria-live="polite">
        {visible.length} of {proof.stepCount} steps visible · {expandedCount} unfolded · deepest level in this proof:{" "}
        {proof.maxDepth}
      </p>

      <ul
        ref={treeRef}
        role="tree"
        aria-label={`Proof steps for ${proof.titlePlain}`}
        aria-multiselectable={false}
        onKeyDown={onKeyDown}
        className="space-y-1"
      >
        {proof.steps.map((step) => (
          <StepView
            key={step.id}
            step={step}
            expanded={expanded}
            activeId={activeId}
            answers={answers}
            revealed={revealed}
            registerRef={registerRef}
            onToggle={toggle}
            onActivate={(id) => setActiveId(id)}
            onJump={(id) => focusStep(id)}
            onAnswer={(stepId, value) => setAnswers((prev) => ({ ...prev, [stepId]: value }))}
            onReveal={(stepId) => setRevealed((prev) => ({ ...prev, [stepId]: true }))}
            onResetAnswer={(stepId) => {
              setAnswers((prev) => ({ ...prev, [stepId]: null }));
              setRevealed((prev) => ({ ...prev, [stepId]: false }));
            }}
          />
        ))}
      </ul>
    </div>
  );
}
