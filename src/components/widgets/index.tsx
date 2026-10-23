"use client";

import { Sqrt2Ladder, EuclidPrimes, OddGnomons } from "./numeric";
import { PythagorasRearrange, CantorDiagonal, EulerPeel, HaltingOracle } from "./geometric";
import { MathHtml } from "@/components/MathHtml";
import type { RenderedStep } from "@/lib/content/serialize";

const COMPONENTS: Record<string, () => React.JSX.Element> = {
  "sqrt2-ladder": Sqrt2Ladder,
  "euclid-primes": EuclidPrimes,
  "odd-gnomons": OddGnomons,
  "pythagoras-rearrange": PythagorasRearrange,
  "cantor-diagonal": CantorDiagonal,
  "euler-peel": EulerPeel,
  "halting-oracle": HaltingOracle,
};

export function WidgetHost({ widget }: { widget: NonNullable<RenderedStep["widget"]> }) {
  const Component = COMPONENTS[widget.id];

  return (
    <div className="no-print my-4">
      {Component ? (
        <Component />
      ) : (
        <p className="rounded border border-danger/40 bg-danger-soft p-3 font-sans text-[0.8rem] text-danger">
          Unknown widget “{widget.id}” — the build-time validator should have caught this.
        </p>
      )}
      {widget.captionHtml ? (
        <div className="mt-2 border-l-2 border-rule-strong pl-3">
          <MathHtml html={widget.captionHtml} className="font-sans text-[0.82rem] text-muted" />
        </div>
      ) : null}
      {widget.controls ? (
        <p className="mt-1 font-sans text-[0.72rem] uppercase tracking-[0.1em] text-muted">{widget.controls}</p>
      ) : null}
    </div>
  );
}
