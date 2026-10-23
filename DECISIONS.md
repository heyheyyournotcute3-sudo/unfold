# DECISIONS.md

Assumptions, design decisions and known gaps for **Unfold** — mathematical proofs you can zoom into.
Anything a reviewer or future maintainer could reasonably disagree with is recorded here rather than
buried in code.

---

## 1. Content format: YAML, not MDX

**Decision.** Proofs are authored as structured YAML in `content/proofs/*.yaml`; the rest of the
library (axioms, definitions, lemmas, rules of inference) lives in `content/library/*.yaml`;
learning paths in `content/paths/paths.yaml`.

**Why.** The brief allowed "YAML or MDX". The defining feature of this app is that a step can be
*unfolded*, which means the step tree has to be data, not prose. YAML gives a machine-readable tree
that a validator can walk, that a database can mirror, and that a graph can be built from. MDX would
have made the tree a by-product of JSX and made validation a parsing problem.

**Cost.** Authors do not get arbitrary React inside a step. They get Markdown + LaTeX plus three
typed escape hatches: `widget`, `checkpoint` and `aside`. That was judged a fair trade; the widget
registry is where interactivity lives.

**Formatting rule that bit us.** YAML plain scalars cannot contain `": "`, and LaTeX is full of
`$f : A \to B$`. Every field that can contain a backslash or a colon is written as a folded block
scalar (`>-`). Double-quoted scalars are *not* used for math, because `\` is an escape character
inside them.

## 2. The grounding rule (the strictest decision in the project)

**Decision.** A *leaf* step — one with no children — must be justified, and its justification must
bottom out in a stated axiom or definition. Concretely, a leaf is **grounded** if at least one of
the following holds:

1. it is marked `axiom: true` or `definition: true`;
2. it cites `ref:` an **axiom** or **definition** node;
3. it cites `ref:` a **lemma** node whose own `prerequisites` are all grounded (recursively);
4. it cites a **rule** (`rule:algebra`, `rule:contradiction`, …) that exists in `rules.yaml` and
   declares `groundedIn:` axioms/definitions/lemmas that are themselves grounded;
5. it cites `step:` an **earlier** step of the same proof which is grounded.

Non-leaf steps are *not* required to carry a justification — their children do the work — but if
they cite one, the citation must resolve.

**Why this shape.** Acceptance criterion 2 says "each proof's deepest level relies only on stated
definitions and axioms". Rule 4 is what makes that practical: nobody wants a four-level expansion of
every algebraic rearrangement, but "by algebra" is still traceable to the field axioms
(`ax:real-field`, `ax:integer-ring`, `ax:equality`) through a declared, checkable link.

**Extra rigour added on top of the brief.** Step references must point *backwards* in document order
(`forward-step-reference` is an error). A step may not justify itself by a step the reader has not
seen yet.

**Consequence for authors.** You cannot invent a justification. `rule:construction` was missing on
the first pass and the build failed until it was added to `rules.yaml` with its axioms — which is the
intended behaviour.

## 3. Validation is a build gate, not a lint

**Decision.** `src/lib/content/loader.ts` runs the validator on every load and **throws** if there
are errors. Since every proof page is statically generated at build time, an invalid proof fails
`next build`. `scripts/validate-content.ts` runs the same checks standalone
(`npx tsx scripts/validate-content.ts`, `--json` for machines) and exits non-zero.

**Warnings do not fail the build.** Current warning classes: a branch step with no justification, a
checkpoint with no explanation, a path stop with no `why`. These are quality signals, not
correctness signals.

**Checks performed.** Unique ids · resolvable references (definitions, lemmas, axioms, rules, other
proofs, earlier steps) · no cycles in the hard dependency graph · grounded leaves · backwards step
references · minimum unfolding depth of 3 per proof · widget ids present in the registry · checkpoint
answer index in range with ≥ 2 options · every LaTeX span compiles under KaTeX with
`throwOnError: true` · path stops resolve to real proofs · difficulty in 1–5.

**Report.** The full report is persisted per proof in the database (`proofs.validation_issues`,
`proofs.grounds`), served at `GET /api/validation`, and rendered in `/admin`.

## 4. Review gate: pending by default, revoked on content change

**Decision.** Every proof row is inserted with `review_status = 'pending'`. A human decision is
recorded through `POST /api/reviews` and stored with reviewer name, note and timestamp, plus an
append-only row in `review_events`.

**Content changes revoke approval.** Each proof is hashed (`proofHash` = SHA-256 of its parsed
structure). A sync that sees a different hash for an approved proof resets it to `pending` and writes
a `content_changed` audit event. Rationale: approving a proof is a claim about *that text*; silently
keeping the approval after the text changed would be exactly the failure mode the gate exists to
prevent.

**No authentication.** `/admin` is open. This is a deliberate scope cut: the app models a
single-reviewer workflow and records a name typed into a field (persisted in `localStorage`).
Production use needs real auth and, ideally, two-person sign-off. Recorded as a gap, not solved.

**Reader-facing truth.** Because proof pages are static, the review banner is a client component
(`ReviewBadge`) that reads `GET /api/reviews/statuses`. A prerendered page can therefore show a live
review state without becoming dynamic.

## 5. Static generation, and what is deliberately dynamic

| Route | Rendering | Reads the database? |
| --- | --- | --- |
| `/` , `/library`, `/library/[id]`, `/paths`, `/keyboard` | static | no |
| `/proofs/[id]` (all 7) | **SSG**, `dynamicParams = false` | no (badge fetches client-side) |
| `/graph`, `/search`, `/paths/[id]`, `/admin` | dynamic | yes |
| `/api/*` | dynamic | yes |

103 pages are prerendered at build time, including all 90 library entries and all 7 proofs.

## 6. Mathematics rendering: KaTeX on the server only

**Decision.** `src/lib/content/richtext.ts` renders Markdown + LaTeX to HTML during static
generation with `output: "htmlAndMathml"`. The browser receives finished markup; the KaTeX JS bundle
is never shipped. `public/katex/` holds the stylesheet and fonts, copied from `node_modules` so no
CDN is involved.

**Accessibility.** `htmlAndMathml` means every formula carries a MathML tree (announced structurally
by screen readers) plus the TeX source in an `annotation` element. `/keyboard` documents this and
lists the remaining gaps honestly.

**Security note.** `dangerouslySetInnerHTML` is used in one place, `MathHtml`, on HTML produced at
build time from version-controlled content by a renderer that escapes all non-math text before
applying the Markdown subset. No user input ever reaches it.

## 7. Widgets: hand-written SVG, not JSXGraph

**Decision.** All seven widgets are custom React + SVG components in `src/components/widgets/`. The
brief said "JSXGraph or custom SVG"; custom SVG was chosen to avoid a 200 KB client dependency, to
keep widgets prerender-friendly, and because each demonstration needs bespoke semantics anyway.

**One decision worth calling out.** The Pythagoras widget does *not* linearly interpolate triangle
vertices (that would shear the triangles and make them non-congruent mid-animation, which would be a
lie). It computes the rigid motion — rotation angle plus translation — between each triangle's
position in arrangement A and its position in arrangement B, and interpolates *that*. Every
intermediate frame is a congruent copy of the original triangle.

## 8. Database schema and the sync contract

`content/` is the source of truth for mathematics; Postgres holds what the app needs at request time:

- `proofs` — cached metadata, validation report, review decision
- `review_events` — append-only audit trail
- `library_nodes` / `library_edges` — the dependency graph, mirrored from content
- `search_documents` — full-text corpus (one row per proof, node, path **and step**)
- `path_progress` — learner progress per path
- `sync_state` — content hash of the last sync

`ensureSynced()` runs before every read, is hash-guarded (a no-op when content has not changed), and
is serialised through a module-level promise so concurrent first requests cannot double-write.

## 9. Search

Postgres full-text search: `to_tsvector('english', title || ' ' || body) @@ plainto_tsquery(...)`,
ranked by `ts_rank × weight` with a title-`ILIKE` bonus and an `ILIKE` fallback so partial words
still hit. Weights: proof 10, path 6, definition/lemma/axiom/rule 5, top-level step 3, deep step 1.
Indexed text is passed through `plainText()`, which strips LaTeX markup but keeps the symbols, so
searching "diagonal" or "gnomon" finds the steps that use those words.

## 10. Mathematical decisions a reviewer should check first

These are the places where an informal proof is usually sloppy, and where this library made an
explicit choice:

1. **Cantor.** Digit strings are canonicalised (never ending in repeating 9s) and the constructed
   number uses only the digits 4 and 5, so "differs in the n-th digit" implies "is a different real".
   The strict inequality is justified by the tail bound
   `lem:geometric-series-tail` plus the fact that equality in the bound requires an all-9s tail.
   The popular `d_nn + 1 mod 10` rule is *not* used, and s3.4.3 explains why.
2. **√2.** Lowest terms is a hypothesis, not a nicety: existence comes from `lem:lowest-terms-exist`
   (well-ordering), and the contradiction is `gcd(a,b) ≥ 2 ≠ 1`. Parity is proved from the
   definitions (`lem:parity`, `lem:odd-square-odd`), not assumed.
3. **Infinitely many primes.** Euclid's argument only claims `N` has a prime factor off the list;
   `N` itself need not be prime (s6.5 gives 30031 = 59 × 509). The `n = 0` case is disposed of
   separately (s1.3).
4. **Pythagoras.** The inner quadrilateral needs *both* four equal sides **and** four right angles;
   a rhombus of side `c` has area `c² sin θ`. Checkpoint cp1 exists precisely because this is the
   step picture proofs skip.
5. **Euler.** Two things are labelled rather than hidden: (a) flattening a convex polyhedron minus
   one face is the one genuinely geometric step (`lem:polyhedron-flattens`, s1.3), and (b) the
   terminal graph of the peeling process is a triangle *plus possibly dangling leaves*, each of which
   adds 1 to both `V` and `E`. s6 gives a projection-free alternative that instead leans on the
   Jordan curve theorem — also labelled (s6.3.1.2). Both proofs are honest about where topology
   enters; neither pretends to be purely combinatorial.
6. **Halting problem.** The Church–Turing thesis is an explicit axiom node (`ax:church-turing`)
   because the theorem is about Turing machines and the thesis is what extends it to "programs".
   `D` is not paradoxical on its own: if `H` does not exist then `D` does not exist either (cp1).

## 11. Lean 4 / Mathlib links (stretch goal)

Recorded per proof with an explicit `status`: `verified`, `candidate`, or `none`. **Nothing in the
library is marked `verified`** — the names and file paths were written from memory and have not been
checked against a pinned Mathlib commit, so they are flagged as candidates and the UI says so.
Euler's formula and the halting problem are marked `none` because Mathlib has no such statement (as
far as is known). Marking them `none` is deliberate: a guessed link is worse than an admitted gap.

## 12. Design

Ink on paper, one accent (deep green) and one signal colour (terracotta, used only for the "Why?"
control). Serif for all reading matter, sans-serif for chrome and labels. 17px / 1.75 body, 1.8 line
height inside proof steps. Depth is shown by indentation plus a fading vertical rule, never by boxes
inside boxes. Expand/collapse animates `grid-template-rows: 0fr → 1fr`, which is disabled under
`prefers-reduced-motion`.

## 13. Known gaps

- No auth on `/admin`; reviewer identity is self-declared.
- The dependency graph is a large SVG. It is keyboard-focusable and labelled, but a screen-reader
  user would prefer a table view of the same data. Not built.
- Some widget state changes are not announced in a live region; the conclusion is restated in
  adjacent text instead.
- `path_progress` has no user identity — progress is global per path, which is wrong for multi-user
  deployment.
- No MDX, no authoring UI: content changes require editing YAML and rebuilding.
- Widget coverage is one per proof; several steps that would benefit from a figure have none.

## 14. Repository and credentials

- The GitHub personal access token supplied in the task prompt was used **only** as an ephemeral
  credential for `git push`. It is not stored in any file in the repository, not committed to
  `.gitignore`d `.env`, and not embedded in build output. **It appeared in plaintext and should be
  rotated.**
- `.env` (which holds `DATABASE_URL`) is git-ignored.
- `next-env.d.ts` is committed so a fresh clone type-checks before the first build.

## 15. Current state of the acceptance criteria

| Criterion | Status |
| --- | --- |
| Every starter proof validates (no dangling references, no cycles) | ✅ 7/7, 0 errors, 0 warnings, 0 cycles |
| Each proof's deepest level relies only on stated definitions and axioms | ✅ 223/223 leaves grounded; depth 4 in all seven proofs |
| All proofs marked "pending human review" until approved in the admin view | ✅ default `pending`; approval revokes itself when content changes |

Run `npx tsx scripts/validate-content.ts` to re-check the first two at any time.
