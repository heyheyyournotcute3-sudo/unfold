/**
 * Widget registry.
 *
 * A proof may only reference a widget that exists here; the validator rejects any
 * other id at build time. The actual React components live in
 * `src/components/widgets/index.tsx` and are keyed by the same id.
 */

export interface WidgetMeta {
  id: string;
  title: string;
  description: string;
  /** Keyboard hints rendered under the widget. */
  controls: string;
}

export const WIDGETS: Record<string, WidgetMeta> = {
  "sqrt2-ladder": {
    id: "sqrt2-ladder",
    title: "The ladder of near misses",
    description:
      "Integer pairs (a, b) with a/b close to √2. The gap a² − 2b² shrinks relative to b² but never reaches 0.",
    controls: "Drag the sliders, or focus them and use ← → to move.",
  },
  "euclid-primes": {
    id: "euclid-primes",
    title: "Euclid's number",
    description:
      "Choose any finite set of primes. The widget computes N = (product) + 1 and finds its smallest prime factor, which is never one of the chosen primes.",
    controls: "Toggle primes with the buttons or Space; recompute with Enter.",
  },
  "odd-gnomons": {
    id: "odd-gnomons",
    title: "Gnomon builder",
    description:
      "Add L-shaped gnomons one at a time. The k-th gnomon has 2k − 1 cells and completes the k × k square.",
    controls: "Drag the slider or use ← → to add and remove gnomons.",
  },
  "pythagoras-rearrange": {
    id: "pythagoras-rearrange",
    title: "Rearrangement: a² + b² ↔ c²",
    description:
      "Four congruent right triangles slide continuously between arrangement A (leaving squares of area a² and b²) and arrangement B (leaving a square of area c²).",
    controls: "Drag anywhere in the figure, or focus it and use ← → / Home / End.",
  },
  "cantor-diagonal": {
    id: "cantor-diagonal",
    title: "Diagonal grid",
    description:
      "An editable grid of decimal digits. The diagonal is highlighted and the constructed number x is rebuilt live by the 4/5 rule.",
    controls: "Click a cell to cycle its digit; use Shuffle to randomise the list.",
  },
  "euler-peel": {
    id: "euler-peel",
    title: "Peeling a triangulated plane graph",
    description:
      "Step through the ear-removal algorithm. The counters V, E, F and V − E + F update after every removal.",
    controls: "Use the Step / Reset buttons, or ← → when the widget has focus.",
  },
  "halting-oracle": {
    id: "halting-oracle",
    title: "The oracle and the inverter",
    description:
      "Trace D(⟨D⟩): assume what the oracle H answers, watch the inverter flip it, and see the assumption contradict the outcome.",
    controls: "Choose an assumption with the two buttons, or with ← →.",
  },
};

export const WIDGET_IDS = Object.keys(WIDGETS);
