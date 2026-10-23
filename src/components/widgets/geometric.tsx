"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/* ============================================== 4. Pythagoras rearrangement */

interface Tri {
  ra: [number, number];
  pa: [number, number];
  pb: [number, number];
}

function arrangements(a: number, b: number): { A: Tri[]; B: Tri[]; S: number } {
  const S = a + b;
  // Arrangement A: two axis-aligned squares (side a top-left, side b bottom-right)
  // plus the two leftover rectangles each cut along a diagonal.
  const A: Tri[] = [
    { ra: [0, 0], pa: [a, 0], pb: [0, b] },
    { ra: [a, b], pa: [0, b], pb: [a, 0] },
    { ra: [a + b, b], pa: [a, b], pb: [a + b, a + b] },
    { ra: [a, a + b], pa: [a + b, a + b], pb: [a, b] },
  ];
  // Arrangement B: pinwheel, one triangle per corner of the same outer square.
  const B: Tri[] = [
    { ra: [0, 0], pa: [a, 0], pb: [0, b] },
    { ra: [a + b, 0], pa: [a + b, a], pb: [a, 0] },
    { ra: [a + b, a + b], pa: [b, a + b], pb: [a + b, a] },
    { ra: [0, a + b], pa: [0, b], pb: [b, a + b] },
  ];
  return { A, B, S };
}

function rot(p: [number, number], angle: number): [number, number] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}

