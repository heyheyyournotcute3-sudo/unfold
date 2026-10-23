import type { Metadata } from "next";
import Link from "next/link";

export const dynamic = "force-static";

export const metadata: Metadata = {
  title: "Keyboard and screen-reader notes",
  description: "How to drive the Unfold reader without a mouse, and what assistive technology receives.",
};

const KEYS: { keys: string[]; action: string; where: string }[] = [
  { keys: ["Tab"], action: "Move into the proof tree, then to the next control.", where: "everywhere" },
  { keys: ["↑", "↓"], action: "Move between the steps that are currently visible.", where: "proof reader" },
  { keys: ["→"], action: "Unfold the focused step. If it is already open, move to its first child.", where: "proof reader" },
  { keys: ["←"], action: "Collapse the focused step. If it is already closed, move to its parent.", where: "proof reader" },
  { keys: ["Enter", "Space"], action: "Toggle the “Why?” control on the focused step.", where: "proof reader" },
  { keys: ["Home", "End"], action: "Jump to the first / last visible step.", where: "proof reader" },
  { keys: ["←", "→"], action: "Scrub the rearrangement figure and the peeling viewer.", where: "widgets" },
  { keys: ["Home", "End"], action: "Jump to arrangement A / arrangement B.", where: "Pythagoras widget" },
  { keys: ["Shift", "click"], action: "Set a random digit instead of cycling it.", where: "Cantor grid" },
  { keys: ["Esc"], action: "Clear the search field.", where: "search" },
];

export default function KeyboardPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header>
        <p className="font-sans text-[0.7rem] uppercase tracking-[0.22em] text-muted">Accessibility</p>
        <h1 className="mt-3 text-[clamp(1.9rem,3.6vw,2.6rem)] font-semibold leading-tight tracking-tight text-ink">
          Keyboard and screen-reader notes
        </h1>
        <p className="mt-4 text-[1.02rem] leading-[1.85] text-ink-soft">
          Mathematics is usually the least accessible thing on a page: images of formulas, unlabelled
          canvases, and mouse-only interactions. Here is what this app does instead, and where it still
          falls short.
        </p>
      </header>

      <section>
        <h2 className="text-[1.35rem] font-semibold tracking-tight text-ink">Mathematics as text</h2>
        <p className="mt-3 leading-[1.85] text-ink-soft">
          Every formula is rendered by KaTeX with <code className="unfold-code">output: "htmlAndMathml"</code>
          at build time. That means each formula is real text in the DOM, paired with a MathML tree that
          screen readers can announce structurally — “square root of 2”, “a squared equals two b squared” —
          rather than an image with an alt attribute. The original TeX source is preserved in an{" "}
          <code className="unfold-code">annotation</code> element, so a reader who prefers Braille math or a
          different speech engine can recover it.
        </p>
        <p className="mt-3 leading-[1.85] text-ink-soft">
          KaTeX is never shipped to the browser: the HTML arrives pre-rendered, so a proof page costs no
          extra JavaScript for its mathematics.
        </p>
      </section>

      <section>
        <h2 className="text-[1.35rem] font-semibold tracking-tight text-ink">The proof tree</h2>
        <p className="mt-3 leading-[1.85] text-ink-soft">
          The reader is a real ARIA tree: <code className="unfold-code">role="tree"</code> with{" "}
          <code className="unfold-code">role="treeitem"</code> children,{" "}
          <code className="unfold-code">aria-expanded</code> on every unfoldable step,{" "}
          <code className="unfold-code">aria-level</code> for depth, and a roving tabindex so one Tab stop
          enters the whole proof. Collapsed subtrees are removed from the accessibility tree entirely, so a
          screen-reader user browsing at “Sketch” depth is not walked through hidden content.
        </p>
        <p className="mt-3 leading-[1.85] text-ink-soft">
          A live region announces how many steps are visible and how deep the focused step is; the
          breadcrumb above the tree names every ancestor of the focused step and each crumb is a button that
          moves focus there.
        </p>

        <table className="mt-5 w-full border-collapse font-sans text-[0.85rem]">
          <caption className="sr-only">Keyboard commands</caption>
          <thead>
            <tr className="border-b border-rule text-left text-[0.68rem] uppercase tracking-[0.12em] text-muted">
              <th scope="col" className="py-2 pr-3">Key</th>
              <th scope="col" className="py-2 pr-3">Action</th>
              <th scope="col" className="py-2">Scope</th>
            </tr>
          </thead>
          <tbody>
            {KEYS.map((row) => (
              <tr key={row.keys.join("+") + row.action} className="border-b border-rule/60 align-top">
                <td className="py-2 pr-3">
                  {row.keys.map((key) => (
                    <kbd key={key} className="mr-1 rounded border border-rule bg-panel px-1.5 py-0.5 text-[0.75rem] text-ink-soft">
                      {key}
                    </kbd>
                  ))}
                </td>
                <td className="py-2 pr-3 text-ink-soft">{row.action}</td>
                <td className="py-2 text-muted">{row.where}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-[1.35rem] font-semibold tracking-tight text-ink">Widgets</h2>
        <p className="mt-3 leading-[1.85] text-ink-soft">
          The interactive figures are SVG, not canvas, so their parts are addressable. Each widget is
          focusable and exposes an accessible name; the two sliders expose{" "}
          <code className="unfold-code">role="slider"</code> with <code className="unfold-code">aria-valuetext</code>{" "}
          (“arrangement A: leftover is a² plus b²”). Every widget also states its conclusion in adjacent
          text, so nothing essential lives only inside the picture.
        </p>
      </section>

      <section>
        <h2 className="text-[1.35rem] font-semibold tracking-tight text-ink">Motion, colour and contrast</h2>
        <ul className="mt-3 space-y-2 leading-[1.85] text-ink-soft">
          <li>· Expand/collapse is a height and opacity transition; <code className="unfold-code">prefers-reduced-motion</code> disables both, and the page then snaps open.</li>
          <li>· Status is never conveyed by colour alone: review states carry a symbol and a text label, checkpoint feedback says “correct” or “not quite” in words.</li>
          <li>· Focus is a 2px outline with a 2px offset, never removed.</li>
          <li>· The palette is ink on paper with a single accent; body text is 17px serif at 1.75 line height, and proof steps at 1.8.</li>
        </ul>
      </section>

      <section className="rounded-lg border border-flag/40 bg-flag-soft/60 p-5">
        <h2 className="font-sans text-[0.68rem] uppercase tracking-[0.16em] text-flag">Known gaps</h2>
        <ul className="mt-2 space-y-1.5 font-sans text-[0.85rem] leading-relaxed text-ink-soft">
          <li>· The dependency graph is a large SVG. It is keyboard reachable and labelled, but navigating 90+ nodes with a screen reader is tedious; a table view of the same graph would be better.</li>
          <li>· Widget state changes are not all announced politely; some rely on adjacent text you must re-read.</li>
          <li>· MathML quality depends on the reader's engine; NVDA + MathCAT and VoiceOver differ noticeably.</li>
        </ul>
        <p className="mt-3 font-sans text-[0.82rem] text-muted">
          These are recorded rather than hidden. See{" "}
          <Link href="/admin" className="text-accent underline underline-offset-2">
            the review console
          </Link>{" "}
          for the equivalent honesty about the mathematics.
        </p>
      </section>
    </div>
  );
}
