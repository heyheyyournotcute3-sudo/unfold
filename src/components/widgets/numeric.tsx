"use client";

import { useMemo, useState } from "react";

/* ------------------------------------------------------------------ helpers */

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

function Panel({
  title,
  children,
  note,
}: {
  title: string;
  children: React.ReactNode;
  note?: string;
}) {
  return (
    <div className="rounded-lg border border-rule bg-panel p-4">
      <p className="font-sans text-[0.7rem] uppercase tracking-[0.14em] text-muted">{title}</p>
      <div className="mt-3">{children}</div>
      {note ? <p className="mt-3 font-sans text-[0.78rem] leading-relaxed text-muted">{note}</p> : null}
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  display?: string;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline justify-between font-sans text-[0.78rem] text-ink-soft">
        <span>{label}</span>
        <span className="tabular text-muted">{display ?? value}</span>
      </span>
      <input
        className="unfold-range mt-1 w-full"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

/* ------------------------------------------------------- 1. sqrt2 ladder */

const SQRT2_APPROX: [number, number][] = [
  [1, 1],
  [3, 2],
  [7, 5],
  [17, 12],
  [41, 29],
  [99, 70],
];

export function Sqrt2Ladder() {
  const [a, setA] = useState(7);
  const [b, setB] = useState(5);

  const ratio = a / b;
  const gap = a * a - 2 * b * b;
  const relError = Math.abs(ratio - Math.SQRT2) / Math.SQRT2;

  const width = 520;
  const height = 96;
  const lo = 1.2;
  const hi = 1.6;
  const x = (v: number) => ((clamp(v, lo, hi) - lo) / (hi - lo)) * (width - 40) + 20;

  return (
    <Panel title="The ladder of near misses" note="a and b are integers. The gap a² − 2b² is an integer, so it can be ±1, ±2, … but never 0 — that is the whole theorem, drawn.">
      <div className="grid gap-4 sm:grid-cols-2">
        <Slider label="a (numerator)" value={a} min={1} max={60} onChange={setA} />
        <Slider label="b (denominator)" value={b} min={1} max={60} onChange={setB} />
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 w-full" role="img" aria-label={`Number line near the square root of 2, with a marker at ${ratio.toFixed(4)}`}>
        <line x1={20} y1={54} x2={width - 20} y2={54} stroke="#cfc8b8" strokeWidth={1.5} />
        {[1.2, 1.3, Math.SQRT2, 1.5, 1.6].map((tick) => (
          <g key={tick}>
            <line x1={x(tick)} y1={48} x2={x(tick)} y2={60} stroke={Math.abs(tick - Math.SQRT2) < 1e-9 ? "#1d6a58" : "#cfc8b8"} strokeWidth={Math.abs(tick - Math.SQRT2) < 1e-9 ? 2 : 1} />
            <text x={x(tick)} y={78} textAnchor="middle" fontSize={11} fill={Math.abs(tick - Math.SQRT2) < 1e-9 ? "#1d6a58" : "#7d766b"} fontFamily="ui-sans-serif, system-ui">
              {Math.abs(tick - Math.SQRT2) < 1e-9 ? "√2 ≈ 1.41421" : tick.toFixed(1)}
            </text>
          </g>
        ))}
        <g>
          <circle cx={x(ratio)} cy={54} r={6} fill="#a4522c" />
          <text x={x(ratio)} y={32} textAnchor="middle" fontSize={12} fill="#a4522c" fontFamily="ui-sans-serif, system-ui">
            {a}/{b} = {ratio.toFixed(5)}
          </text>
        </g>
      </svg>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 font-sans text-[0.82rem] sm:grid-cols-4">
        <div>
          <dt className="text-muted">a² − 2b²</dt>
          <dd className="tabular text-lg text-ink">{gap > 0 ? `+${gap}` : gap}</dd>
        </div>
        <div>
          <dt className="text-muted">relative error</dt>
          <dd className="tabular text-lg text-ink">{relError.toExponential(2)}</dd>
        </div>
        <div>
          <dt className="text-muted">a² and 2b²</dt>
          <dd className="tabular text-lg text-ink">
            {a * a} vs {2 * b * b}
          </dd>
        </div>
        <div>
          <dt className="text-muted">parity of a²</dt>
          <dd className="text-lg text-ink">{a * a % 2 === 0 ? "even" : "odd"}</dd>
        </div>
      </dl>

      <div className="mt-4 flex flex-wrap items-center gap-2 font-sans text-[0.78rem]">
        <span className="text-muted">Classic rungs:</span>
        {SQRT2_APPROX.map(([pa, pb]) => (
          <button
            key={`${pa}/${pb}`}
            type="button"
            onClick={() => {
              setA(pa);
              setB(pb);
            }}
            className={`rounded border px-2 py-1 tabular transition-colors ${
              pa === a && pb === b ? "border-accent bg-accent-soft text-accent" : "border-rule bg-panel-alt text-ink-soft hover:border-accent"
            }`}
          >
            {pa}/{pb}
          </button>
        ))}
      </div>
      <p className="mt-3 font-sans text-[0.8rem] text-flare" role="status">
        {gap === 0 ? "a² = 2b² — impossible for integers." : `Never zero: the closest an integer pair gets here is |a² − 2b²| = ${Math.abs(gap)}.`}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------- 2. Euclid's number */

const FIRST_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29];

const TWO = BigInt(2);
const THREE = BigInt(3);
const ONE = BigInt(1);
const ZERO = BigInt(0);

function smallestPrimeFactor(n: bigint): bigint | null {
  if (n % TWO === ZERO) return TWO;
  let d = THREE;
  while (d * d <= n) {
    if (n % d === ZERO) return d;
    d += TWO;
  }
  return n > ONE ? n : null;
}

export function EuclidPrimes() {
  const [chosen, setChosen] = useState<number[]>([2, 3, 5]);

  const { product, N, factor, remainders } = useMemo(() => {
    const prod = chosen.reduce((acc, p) => acc * BigInt(p), ONE);
    const value = prod + ONE;
    return {
      product: prod,
      N: value,
      factor: smallestPrimeFactor(value),
      remainders: chosen.map((p) => ({ p, r: Number(value % BigInt(p)) })),
    };
  }, [chosen]);

  const toggle = (p: number) =>
    setChosen((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p].sort((x, y) => x - y)));

  const tooBig = chosen.length > 8;

  return (
    <Panel
      title="Euclid's number"
      note="Pick any finite set of primes. N = (their product) + 1 leaves remainder 1 on division by each of them, so none of them divides N — yet N > 1 must have some prime factor."
    >
      <div className="flex flex-wrap gap-2 font-sans text-[0.82rem]" role="group" aria-label="Choose primes for the list">
        {FIRST_PRIMES.map((p) => {
          const on = chosen.includes(p);
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(p)}
              className={`tabular rounded border px-2.5 py-1 transition-colors ${
                on ? "border-accent bg-accent text-white" : "border-rule bg-panel-alt text-ink-soft hover:border-accent"
              }`}
            >
              {p}
            </button>
          );
        })}
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="rounded border border-rule bg-panel-alt p-3">
          <p className="font-sans text-[0.72rem] uppercase tracking-[0.12em] text-muted">Product Π</p>
          <p className="tabular mt-1 break-all text-[0.95rem]">{chosen.length ? product.toString() : "1 (empty product)"}</p>
          <p className="font-sans text-[0.72rem] uppercase tracking-[0.12em] text-muted mt-3">N = Π + 1</p>
          <p className="tabular mt-1 break-all text-[1.05rem] text-flare">{N.toString()}</p>
        </div>
        <div className="rounded border border-rule bg-panel-alt p-3">
          <p className="font-sans text-[0.72rem] uppercase tracking-[0.12em] text-muted">Remainders N mod p</p>
          <ul className="mt-2 space-y-1 font-sans text-[0.82rem]">
            {remainders.length === 0 ? <li className="text-muted">No primes chosen.</li> : null}
            {remainders.map(({ p, r }) => (
              <li key={p} className="tabular flex justify-between border-b border-rule/60 pb-1">
                <span>N mod {p}</span>
                <span className={r === 1 ? "text-accent" : "text-danger"}>{r}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <p className="mt-4 font-sans text-[0.85rem]" role="status">
        {tooBig ? (
          <span className="text-muted">N is too large to factor in the browser — choose 8 primes or fewer.</span>
        ) : factor ? (
          <>
            Smallest prime factor of N: <strong className="tabular text-accent">{factor.toString()}</strong>.{" "}
            <span className="text-ink-soft">
              {chosen.includes(Number(factor))
                ? "On your list — which cannot happen, because every listed prime leaves remainder 1."
                : "Not on your list. That is the new prime Euclid promises."}
            </span>
            {factor * factor === N ? " (N is itself prime here.)" : ` N = ${factor} × ${(N / factor).toString()}.`}
          </>
        ) : (
          <span className="text-muted">Choose at least one prime.</span>
        )}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------- 3. odd gnomons */

export function OddGnomons() {
  const [n, setN] = useState(4);
  const cell = 26;
  const size = n * cell + 24;
  const cells = useMemo(() => {
    const out: { x: number; y: number; k: number }[] = [];
    for (let k = 1; k <= n; k += 1) {
      for (let i = 0; i < k; i += 1) {
        out.push({ x: i, y: k - 1, k });
        if (i !== k - 1) out.push({ x: k - 1, y: i, k });
      }
    }
    return out;
  }, [n]);

  const palette = ["#1d6a58", "#a4522c", "#4a6fa5", "#7d6a9e", "#8a7a1f", "#2f7d6e", "#a8553f", "#55637d", "#946b2e"];

  return (
    <Panel
      title="Gnomon builder"
      note={`The k-th gnomon adds exactly 2k − 1 cells: a row of k and a column of k sharing the corner. Total after n gnomons: n² = ${n * n}.`}
    >
      <Slider label="Gnomons placed" value={n} min={1} max={8} onChange={setN} display={`${n} (total ${n * n} cells)`} />
      <svg viewBox={`0 0 ${size} ${size}`} className="mt-3 w-full max-w-md" role="img" aria-label={`A ${n} by ${n} square built from ${n} L-shaped gnomons`}>
        {cells.map(({ x, y, k }) => (
          <rect
            key={`${x}-${y}`}
            x={12 + x * cell}
            y={12 + y * cell}
            width={cell - 2}
            height={cell - 2}
            rx={2}
            fill={palette[(k - 1) % palette.length]}
            fillOpacity={0.28}
            stroke={palette[(k - 1) % palette.length]}
            strokeWidth={1.2}
          />
        ))}
        <text x={size / 2} y={size - 1} textAnchor="middle" fontSize={11} fill="#7d766b" fontFamily="ui-sans-serif, system-ui">
          {n} × {n} = {n * n}
        </text>
      </svg>
      <ul className="mt-3 flex flex-wrap gap-2 font-sans text-[0.78rem]">
        {Array.from({ length: n }, (_, i) => i + 1).map((k) => (
          <li key={k} className="tabular rounded border border-rule bg-panel-alt px-2 py-1">
            <span style={{ color: palette[(k - 1) % palette.length] }}>■</span> gnomon {k}: {2 * k - 1} cells
          </li>
        ))}
      </ul>
    </Panel>
  );
}

export type NumericWidgetId = "sqrt2-ladder" | "euclid-primes" | "odd-gnomons";