function diffAngle(from: [number, number], to: [number, number]): number {
  const a0 = Math.atan2(from[1], from[0]);
  const a1 = Math.atan2(to[1], to[0]);
  let d = a1 - a0;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

/** Rigid interpolation: every intermediate triangle is congruent to the original. */
function interpolate(A: Tri[], B: Tri[], t: number): [number, number][][] {
  return A.map((tri, i) => {
    const target = B[i];
    const legA: [number, number] = [tri.pa[0] - tri.ra[0], tri.pa[1] - tri.ra[1]];
    const legB: [number, number] = [target.pa[0] - target.ra[0], target.pa[1] - target.ra[1]];
    const delta = diffAngle(legA, legB);
    const anchor: [number, number] = [tri.ra[0] + (target.ra[0] - tri.ra[0]) * t, tri.ra[1] + (target.ra[1] - tri.ra[1]) * t];
    return ([tri.ra, tri.pa, tri.pb] as [number, number][]).map((v) => {
      const local: [number, number] = [v[0] - tri.ra[0], v[1] - tri.ra[1]];
      const turned = rot(local, delta * t);
      return [turned[0] + anchor[0], turned[1] + anchor[1]] as [number, number];
    });
  });
}

const FILL = ["#1d6a58", "#a4522c", "#4a6fa5", "#7d6a9e"];

export function PythagorasRearrange() {
  const [a, setA] = useState(3);
  const [b, setB] = useState(4);
  const [t, setT] = useState(0);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ startX: number; startT: number } | null>(null);

  const { A, B, S } = useMemo(() => arrangements(a, b), [a, b]);
  const c = Math.sqrt(a * a + b * b);
  const box = 340;
  const pad = 20;
  const scale = (box - pad * 2) / S;
  const px = (v: [number, number]): [number, number] => [pad + v[0] * scale, pad + (S - v[1]) * scale];
  const polys = useMemo(() => interpolate(A, B, t).map((tri) => tri.map(px)), [A, B, t, scale, S]);

  const squares = [
    { pts: ([[0, b], [a, b], [a, S], [0, S]] as [number, number][]).map(px), label: `a² = ${a * a}` },
    { pts: ([[a, 0], [S, 0], [S, b], [a, b]] as [number, number][]).map(px), label: `b² = ${b * b}` },
  ];
  const inner = ([[a, 0], [S, a], [b, S], [0, b]] as [number, number][]).map(px);

  const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
    dragRef.current = { startX: event.clientX, startT: t };
    (event.target as Element).setPointerCapture?.(event.pointerId);
  };
  const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
    if (!dragRef.current) return;
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    const delta = (event.clientX - dragRef.current.startX) / rect.width;
    setT(clamp(dragRef.current.startT + delta, 0, 1));
  };
  const onPointerUp = () => {
    dragRef.current = null;
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setT((prev) => clamp(prev + 0.05, 0, 1));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setT((prev) => clamp(prev - 0.05, 0, 1));
    } else if (event.key === "Home") {
      event.preventDefault();
      setT(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setT(1);
    }
  };

  return (
    <div className="rounded-lg border border-rule bg-panel p-4">
      <p className="font-sans text-[0.7rem] uppercase tracking-[0.14em] text-muted">
        Rearrangement: drag between the two arrangements
      </p>
      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_220px]">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${box} ${box}`}
          className="w-full touch-none select-none rounded border border-rule bg-panel-alt"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onKeyDown={onKeyDown}
          tabIndex={0}
          role="slider"
          aria-label="Interpolation between arrangement A and arrangement B"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(t * 100)}
          aria-valuetext={t < 0.5 ? "arrangement A: leftover is a² plus b²" : "arrangement B: leftover is c²"}
        >
          <rect x={pad} y={pad} width={S * scale} height={S * scale} fill="none" stroke="#cfc8b8" strokeWidth={1.5} />
          {squares.map((sq, i) => (
            <g key={i} opacity={clamp(1 - t * 1.6, 0, 1)}>
              <polygon points={sq.pts.map((p) => p.join(",")).join(" ")} fill="#1d6a58" fillOpacity={0.16} stroke="#1d6a58" strokeOpacity={0.5} strokeDasharray="3 3" />
              <text
                x={(sq.pts[0][0] + sq.pts[2][0]) / 2}
                y={(sq.pts[0][1] + sq.pts[2][1]) / 2}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={12}
                fill="#1d6a58"
                fontFamily="ui-sans-serif, system-ui"
              >
                {sq.label}
              </text>
            </g>
          ))}
          <g opacity={clamp(t * 1.6 - 0.4, 0, 1)}>
            <polygon points={inner.map((p) => p.join(",")).join(" ")} fill="#a4522c" fillOpacity={0.18} stroke="#a4522c" strokeOpacity={0.6} strokeDasharray="3 3" />
            <text
              x={box / 2}
              y={box / 2}
              textAnchor="middle"
              dominantBaseline="middle"
              fontSize={13}
              fill="#a4522c"
              fontFamily="ui-sans-serif, system-ui"
            >
              c² ≈ {(c * c).toFixed(1)}
            </text>
          </g>
          {polys.map((tri, i) => (
            <polygon
              key={i}
              points={tri.map((p) => p.join(",")).join(" ")}
              fill={FILL[i]}
              fillOpacity={0.3}
              stroke={FILL[i]}
              strokeWidth={1.6}
            />
          ))}
        </svg>

        <div className="space-y-3">
          <label className="block">
            <span className="flex justify-between font-sans text-[0.78rem] text-ink-soft">
              <span>leg a</span>
              <span className="tabular text-muted">{a}</span>
            </span>
            <input className="unfold-range mt-1 w-full" type="range" min={2} max={5} step={1} value={a} aria-label="leg a" onChange={(e) => setA(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="flex justify-between font-sans text-[0.78rem] text-ink-soft">
              <span>leg b</span>
              <span className="tabular text-muted">{b}</span>
            </span>
            <input className="unfold-range mt-1 w-full" type="range" min={2} max={5} step={1} value={b} aria-label="leg b" onChange={(e) => setB(Number(e.target.value))} />
          </label>
          <label className="block">
            <span className="flex justify-between font-sans text-[0.78rem] text-ink-soft">
              <span>arrangement</span>
              <span className="tabular text-muted">{t < 0.34 ? "A" : t > 0.66 ? "B" : "in motion"}</span>
            </span>
            <input className="unfold-range mt-1 w-full" type="range" min={0} max={1} step={0.01} value={t} aria-label="Interpolation between arrangements" onChange={(e) => setT(Number(e.target.value))} />
          </label>
          <dl className="rounded border border-rule bg-panel-alt p-3 font-sans text-[0.8rem]">
            <div className="flex justify-between">
              <dt className="text-muted">leftover in A</dt>
              <dd className="tabular">{a * a} + {b * b} = {a * a + b * b}</dd>
            </div>
            <div className="mt-1 flex justify-between">
              <dt className="text-muted">leftover in B</dt>
              <dd className="tabular">c² = {(c * c).toFixed(0)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-rule pt-1">
              <dt className="text-muted">four triangles</dt>
              <dd className="tabular">4 · ab/2 = {2 * a * b}</dd>
            </div>
            <div className="mt-1 flex justify-between">
              <dt className="text-muted">outer square</dt>
              <dd className="tabular">(a+b)² = {S * S}</dd>
            </div>
          </dl>
          <p className="font-sans text-[0.76rem] leading-relaxed text-muted">
            The four triangles move rigidly, so they stay congruent throughout. Only the leftover
            region changes shape — which is the entire argument.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ================================================== 5. Cantor diagonal grid */

const ROWS = 7;
const COLS = 10;

function seededGrid(seed: number): number[][] {
  let s = seed;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  return Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => Math.floor(rand() * 10)));
}

export function CantorDiagonal() {
  const [seed, setSeed] = useState(7);
  const [grid, setGrid] = useState<number[][]>(() => seededGrid(7));
  const [revealed, setRevealed] = useState(false);

  const xDigits = useMemo(() => grid.map((row, i) => (row[i] === 5 ? 4 : 5)), [grid]);

  const cycle = (r: number, c: number, shift: boolean) => {
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = shift ? Math.floor(Math.random() * 10) : (next[r][c] + 1) % 10;
      return next;
    });
    setRevealed(true);
  };

  return (
    <div className="rounded-lg border border-rule bg-panel p-4">
      <p className="font-sans text-[0.7rem] uppercase tracking-[0.14em] text-muted">Diagonal grid</p>
      <p className="mt-2 font-sans text-[0.82rem] text-ink-soft">
        Row <em>n</em> lists the digits of <em>f</em>(<em>n</em>). Click a cell to change that digit
        (shift-click for a random one). The shaded diagonal drives the construction of <em>x</em>.
      </p>

      <div className="mt-3 overflow-x-auto">
        <table className="border-collapse font-mono text-[0.8rem]">
          <thead>
            <tr>
              <th className="px-2 py-1 text-left font-sans text-[0.7rem] uppercase tracking-wide text-muted">n</th>
              {Array.from({ length: COLS }, (_, i) => (
                <th key={i} className="px-1 py-1 text-center font-sans text-[0.68rem] text-muted">
                  {i + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.map((row, r) => (
              <tr key={r}>
                <td className="px-2 py-0.5 text-left font-sans text-[0.72rem] text-muted">f({r + 1})</td>
                {row.map((digit, c) => {
                  const onDiagonal = r === c;
                  return (
                    <td key={c} className="p-0">
                      <button
                        type="button"
                        onClick={(event) => cycle(r, c, event.shiftKey)}
                        aria-label={`Digit ${digit} in row ${r + 1}, column ${c + 1}${onDiagonal ? " (on the diagonal)" : ""}`}
                        className={`tabular h-7 w-7 border transition-colors ${
                          onDiagonal
                            ? "border-flare bg-flare-soft font-semibold text-flare"
                            : "border-rule bg-panel-alt text-ink-soft hover:border-accent"
                        }`}
                      >
                        {digit}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr>
              <td className="px-2 py-1 text-left font-sans text-[0.72rem] text-accent">x</td>
              {xDigits.map((digit, i) => (
                <td key={i} className="p-0">
                  <span
                    className={`tabular flex h-7 w-7 items-center justify-center border border-accent bg-accent-soft font-semibold text-accent ${
                      revealed ? "reveal-fade" : ""
                    }`}
                  >
                    {digit}
                  </span>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 font-sans text-[0.8rem]">
        <button
          type="button"
          className="rounded border border-rule bg-panel-alt px-3 py-1.5 text-ink-soft transition-colors hover:border-accent hover:text-accent"
          onClick={() => {
            const next = Math.floor(Math.random() * 100000) + 1;
            setSeed(next);
            setGrid(seededGrid(next));
            setRevealed(true);
          }}
        >
          Shuffle the list
        </button>
        <button
          type="button"
          className="rounded border border-rule bg-panel-alt px-3 py-1.5 text-ink-soft transition-colors hover:border-accent hover:text-accent"
          onClick={() => {
            setGrid(seededGrid(seed));
            setRevealed(false);
          }}
        >
          Reset
        </button>
        <span className="text-muted" role="status">
          x = 0.{xDigits.join("")}… — digits only 4 and 5, so x ends in neither all 9s nor all 0s.
        </span>
      </div>

      <ul className="mt-3 space-y-1 font-sans text-[0.78rem] text-ink-soft">
        {xDigits.map((digit, i) => (
          <li key={i} className="tabular">
            row {i + 1}: d<sub>{i + 1}{i + 1}</sub> = <span className="text-flare">{grid[i][i]}</span>, x<sub>{i + 1}</sub> ={" "}
            <span className="text-accent">{digit}</span> → x ≠ f({i + 1})
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ================================================= 6. Euler peeling viewer */

type Pt = [number, number];
type Edge = [string, string];

interface PeelInput {
  id: string;
  label: string;
  positions: Record<string, Pt>;
  edges: Edge[];
  faces: [string, string, string][];
}

interface PeelMove {
  kind: "A" | "B" | "leaf";
  label: string;
  removedEdges: Edge[];
  removedVertex?: string;
  removedFace?: [string, string, string];
  edges: Edge[];
  faces: [string, string, string][];
  removed: string[];
}

const edgeKey = (e: Edge) => (e[0] < e[1] ? `${e[0]}|${e[1]}` : `${e[1]}|${e[0]}`);
const faceEdges = (f: [string, string, string]): Edge[] => [
  [f[0], f[1]],
  [f[1], f[2]],
  [f[2], f[0]],
];

function computePeel(input: PeelInput): PeelMove[] {
  let edges: Edge[] = input.edges.map((e) => [e[0], e[1]] as Edge);
  let faces: [string, string, string][] = input.faces.map((f) => [f[0], f[1], f[2]]);
  const removed: string[] = [];
  const moves: PeelMove[] = [];

  const boundaryKeys = (): Set<string> => {
    const counts = new Map<string, number>();
    for (const face of faces) {
      for (const e of faceEdges(face)) {
        const k = edgeKey(e);
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return new Set([...counts.entries()].filter(([, n]) => n === 1).map(([k]) => k));
  };

  let guard = 0;
  while (faces.length > 1 && guard < 40) {
    guard += 1;
    const bounds = boundaryKeys();
    let pick: { face: [string, string, string]; shared: Edge[]; kind: "A" | "B" } | null = null;

    for (const face of faces) {
      const shared = faceEdges(face).filter((e) => bounds.has(edgeKey(e)));
      if (shared.length >= 2) {
        pick = { face, shared: shared.slice(0, 2), kind: "B" };
        break;
      }
    }
    if (!pick) {
      for (const face of faces) {
        const shared = faceEdges(face).filter((e) => bounds.has(edgeKey(e)));
        if (shared.length === 1) {
          pick = { face, shared, kind: "A" };
          break;
        }
      }
    }
    if (!pick) break;

    if (pick.kind === "B") {
      const sharedKeys = new Set(pick.shared.map(edgeKey));
      const tip = pick.face.find((v) => !pick!.shared.some((e) => e[0] === v || e[1] === v));
      const removedEdges = edges.filter((e) => sharedKeys.has(edgeKey(e)) || (tip !== undefined && (e[0] === tip || e[1] === tip)));
      edges = edges.filter((e) => !removedEdges.some((r) => edgeKey(r) === edgeKey(e)));
      if (tip) removed.push(tip);
      faces = faces.filter((f) => f !== pick!.face);
      moves.push({
        kind: "B",
        label: `Ear at ${tip ?? "?"}: remove 2 boundary edges and the tip vertex (V−1, E−2, F−1)`,
        removedEdges,
        removedVertex: tip,
        removedFace: pick.face,
        edges: [...edges],
        faces: [...faces],
        removed: [...removed],
      });
    } else {
      const key = edgeKey(pick.shared[0]);
      const removedEdges = edges.filter((e) => edgeKey(e) === key);
      edges = edges.filter((e) => edgeKey(e) !== key);
      faces = faces.filter((f) => f !== pick!.face);
      moves.push({
        kind: "A",
        label: `Boundary edge ${pick.shared[0][0]}–${pick.shared[0][1]}: remove the edge only (E−1, F−1)`,
        removedEdges,
        removedFace: pick.face,
        edges: [...edges],
        faces: [...faces],
        removed: [...removed],
      });
    }
  }

  // Prune dangling leaves until the single bounded face's triangle is all that is left.
  guard = 0;
  while (guard < 40) {
    guard += 1;
    const alive = Object.keys(input.positions).filter((v) => !removed.includes(v));
    if (alive.length <= 3) break;
    const degree = new Map<string, number>();
    for (const e of edges) {
      degree.set(e[0], (degree.get(e[0]) ?? 0) + 1);
      degree.set(e[1], (degree.get(e[1]) ?? 0) + 1);
    }
    const leaf = alive.find((v) => (degree.get(v) ?? 0) === 1);
    if (!leaf) break;
    const removedEdges = edges.filter((e) => e[0] === leaf || e[1] === leaf);
    edges = edges.filter((e) => e[0] !== leaf && e[1] !== leaf);
    removed.push(leaf);
    moves.push({
      kind: "leaf",
      label: `Prune leaf ${leaf}: removing a degree-1 vertex and its edge changes V and E together (V−1, E−1)`,
      removedEdges,
      removedVertex: leaf,
      edges: [...edges],
      faces: [...faces],
      removed: [...removed],
    });
  }

  return moves;
}

const PRESETS: PeelInput[] = [
  {
    id: "fan",
    label: "Interior vertex (only case A)",
    positions: { A: [40, 150], B: [90, 255], C: [215, 255], D: [265, 150], E: [150, 55], X: [150, 170] },
    edges: [
      ["A", "B"],
      ["B", "C"],
      ["C", "D"],
      ["D", "E"],
      ["E", "A"],
      ["X", "A"],
      ["X", "B"],
      ["X", "C"],
      ["X", "D"],
      ["X", "E"],
    ],
    faces: [
      ["A", "B", "X"],
      ["B", "C", "X"],
      ["C", "D", "X"],
      ["D", "E", "X"],
      ["E", "A", "X"],
    ],
  },
  {
    id: "quad",
    label: "Triangulated quadrilateral (ears)",
    positions: { A: [50, 230], B: [150, 265], C: [265, 195], D: [140, 60] },
    edges: [
      ["A", "B"],
      ["B", "C"],
      ["C", "D"],
      ["D", "A"],
      ["A", "C"],
    ],
    faces: [
      ["A", "B", "C"],
      ["A", "C", "D"],
    ],
  },
  {
    id: "hex",
    label: "Triangulated hexagon (mixed)",
    positions: { A: [40, 150], B: [110, 250], C: [220, 255], D: [285, 160], E: [210, 60], F: [95, 55] },
    edges: [
      ["A", "B"],
      ["B", "C"],
      ["C", "D"],
      ["D", "E"],
      ["E", "F"],
      ["F", "A"],
      ["A", "C"],
      ["A", "D"],
      ["A", "E"],
    ],
    faces: [
      ["A", "B", "C"],
      ["A", "C", "D"],
      ["A", "D", "E"],
      ["A", "E", "F"],
    ],
  },
];

export function EulerPeel() {
  const [presetId, setPresetId] = useState("hex");
  const preset = PRESETS.find((p) => p.id === presetId) ?? PRESETS[0];
  const moves = useMemo(() => computePeel(preset), [preset]);
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(0);
  }, [presetId]);

  const state = step === 0 ? { edges: preset.edges, faces: preset.faces, removed: [] as string[] } : moves[step - 1];
  const next = moves[step];
  const alive = Object.keys(preset.positions).filter((v) => !state.removed.includes(v));
  const V = alive.length;
  const E = state.edges.length;
  const F = state.faces.length + 1;
  const chi = V - E + F;

  const removedEdgeKeys = new Set((next?.removedEdges ?? []).map(edgeKey));
  const nextFace = next?.removedFace;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      setStep((s) => clamp(s + 1, 0, moves.length));
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      setStep((s) => clamp(s - 1, 0, moves.length));
    }
  };

  return (
    <div className="rounded-lg border border-rule bg-panel p-4" onKeyDown={onKeyDown} tabIndex={0} role="group" aria-label="Euler characteristic peeling viewer">
      <p className="font-sans text-[0.7rem] uppercase tracking-[0.14em] text-muted">Peeling a plane graph</p>

      <div className="mt-3 flex flex-wrap gap-2 font-sans text-[0.78rem]">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPresetId(p.id)}
            className={`rounded border px-2.5 py-1 transition-colors ${
              p.id === presetId ? "border-accent bg-accent-soft text-accent" : "border-rule bg-panel-alt text-ink-soft hover:border-accent"
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_260px]">
        <svg viewBox="0 0 320 300" className="w-full rounded border border-rule bg-panel-alt">
          {state.faces.map((face, i) => {
            const pts = face.map((v) => preset.positions[v]);
            const isNext = nextFace === face || (next?.kind !== undefined && state.faces.length > 1 && i === 0 && moves.findIndex((m) => m.removedFace === face) === step);
            return (
              <polygon
                key={i}
                points={pts.map((p) => p.join(",")).join(" ")}
                fill={isNext ? "#a4522c" : "#1d6a58"}
                fillOpacity={isNext ? 0.22 : 0.1}
                stroke="none"
              />
            );
          })}
          {state.edges.map((e, i) => {
            const p1 = preset.positions[e[0]];
            const p2 = preset.positions[e[1]];
            const doomed = removedEdgeKeys.has(edgeKey(e));
            return (
              <line
                key={i}
                x1={p1[0]}
                y1={p1[1]}
                x2={p2[0]}
                y2={p2[1]}
                stroke={doomed ? "#a4522c" : "#46413a"}
                strokeWidth={doomed ? 2.6 : 1.6}
                strokeDasharray={doomed ? "4 3" : undefined}
              />
            );
          })}
          {alive.map((v) => {
            const p = preset.positions[v];
            const doomed = next?.removedVertex === v;
            return (
              <g key={v}>
                <circle cx={p[0]} cy={p[1]} r={doomed ? 8 : 6} fill={doomed ? "#a4522c" : "#fffdf8"} stroke={doomed ? "#a4522c" : "#46413a"} strokeWidth={1.6} />
                <text x={p[0]} y={p[1] - 12} textAnchor="middle" fontSize={11} fill="#7d766b" fontFamily="ui-sans-serif, system-ui">
                  {v}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2 font-sans text-[0.8rem]">
            {[
              { label: "V", value: V },
              { label: "E", value: E },
              { label: "F", value: F },
              { label: "χ", value: chi, accent: true },
            ].map((cell) => (
              <div key={cell.label} className={`rounded border p-2 text-center ${cell.accent ? "border-accent bg-accent-soft" : "border-rule bg-panel-alt"}`}>
                <p className="text-[0.68rem] uppercase tracking-wide text-muted">{cell.label}</p>
                <p className={`tabular text-lg ${cell.accent ? "text-accent" : "text-ink"}`}>{cell.value}</p>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 font-sans text-[0.8rem]">
            <button
              type="button"
              className="rounded border border-rule bg-panel-alt px-3 py-1.5 text-ink-soft transition-colors hover:border-accent hover:text-accent disabled:opacity-40"
              onClick={() => setStep((s) => clamp(s - 1, 0, moves.length))}
              disabled={step === 0}
            >
              Back
            </button>
            <button
              type="button"
              className="rounded border border-accent bg-accent px-3 py-1.5 text-white transition-opacity hover:opacity-90 disabled:opacity-40"
              onClick={() => setStep((s) => clamp(s + 1, 0, moves.length))}
              disabled={step >= moves.length}
            >
              {step >= moves.length ? "Finished" : "Peel"}
            </button>
            <button
              type="button"
              className="rounded border border-rule bg-panel-alt px-3 py-1.5 text-ink-soft transition-colors hover:border-accent hover:text-accent"
              onClick={() => setStep(0)}
            >
              Reset
            </button>
          </div>

          <input
            className="unfold-range w-full"
            type="range"
            min={0}
            max={moves.length}
            step={1}
            value={step}
            aria-label="Peeling step"
            onChange={(e) => setStep(Number(e.target.value))}
          />

          <div className="rounded border border-rule bg-panel-alt p-3 font-sans text-[0.78rem]">
            <p className="text-[0.68rem] uppercase tracking-wide text-muted">
              {next ? `Next move (case ${next.kind})` : "Nothing left to remove"}
            </p>
            <p className="mt-1 text-ink-soft">{next ? next.label : `Terminal graph: V − E + F = ${chi}.`}</p>
          </div>

          <ol className="max-h-40 space-y-1 overflow-y-auto font-sans text-[0.75rem] text-muted">
            {moves.slice(0, step).map((m, i) => (
              <li key={i} className="border-b border-rule/60 pb-1">
                <span className="text-accent">{i + 1}.</span> {m.label}
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}

/* ==================================================== 7. halting oracle */

type Assumption = "halts" | "loops" | null;

const STAGES = [
  { id: 1, label: "Input", text: "D is fed its own description ⟨D⟩ — legal, because encodings are just strings." },
  { id: 2, label: "Duplicate", text: "D copies its input and forms the pair (⟨D⟩, ⟨D⟩) for the oracle." },
  { id: 3, label: "Oracle H", text: "H is assumed total and correct, so it reports what D(⟨D⟩) really does." },
  { id: 4, label: "Inverter", text: "D does the opposite of H's answer: halt becomes loop, loop becomes halt." },
  { id: 5, label: "Outcome", text: "The outcome contradicts the assumption we started from. Both branches die." },
];

export function HaltingOracle() {
  const [assumption, setAssumption] = useState<Assumption>(null);
  const [stage, setStage] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const run = useCallback((next: Assumption) => {
    setAssumption(next);
    setStage(0);
    if (timer.current) clearInterval(timer.current);
    if (!next) return;
    let s = 0;
    timer.current = setInterval(() => {
      s += 1;
      setStage(s);
      if (s >= STAGES.length && timer.current) {
        clearInterval(timer.current);
        timer.current = null;
      }
    }, 620);
  }, []);

  useEffect(() => () => {
    if (timer.current) clearInterval(timer.current);
  }, []);

  const oracleAnswer = assumption === "halts" ? "halts" : assumption === "loops" ? "loops" : "—";
  const outcome = assumption === "halts" ? "loops forever" : assumption === "loops" ? "halts" : "—";
  const contradiction = stage >= STAGES.length && assumption !== null;

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      run(assumption === "halts" ? "loops" : "halts");
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      run(assumption === "loops" ? "halts" : "loops");
    }
  };

  return (
    <div className="rounded-lg border border-rule bg-panel p-4" tabIndex={0} role="group" aria-label="Halting oracle trace" onKeyDown={onKeyDown}>
      <p className="font-sans text-[0.7rem] uppercase tracking-[0.14em] text-muted">Tracing D(⟨D⟩)</p>

      <div className="mt-3 flex flex-wrap gap-2 font-sans text-[0.82rem]">
        <button
          type="button"
          onClick={() => run("halts")}
          aria-pressed={assumption === "halts"}
          className={`rounded border px-3 py-1.5 transition-colors ${
            assumption === "halts" ? "border-accent bg-accent text-white" : "border-rule bg-panel-alt text-ink-soft hover:border-accent"
          }`}
        >
          Assume D(⟨D⟩) halts
        </button>
        <button
          type="button"
          onClick={() => run("loops")}
          aria-pressed={assumption === "loops"}
          className={`rounded border px-3 py-1.5 transition-colors ${
            assumption === "loops" ? "border-accent bg-accent text-white" : "border-rule bg-panel-alt text-ink-soft hover:border-accent"
          }`}
        >
          Assume D(⟨D⟩) loops
        </button>
        <button
          type="button"
          onClick={() => run(null)}
          className="rounded border border-rule bg-panel-alt px-3 py-1.5 text-ink-soft transition-colors hover:border-accent"
        >
          Reset
        </button>
      </div>

      <svg viewBox="0 0 620 150" className="mt-4 w-full">
        {[
          { x: 10, label: "⟨D⟩", sub: "input" },
          { x: 130, label: "copy", sub: "(⟨D⟩,⟨D⟩)" },
          { x: 250, label: "H", sub: oracleAnswer },
          { x: 370, label: "flip", sub: outcome },
          { x: 490, label: contradiction ? "⊥" : "?", sub: contradiction ? "contradiction" : "outcome" },
        ].map((node, i) => {
          const active = stage >= i + 1;
          const isOracle = i === 2;
          const isEnd = i === 4;
          return (
            <g key={node.label + i}>
              <rect
                x={node.x}
                y={40}
                width={100}
                height={56}
                rx={8}
                fill={isEnd && contradiction ? "#f8e7e3" : active ? "#e2ede8" : "#faf8f2"}
                stroke={isEnd && contradiction ? "#9d3327" : active ? "#1d6a58" : "#cfc8b8"}
                strokeWidth={active ? 1.8 : 1.2}
              />
              <text x={node.x + 50} y={64} textAnchor="middle" fontSize={isOracle ? 18 : 15} fill={active ? "#1a1814" : "#7d766b"} fontFamily="ui-serif, Georgia, serif">
                {node.label}
              </text>
              <text x={node.x + 50} y={84} textAnchor="middle" fontSize={11} fill={isEnd && contradiction ? "#9d3327" : "#7d766b"} fontFamily="ui-sans-serif, system-ui">
                {node.sub}
              </text>
              {i < 4 ? (
                <path
                  d={`M ${node.x + 100} 68 L ${node.x + 130} 68`}
                  stroke={stage >= i + 2 ? "#1d6a58" : "#cfc8b8"}
                  strokeWidth={1.8}
                  markerEnd="none"
                />
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="mt-2 rounded border border-rule bg-panel-alt p-3 font-sans text-[0.82rem]">
        <p className="text-[0.68rem] uppercase tracking-wide text-muted">
          {assumption ? `Stage ${Math.max(stage, 1)} of ${STAGES.length}` : "Choose an assumption"}
        </p>
        <p className="mt-1 text-ink-soft" role="status">
          {assumption ? STAGES[clamp(stage, 1, STAGES.length) - 1].text : "D consults the oracle about itself and then does the opposite."}
        </p>
        {contradiction ? (
          <p className="mt-2 text-danger">
            {assumption === "halts"
              ? "We assumed D(⟨D⟩) halts. Then H must answer “halts”, and D — doing the opposite — loops forever. Contradiction."
              : "We assumed D(⟨D⟩) loops. Then H must answer “loops”, and D — doing the opposite — halts. Contradiction."}
          </p>
        ) : null}
      </div>
    </div>
  );
}
