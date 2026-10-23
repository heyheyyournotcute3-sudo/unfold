# Unfold — mathematical proofs you can zoom into

A reader for proofs written as trees. Every proof opens as a three-to-six line sketch; every line has
a **Why?** control that unfolds it into finer steps, which unfold again, until the only things left
are definitions and axioms the library states openly.

Seven starter proofs, 309 authored steps, 223 leaves — every one of them grounded, checked at build
time.

---

## Quick start

```bash
npm install
npx drizzle-kit push      # create the schema (DATABASE_URL in .env)
npm run build             # validates content, prerenders 103 pages
npm run start
```

`npm run dev` works too; content is re-read from disk on change.

Standalone content validation, without building:

```bash
npx tsx scripts/validate-content.ts          # human report, non-zero exit on failure
npx tsx scripts/validate-content.ts --json   # machine report
```

## What is where

```
content/
  proofs/*.yaml          the seven proofs, as step trees
  library/axioms.yaml    bedrock: 11 axioms
  library/definitions.yaml   44 definitions
  library/lemmas.yaml    19 lemmas with prerequisites and proof sketches
  library/rules.yaml     16 named rules of inference, each grounded in axioms
  paths/paths.yaml       3 curated learning paths

src/lib/content/
  types.ts               the content model
  loader.ts              YAML → Library; runs the validator and throws on errors
  validator.ts           references, cycles, grounding, depth, widgets, LaTeX
  richtext.ts            Markdown + LaTeX → HTML (KaTeX, htmlAndMathml)
  serialize.ts           Proof → prerendered, client-safe payload
  widget-registry.ts     the only widget ids a proof may cite

src/lib/db/
  sync.ts                content → Postgres; hash-guarded, revokes stale approvals
  queries.ts             reviews, search, graph, progress

src/app/
  proofs/[id]            the unfolding reader (SSG)
  library, library/[id]  every definition, axiom, lemma and rule
  graph                  the dependency DAG, read from Postgres
  paths, paths/[id]      learning paths with persisted progress
  search                 Postgres full-text search
  admin                  the review console
  keyboard               accessibility notes and known gaps
  api/                   health, search, reviews, statuses, progress, sync, validation, graph
```

## The content format

```yaml
id: sqrt2-irrational            # unique; becomes /proofs/sqrt2-irrational
title: >-
  $\sqrt{2}$ is irrational      # Markdown + LaTeX; use >- for anything with a backslash
kind: theorem
difficulty: 2                   # 1–5
statement: >-
  There is no rational number $r$ with $r^2 = 2$.
summary: >-
  ...
tags: [number-theory, contradiction]
prerequisites:                  # must resolve to a library node or another proof
  - def:rational-number
  - lem:parity
lean:                           # optional; status is verified | candidate | none
  name: irrational_sqrt_two
  status: candidate
steps:
  - id: s1
    text: >-
      Suppose, aiming for a contradiction, that $\sqrt{2}$ is rational. ...
    justification:
      rule: rule:contradiction  # or ref: def:x | step: s2.1
      note: Temporary assumption, discharged at step s5.
    widget: { id: sqrt2-ladder, caption: >- ... }
    checkpoint:
      id: cp1
      question: >- ...
      options: [ ... ]          # at least two
      answer: 1                 # index of the correct option
      explanation: >- ...
    children: [ ... ]           # finer steps; depth must reach at least 3
```

Library nodes carry `id`, `kind` (`axiom` | `definition` | `lemma`), `title`, `statement`, `body`,
`prerequisites`. Rules carry `groundedIn`.

### What the validator enforces

- every reference resolves — library node, rule, other proof, or an **earlier** step of the same proof
- the hard dependency graph has no cycles
- every leaf step is grounded: an axiom, a definition, a lemma whose prerequisites are grounded, a
  rule grounded in axioms, or an earlier grounded step
- each proof unfolds to at least three levels
- widget ids exist in the registry; checkpoints have ≥ 2 options and a valid answer index
- every LaTeX span compiles under KaTeX

Errors fail `next build`. See `DECISIONS.md` for the reasoning behind each rule.

## Review workflow

Proofs are inserted as `pending`. `/admin` lists them with their validation report, leaf-grounding
breakdown, depth and content hash; a reviewer records **Approve**, **Request changes** or **Reset to
pending** with a name and a note. Every decision appends to `review_events`.

If the content of an approved proof changes, the sync detects the new hash, revokes the approval,
resets the proof to `pending`, and writes a `content_changed` audit event.

## Design and accessibility

Serif reading matter on paper, one accent colour, terracotta reserved for the "Why?" control. Steps
indent by depth with a fading vertical rule. Expand/collapse animates height and opacity, disabled
under `prefers-reduced-motion`.

The proof tree is a real ARIA tree with a roving tabindex: `↑`/`↓` move between visible steps, `→`
unfolds, `←` collapses or jumps to the parent, `Enter`/`Space` toggle, `Home`/`End` jump to the ends.
Formulas ship as pre-rendered HTML **and** MathML. `/keyboard` lists the commands and the gaps that
remain.

## Tech

Next.js (App Router) · TypeScript · PostgreSQL via Drizzle ORM · KaTeX (server-side) · hand-written
SVG widgets · `js-yaml` content pipeline.

Assumptions, trade-offs and known gaps: **[DECISIONS.md](./DECISIONS.md)**.
