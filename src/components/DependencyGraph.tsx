"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface GraphNodeData {
  id: string;
  kind: string;
  title: string;
  statement: string;
  href: string;
}

export interface GraphEdgeData {
  fromId: string;
  toId: string;
  relation: string;
}

const KIND_STYLE: Record<string, { fill: string; stroke: string; label: string }> = {
  proof: { fill: "#1d6a58", stroke: "#14503f", label: "theorem" },
  lemma: { fill: "#4a6fa5", stroke: "#38557f", label: "lemma" },
  definition: { fill: "#a4522c", stroke: "#7f3d1f", label: "definition" },
  axiom: { fill: "#8c6a15", stroke: "#6b5010", label: "axiom" },
  rule: { fill: "#7d6a9e", stroke: "#5f4f7a", label: "rule of inference" },
};

const COL_WIDTH = 210;
const ROW_HEIGHT = 46;
const MARGIN = 40;

interface Props {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  focus?: string;
}

export function DependencyGraph({ nodes, edges, focus }: Props) {
  const [selected, setSelected] = useState<string | null>(focus ?? null);
  const [zoom, setZoom] = useState(1);
  const [onlyClosure, setOnlyClosure] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const hardEdges = useMemo(() => edges.filter((e) => e.relation !== "related"), [edges]);
  const nodeById = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);

  const { positions, width, height } = useMemo(() => {
    const outgoing = new Map<string, string[]>();
    for (const edge of hardEdges) {
      const list = outgoing.get(edge.fromId) ?? [];
      list.push(edge.toId);
      outgoing.set(edge.fromId, list);
    }

    const rank = new Map<string, number>();
    const computing = new Set<string>();
    const rankOf = (id: string): number => {
      const cached = rank.get(id);
      if (cached !== undefined) return cached;
      if (computing.has(id)) return 0;
      computing.add(id);
      const deps = outgoing.get(id) ?? [];
      const value = deps.length === 0 ? 0 : 1 + Math.max(...deps.map(rankOf));
      computing.delete(id);
      rank.set(id, value);
      return value;
    };
    for (const node of nodes) rankOf(node.id);

    const kindOrder: Record<string, number> = { proof: 0, lemma: 1, definition: 2, rule: 3, axiom: 4 };
    const byRank = new Map<number, GraphNodeData[]>();
    for (const node of nodes) {
      const r = rank.get(node.id) ?? 0;
      const list = byRank.get(r) ?? [];
      list.push(node);
      byRank.set(r, list);
    }

    const positions = new Map<string, { x: number; y: number; rank: number }>();
    let maxRows = 1;
    const ranks = [...byRank.keys()].sort((a, b) => a - b);
    for (const r of ranks) {
      const list = (byRank.get(r) ?? []).sort((a, b) => {
        const ka = kindOrder[a.kind] ?? 9;
        const kb = kindOrder[b.kind] ?? 9;
        if (ka !== kb) return ka - kb;
        return a.title.localeCompare(b.title);
      });
      maxRows = Math.max(maxRows, list.length);
      list.forEach((node, i) => {
        positions.set(node.id, { x: MARGIN + r * COL_WIDTH, y: MARGIN + i * ROW_HEIGHT, rank: r });
      });
    }

    return {
      positions,
      width: MARGIN * 2 + (ranks.length ? (ranks[ranks.length - 1] + 1) * COL_WIDTH : COL_WIDTH),
      height: MARGIN * 2 + maxRows * ROW_HEIGHT,
    };
  }, [nodes, hardEdges]);

  const closure = useMemo(() => {
    if (!selected) return { up: new Set<string>(), down: new Set<string>() };
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
    const out = new Map<string, string[]>();
    const inc = new Map<string, string[]>();
    for (const edge of hardEdges) {
      (out.get(edge.fromId) ?? out.set(edge.fromId, []).get(edge.fromId)!).push(edge.toId);
      (inc.get(edge.toId) ?? inc.set(edge.toId, []).get(edge.toId)!).push(edge.fromId);
    }
    return { up: walk(selected, out), down: walk(selected, inc) };
  }, [selected, hardEdges]);

  const visibleIds = useMemo(() => {
    if (!onlyClosure || !selected) return nodes.map((n) => n.id);
    const keep = new Set<string>([selected, ...closure.up, ...closure.down]);
    return nodes.filter((n) => keep.has(n.id)).map((n) => n.id);
  }, [onlyClosure, selected, closure, nodes]);

  const visibleSet = useMemo(() => new Set(visibleIds.filter((id) => !hidden.has(id))), [visibleIds, hidden]);

  const visibleEdges = useMemo(
    () => hardEdges.filter((e) => visibleSet.has(e.fromId) && visibleSet.has(e.toId)),
    [hardEdges, visibleSet],
  );
  const relatedEdges = useMemo(
    () => edges.filter((e) => e.relation === "related" && visibleSet.has(e.fromId) && visibleSet.has(e.toId)),
    [edges, visibleSet],
  );

  const highlighted = useMemo(() => {
    if (!selected) return null;
    return new Set<string>([selected, ...closure.up, ...closure.down]);
  }, [selected, closure]);

  const selectedNode = selected ? nodeById.get(selected) : null;

  const toggleKind = (kind: string) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
      <div className="rounded-lg border border-rule bg-panel">
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-rule px-3 py-2 font-sans text-[0.76rem]">
          {Object.entries(KIND_STYLE).map(([kind, style]) => (
            <button
              key={kind}
              type="button"
              onClick={() => toggleKind(kind)}
              aria-pressed={!hidden.has(kind)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-1 transition-opacity ${
                hidden.has(kind) ? "border-rule bg-panel-alt text-muted opacity-50" : "border-rule bg-panel-alt text-ink-soft"
              }`}
            >
              <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: style.fill }} />
              {style.label}
            </button>
          ))}
          <span className="ml-auto flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-ink-soft">
              <input type="checkbox" checked={onlyClosure} onChange={(e) => setOnlyClosure(e.target.checked)} />
              only selected closure
            </label>
            <button type="button" onClick={() => setZoom((z) => Math.max(0.45, z - 0.15))} className="rounded border border-rule bg-panel-alt px-2 py-1 hover:border-accent" aria-label="Zoom out">
              −
            </button>
            <span className="tabular w-10 text-center text-muted">{Math.round(zoom * 100)}%</span>
            <button type="button" onClick={() => setZoom((z) => Math.min(2, z + 0.15))} className="rounded border border-rule bg-panel-alt px-2 py-1 hover:border-accent" aria-label="Zoom in">
              +
            </button>
          </span>
        </div>

        <div className="max-h-[70vh] overflow-auto p-2">
          <svg
            width={width * zoom}
            height={height * zoom}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Dependency graph of the library: arrows point from a result to what it depends on"
            className="block"
          >
            <defs>
              <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#b6ae9c" />
              </marker>
              <marker id="arrow-hot" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 0 L 10 5 L 0 10 z" fill="#1d6a58" />
              </marker>
            </defs>

            {relatedEdges.map((edge, i) => {
              const a = positions.get(edge.fromId);
              const b = positions.get(edge.toId);
              if (!a || !b) return null;
              return (
                <path
                  key={`r${i}`}
                  d={`M ${a.x + 12} ${a.y} C ${a.x - 60} ${a.y}, ${b.x + 180} ${b.y}, ${b.x + 132} ${b.y}`}
                  fill="none"
                  stroke="#cfc8b8"
                  strokeWidth={1}
                  strokeDasharray="2 4"
                  opacity={0.7}
                />
              );
            })}

            {visibleEdges.map((edge, i) => {
              const a = positions.get(edge.fromId);
              const b = positions.get(edge.toId);
              if (!a || !b) return null;
              const hot = highlighted ? highlighted.has(edge.fromId) && highlighted.has(edge.toId) : false;
              const dim = highlighted ? !hot : false;
              const x1 = a.x + 8;
              const y1 = a.y;
              const x2 = b.x + COL_WIDTH - 86;
              const y2 = b.y;
              const midX = (x1 + x2) / 2;
              return (
                <path
                  key={i}
                  className="graph-edge"
                  d={`M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`}
                  fill="none"
                  stroke={hot ? "#1d6a58" : "#c3bba9"}
                  strokeWidth={hot ? 1.9 : 1}
                  strokeOpacity={dim ? 0.25 : hot ? 0.95 : 0.7}
                  markerEnd={hot ? "url(#arrow-hot)" : "url(#arrow)"}
                />
              );
            })}

            {nodes
              .filter((node) => visibleSet.has(node.id) && !hidden.has(node.kind))
              .map((node) => {
                const pos = positions.get(node.id);
                if (!pos) return null;
                const style = KIND_STYLE[node.kind] ?? KIND_STYLE.definition;
                const isSelected = selected === node.id;
                const dim = highlighted ? !highlighted.has(node.id) : false;
                const label = node.title.length > 30 ? `${node.title.slice(0, 29)}…` : node.title;
                return (
                  <g
                    key={node.id}
                    className="graph-node cursor-pointer"
                    opacity={dim ? 0.3 : 1}
                    onClick={() => setSelected(isSelected ? null : node.id)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${style.label}: ${node.title}. Activate to highlight everything it depends on.`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelected(isSelected ? null : node.id);
                      }
                    }}
                  >
                    <rect
                      x={pos.x}
                      y={pos.y - 14}
                      width={COL_WIDTH - 84}
                      height={28}
                      rx={14}
                      fill={isSelected ? style.fill : "#fffdf8"}
                      stroke={style.stroke}
                      strokeWidth={isSelected ? 2 : 1.2}
                    />
                    <circle cx={pos.x + 12} cy={pos.y} r={5} fill={style.fill} />
                    <text
                      x={pos.x + 24}
                      y={pos.y + 4}
                      fontSize={11.5}
                      fill={isSelected ? "#fffdf8" : "#46413a"}
                      fontFamily="ui-sans-serif, system-ui"
                    >
                      {label}
                    </text>
                  </g>
                );
              })}
          </svg>
        </div>
      </div>

      <aside className="space-y-3 font-sans text-[0.82rem]">
        <div className="rounded-lg border border-rule bg-panel p-4">
          <p className="text-[0.68rem] uppercase tracking-[0.14em] text-muted">Selection</p>
          {selectedNode ? (
            <>
              <p className="mt-1 text-[0.95rem] text-ink">{selectedNode.title}</p>
              <p className="mt-1 text-muted">{KIND_STYLE[selectedNode.kind]?.label ?? selectedNode.kind}</p>
              <p className="mt-2 leading-relaxed text-ink-soft">{selectedNode.statement}</p>
              <div className="mt-3 space-y-1 text-[0.78rem]">
                <p>
                  <span className="text-accent">Depends on {closure.up.size}</span> node
                  {closure.up.size === 1 ? "" : "s"} (highlighted above).
                </p>
                <p>
                  <span className="text-flare">{closure.down.size}</span> node
                  {closure.down.size === 1 ? "" : "s"} depend on it.
                </p>
              </div>
              <Link
                href={selectedNode.href}
                className="mt-3 inline-block rounded border border-accent bg-accent px-3 py-1.5 text-[0.78rem] text-white hover:opacity-90"
              >
                Open {selectedNode.kind === "proof" ? "proof" : "entry"}
              </Link>
            </>
          ) : (
            <p className="mt-2 leading-relaxed text-muted">
              Click any node. Everything it depends on — transitively, down to axioms — lights up;
              everything that depends on it stays visible in the closure count.
            </p>
          )}
        </div>

        <div className="rounded-lg border border-rule bg-panel p-4 text-muted">
          <p className="text-[0.68rem] uppercase tracking-[0.14em]">Reading the arrows</p>
          <p className="mt-2 leading-relaxed">
            An arrow points <em>from</em> a result <em>to</em> what it uses. Columns are ranks in the
            dependency order: axioms and bare definitions sit on the left, theorems on the right.
            Dashed curves are “see also” links and carry no logical weight.
          </p>
          <p className="mt-2 leading-relaxed">
            {nodes.length} nodes · {edges.length} links. The build fails if this graph ever contains
            a cycle.
          </p>
        </div>
      </aside>
    </div>
  );
}
