"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { sankey, sankeyJustify, sankeyLinkHorizontal } from "d3-sankey";
import {
  computeTaxBreakdown,
  type TaxBreakdown,
  type TaxInput,
} from "@/lib/calculateTax";
import { budgetData } from "@/lib/budgetData";

/* ─────────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────────── */

type Tier = 0 | 1 | 2;

interface DiagramNode {
  name: string;
  tier: Tier;
  amount: number;
  highlight?: boolean;
  // populated by d3-sankey (horizontal coordinate system)
  x0?: number;
  x1?: number;
  y0?: number;
  y1?: number;
  index?: number;
  sourceLinks?: DiagramLink[];
  targetLinks?: DiagramLink[];
  value?: number;
  depth?: number;
  height?: number;
  layer?: number;
}

interface DiagramLink {
  source: number | DiagramNode;
  target: number | DiagramNode;
  value: number;
  // populated by d3-sankey
  width?: number;
  y0?: number;
  y1?: number;
  index?: number;
}

/* ─────────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────────── */

function fmtINR(n: number): string {
  if (n < 1000) return `₹${Math.round(n)}`;
  if (n < 100000) return `₹${Math.round(n).toLocaleString("en-IN")}`;
  if (n < 10000000) return `₹${(n / 100000).toFixed(n < 1000000 ? 2 : 1)}L`;
  return `₹${(n / 10000000).toFixed(2)}Cr`;
}

const TIER0_COLOR = "#71717a"; // zinc-500 muted slate
const TIER1_COLOR = "#f59e0b"; // amber
const TIER2_COLOR = "#52525b"; // zinc-600 muted slate
const INTEREST_COLOR = "#ef4444"; // red-orange anchor

function nodeColor(n: DiagramNode): string {
  if (n.tier === 0) return TIER0_COLOR;
  if (n.tier === 1) return TIER1_COLOR;
  if (n.highlight) return INTEREST_COLOR;
  return TIER2_COLOR;
}

/* ─────────────────────────────────────────────────────────────────────
   Build the sankey input from the user's breakdown
   ───────────────────────────────────────────────────────────────────── */

function buildSankeyData(b: TaxBreakdown): {
  nodes: DiagramNode[];
  links: DiagramLink[];
} {
  const total = b.totalTax.mid;
  const tier0Items: { name: string; amount: number }[] = [
    { name: "Income Tax", amount: b.totalIncomeTax },
    { name: "GST (est)", amount: b.gst.mid },
    { name: "Fuel Tax", amount: b.fuelTax.total },
  ].filter((x) => x.amount > 0);

  // Tier 2 categories from the budget, ordered for visual flow.
  // Pull pcts from budget data so we don't hardcode duplicates.
  const tier2Defs: { id: string; highlight?: boolean }[] = [
    { id: "interest", highlight: true },
    { id: "capex" },
    { id: "schemes" },
    { id: "defence" },
    { id: "subsidies" },
    { id: "pensions" },
    { id: "other" },
  ];

  const tier2Items = tier2Defs.map((def) => {
    const cat = budgetData.expenditure_top.find((e) => e.id === def.id)!;
    return {
      name: cat.category,
      amount: total * (cat.pct_total_exp / 100),
      highlight: def.highlight,
    };
  });

  const nodes: DiagramNode[] = [
    ...tier0Items.map((t) => ({
      name: t.name,
      tier: 0 as Tier,
      amount: t.amount,
    })),
    {
      name: "Consolidated Fund of India",
      tier: 1 as Tier,
      amount: total,
    },
    ...tier2Items.map((t) => ({
      name: t.name,
      tier: 2 as Tier,
      amount: t.amount,
      highlight: t.highlight,
    })),
  ];

  const tier0Count = tier0Items.length;
  const poolIdx = tier0Count;

  const links: DiagramLink[] = [];
  // tier 0 → pool
  tier0Items.forEach((t, i) => {
    if (t.amount > 0) {
      links.push({ source: i, target: poolIdx, value: t.amount });
    }
  });
  // pool → tier 2 (proportional)
  tier2Items.forEach((t, i) => {
    if (t.amount > 0) {
      links.push({
        source: poolIdx,
        target: poolIdx + 1 + i,
        value: t.amount,
      });
    }
  });

  return { nodes, links };
}

/* ─────────────────────────────────────────────────────────────────────
   Vertical sankey link path (custom — d3-sankey only ships horizontal)
   ───────────────────────────────────────────────────────────────────── */

function verticalLinkPath(d: DiagramLink): string {
  const source = d.source as DiagramNode;
  const target = d.target as DiagramNode;
  // In horizontal sankey: link.y0 is source-side y-center, link.y1 is target-side y-center.
  // After we transpose for vertical, those become x-centers and source.x1/target.x0 become y-edges.
  const sx = d.y0!;
  const tx = d.y1!;
  const sy = source.x1!;
  const ty = target.x0!;
  const midY = (sy + ty) / 2;
  return `M${sx},${sy}C${sx},${midY} ${tx},${midY} ${tx},${ty}`;
}

/* ─────────────────────────────────────────────────────────────────────
   Annotations definition
   ───────────────────────────────────────────────────────────────────── */

const ANNOTATIONS: {
  nodeName: string;
  text: string;
  lines: string[];
}[] = [
  {
    nodeName: "Interest payments",
    text: "Bigger than defence, health, and education combined",
    lines: ["Bigger than defence, health,", "and education combined"],
  },
  {
    nodeName: "Subsidies",
    text: "87% goes to food and fertilizer",
    lines: ["87% goes to food", "and fertilizer"],
  },
  {
    nodeName: "Centrally sponsored schemes",
    text: "₹2.04 lakh crore was unspent in 2025-26",
    lines: ["₹2.04 lakh crore was", "unspent in 2025-26"],
  },
];

/* ─────────────────────────────────────────────────────────────────────
   Page
   ───────────────────────────────────────────────────────────────────── */

export default function FlowPage() {
  const [breakdown, setBreakdown] = useState<TaxBreakdown | null>(null);
  const [missing, setMissing] = useState(false);
  const [hoveredLink, setHoveredLink] = useState<number | null>(null);
  const [explainerOpen, setExplainerOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(720);
  const [isVertical, setIsVertical] = useState(false);

  // Load taxInput → compute breakdown
  useEffect(() => {
    const raw = typeof window !== "undefined"
      ? localStorage.getItem("taxInput")
      : null;
    if (!raw) {
      setMissing(true);
      return;
    }
    try {
      const input = JSON.parse(raw) as TaxInput;
      setBreakdown(computeTaxBreakdown(input));
    } catch {
      setMissing(true);
    }
  }, []);

  // Track container width — depends on `breakdown` so it re-runs once
  // the loading early-return is gone and the ref'd container is mounted.
  useEffect(() => {
    if (!breakdown || !containerRef.current) return;
    const el = containerRef.current;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        setWidth(w);
        setIsVertical(w < 640);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [breakdown]);

  // Compute sankey layout
  const layout = useMemo(() => {
    if (!breakdown) return null;
    const { nodes, links } = buildSankeyData(breakdown);
    if (links.length === 0) return null;

    // For vertical mode we feed sankey transposed dimensions:
    // - "horizontal" axis from sankey's POV = visible vertical axis
    const w = Math.max(280, width);
    const h = isVertical ? Math.max(680, w * 1.6) : 520;
    const sankeyW = isVertical ? h : w;
    const sankeyH = isVertical ? w : h;

    // Label padding — labels sit outside the node extent.
    // Horizontal: leave room on left for tier-0 labels and on right for tier-2 labels.
    // Vertical: leave room above (tier 0) and below (tier 2).
    const padLeft = isVertical ? 24 : 110;
    const padRight = isVertical ? 50 : 180; // bottom in vertical → room for "Interest payments" label below tier 2
    const padTop = isVertical ? 60 : 30;
    const padBottom = isVertical ? 60 : 30;

    const layoutFn = sankey<DiagramNode, DiagramLink>()
      .nodeId((d) => d.index!)
      .nodeAlign(sankeyJustify)
      .nodeWidth(isVertical ? 14 : 18)
      // Desktop padding has to fit a 4-line label (name + value + 2 anno lines = ~52px)
      .nodePadding(isVertical ? 18 : 40)
      .extent([
        [padLeft, padTop],
        [sankeyW - padRight, sankeyH - padBottom],
      ]);

    // Assign indices so nodeId works
    nodes.forEach((n, i) => (n.index = i));
    const computed = layoutFn({
      nodes: nodes.map((n) => ({ ...n })),
      links: links.map((l) => ({ ...l })),
    });

    return { ...computed, w, h, sankeyW, sankeyH };
  }, [breakdown, width, isVertical]);

  /* ───── Empty / missing states ───── */
  if (missing) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-[#fafafa] flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <p className="text-zinc-400 mb-4">
            We don&apos;t have your tax inputs yet.
          </p>
          <Link
            href="/"
            className="inline-block bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl px-5 py-3 transition-colors"
          >
            Start your receipt →
          </Link>
        </div>
      </main>
    );
  }

  if (!breakdown || !layout) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
        <div className="max-w-5xl mx-auto px-4 pt-8 pb-20">
          <div className="mb-8 sm:mb-10">
            <div className="h-10 w-64 bg-zinc-800 rounded animate-pulse mb-3" />
            <div className="h-5 w-96 bg-zinc-800 rounded animate-pulse" />
          </div>
          <div className="bg-zinc-900 rounded-xl h-96 animate-pulse" />
          <div className="mt-8 space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  const { nodes, links, sankeyW, sankeyH } = layout;
  const svgW = isVertical ? sankeyH : sankeyW;
  const svgH = isVertical ? sankeyW : sankeyH;

  /* ───── Render helpers ───── */

  const linkPathFn = isVertical
    ? verticalLinkPath
    : (sankeyLinkHorizontal() as unknown as (d: DiagramLink) => string);

  function linkOpacity(i: number): number {
    if (hoveredLink === null) return 0.4;
    return hoveredLink === i ? 0.9 : 0.1;
  }

  function nodeRect(n: DiagramNode) {
    if (isVertical) {
      // transpose: node.x is vertical axis (top/bottom), node.y is horizontal
      return {
        x: n.y0!,
        y: n.x0!,
        width: n.y1! - n.y0!,
        height: n.x1! - n.x0!,
      };
    }
    return {
      x: n.x0!,
      y: n.y0!,
      width: n.x1! - n.x0!,
      height: n.y1! - n.y0!,
    };
  }

  function nodeLabelPos(n: DiagramNode) {
    const r = nodeRect(n);
    if (isVertical) {
      // Label above (tier 0), to side (tier 1), below (tier 2)
      if (n.tier === 0) {
        return { x: r.x + r.width / 2, y: r.y - 8, anchor: "middle" as const };
      }
      if (n.tier === 1) {
        return {
          x: r.x + r.width + 10,
          y: r.y + r.height / 2,
          anchor: "start" as const,
        };
      }
      return {
        x: r.x + r.width / 2,
        y: r.y + r.height + 16,
        anchor: "middle" as const,
      };
    }
    // horizontal
    if (n.tier === 0) {
      return { x: r.x - 8, y: r.y + r.height / 2, anchor: "end" as const };
    }
    if (n.tier === 2) {
      return {
        x: r.x + r.width + 8,
        y: r.y + r.height / 2,
        anchor: "start" as const,
      };
    }
    // tier 1: above the node
    return {
      x: r.x + r.width / 2,
      y: r.y - 10,
      anchor: "middle" as const,
    };
  }

  /* Build a lookup so we can attach annotations to label groups */
  const annotationByNode = new Map(
    ANNOTATIONS.map((a) => [a.nodeName, a])
  );

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      <div className="max-w-5xl mx-auto px-4 pt-8 pb-20">
        {/* ── Header ── */}
        <header className="mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2 text-balance">
            Where your{" "}
            <span className="text-amber-400">{fmtINR(breakdown.totalTax.mid)}</span>{" "}
            actually went
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            Following your tax through the system.
          </p>
        </header>

        {/* ── Diagram ── */}
        <div
          ref={containerRef}
          className="relative w-full bg-[#0a0a0a] overflow-hidden"
        >
          <svg
            viewBox={`0 0 ${svgW} ${svgH}`}
            width="100%"
            height={svgH}
            preserveAspectRatio="xMidYMid meet"
            role="img"
            aria-label={`Sankey diagram showing tax flow totalling ${fmtINR(
              breakdown.totalTax.mid
            )}`}
            onMouseLeave={() => setHoveredLink(null)}
            className="block touch-manipulation"
          >
            <defs>
              {links.map((l, i) => {
                const src = l.source as DiagramNode;
                const tgt = l.target as DiagramNode;
                const srcCol = nodeColor(src);
                const tgtCol = nodeColor(tgt);
                const srcRect = nodeRect(src);
                const tgtRect = nodeRect(tgt);
                const x1 = srcRect.x + (isVertical ? srcRect.width / 2 : srcRect.width);
                const y1 = srcRect.y + (isVertical ? srcRect.height : srcRect.height / 2);
                const x2 = tgtRect.x + (isVertical ? tgtRect.width / 2 : 0);
                const y2 = tgtRect.y + (isVertical ? 0 : tgtRect.height / 2);
                return (
                  <linearGradient
                    key={`grad-${i}`}
                    id={`grad-${i}`}
                    gradientUnits="userSpaceOnUse"
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                  >
                    <stop offset="0%" stopColor={srcCol} />
                    <stop offset="100%" stopColor={tgtCol} />
                  </linearGradient>
                );
              })}
            </defs>

            {/* Links group with optional rotation */}
            <g
              transform={
                isVertical ? `translate(0, 0)` : undefined
              }
              fill="none"
            >
              {links.map((l, i) => {
                const path = linkPathFn(l);
                const w = Math.max(2, l.width ?? 2);
                return (
                  <path
                    key={`link-${i}`}
                    d={path}
                    stroke={`url(#grad-${i})`}
                    strokeWidth={w}
                    strokeOpacity={linkOpacity(i)}
                    style={{ transition: "stroke-opacity 200ms ease" }}
                    onMouseEnter={() => setHoveredLink(i)}
                    onTouchStart={() =>
                      setHoveredLink(hoveredLink === i ? null : i)
                    }
                  />
                );
              })}
            </g>

            {/* Nodes */}
            <g>
              {nodes.map((n, i) => {
                const r = nodeRect(n);
                return (
                  <g key={`node-${i}`}>
                    <rect
                      x={r.x}
                      y={r.y}
                      width={r.width}
                      height={r.height}
                      fill={nodeColor(n)}
                      rx={3}
                    />
                  </g>
                );
              })}
            </g>

            {/* Labels — desktop shows all; vertical shows only the pool + highlighted node */}
            <g>
              {nodes.map((n, i) => {
                if (isVertical && n.tier !== 1 && !n.highlight) return null;
                const pos = nodeLabelPos(n);
                const isAnchor = n.highlight;
                const ann = !isVertical
                  ? annotationByNode.get(n.name)
                  : undefined;
                // For vertical tier-1, override to centered above the node
                const labelX = isVertical && n.tier === 1
                  ? nodeRect(n).x + nodeRect(n).width / 2
                  : pos.x;
                const labelY = isVertical && n.tier === 1
                  ? nodeRect(n).y - 22
                  : pos.y;
                const labelAnchor = isVertical && n.tier === 1
                  ? ("middle" as const)
                  : pos.anchor;
                return (
                  <g key={`lbl-${i}`}>
                    <text
                      x={labelX}
                      y={labelY}
                      textAnchor={labelAnchor}
                      fill={isAnchor ? "#fca5a5" : "#e4e4e7"}
                      fontSize={n.tier === 1 ? 13 : 12}
                      fontWeight={n.tier === 1 || isAnchor ? 600 : 500}
                      style={{
                        fontFamily:
                          "system-ui, -apple-system, sans-serif",
                      }}
                    >
                      {n.name}
                    </text>
                    <text
                      x={labelX}
                      y={labelY + 14}
                      textAnchor={labelAnchor}
                      fill="#71717a"
                      fontSize={11}
                      style={{
                        fontFamily:
                          "system-ui, -apple-system, sans-serif",
                      }}
                    >
                      {fmtINR(n.amount)}
                    </text>
                    {ann &&
                      ann.lines.map((line, li) => (
                        <text
                          key={li}
                          x={pos.x}
                          y={pos.y + 30 + li * 12}
                          textAnchor={pos.anchor}
                          fill={isAnchor ? "#fca5a5" : "#fcd34d"}
                          fontSize={10.5}
                          fontStyle="italic"
                          style={{
                            fontFamily:
                              "system-ui, -apple-system, sans-serif",
                          }}
                        >
                          {line}
                        </text>
                      ))}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* ── Mobile legend ── */}
        <div className="mt-6 sm:hidden">
          <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <div className="col-span-2 text-zinc-500 uppercase tracking-wide font-medium text-[10px] mb-1">
              You paid
            </div>
            {nodes
              .filter((n) => n.tier === 0)
              .map((n) => (
                <div key={n.name} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: nodeColor(n) }}
                  />
                  <span className="text-zinc-300 truncate">{n.name}</span>
                  <span className="text-zinc-500 ml-auto">
                    {fmtINR(n.amount)}
                  </span>
                </div>
              ))}
            <div className="col-span-2 text-zinc-500 uppercase tracking-wide font-medium text-[10px] mt-3 mb-1">
              Govt spent
            </div>
            {nodes
              .filter((n) => n.tier === 2)
              .map((n) => (
                <div key={n.name} className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-sm shrink-0"
                    style={{ backgroundColor: nodeColor(n) }}
                  />
                  <span
                    className={`truncate ${
                      n.highlight ? "text-red-300 font-medium" : "text-zinc-300"
                    }`}
                  >
                    {n.name}
                  </span>
                  <span className="text-zinc-500 ml-auto">
                    {fmtINR(n.amount)}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* ── Mobile annotations (inline) ── */}
        <div className="mt-6 space-y-2 sm:hidden">
          {ANNOTATIONS.map((a) => {
            const node = nodes.find((n) => n.name === a.nodeName);
            const color =
              a.nodeName === "Interest payments"
                ? "border-red-500/50 text-red-300"
                : "border-amber-500/40 text-amber-300";
            return (
              <div
                key={a.nodeName}
                className={`text-xs leading-snug border-l-2 ${color} pl-3 py-1`}
              >
                <span className="text-zinc-400 font-medium">
                  {node?.name ?? a.nodeName}:
                </span>{" "}
                {a.text}
              </div>
            );
          })}
        </div>

        {/* ── Explainer ── */}
        <details
          open={explainerOpen}
          onToggle={(e) =>
            setExplainerOpen((e.target as HTMLDetailsElement).open)
          }
          className="mt-10 border border-zinc-800 rounded-xl bg-zinc-900/40 overflow-hidden"
        >
          <summary className="cursor-pointer list-none flex items-center justify-between px-4 py-3 hover:bg-zinc-900/70 transition-colors">
            <span className="text-sm font-medium text-zinc-300">
              What this shows
            </span>
            <span
              className="text-zinc-500 text-sm transition-transform"
              style={{
                transform: explainerOpen ? "rotate(180deg)" : "rotate(0deg)",
              }}
            >
              ▾
            </span>
          </summary>
          <div className="px-4 pb-4 text-sm text-zinc-400 leading-relaxed space-y-2">
            <p>
              The diagram traces every rupee you contributed in tax — income
              tax, GST on purchases, and central excise plus state VAT on fuel —
              into the Consolidated Fund of India, the government&apos;s
              all-purpose pool. From there it flows out to the largest
              expenditure heads in the FY 2026-27 Union Budget.
            </p>
            <p>
              Slice widths are proportional to your share of each category,
              calculated by applying the Budget&apos;s percentage breakdown to
              your total. The 26% interest slice (₹13.9 lakh crore in absolute
              terms) is the single largest line item — it pays creditors for
              past borrowing, not future services.
            </p>
            <p>
              Categories follow{" "}
              <a
                href="https://prsindia.org/files/budget/budget_parliament/2026/Union_Budget_Analysis-2026-27.pdf"
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 hover:text-zinc-200"
              >
                PRS India&apos;s Union Budget Analysis 2026-27
              </a>
              .
            </p>
          </div>
        </details>

        {/* ── Footer ── */}
        <footer className="mt-10 pt-6 border-t border-zinc-800/60 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-zinc-500">
          <p>
            Source: PRS India Budget Analysis 2026-27 · Union Budget,
            indiabudget.gov.in
          </p>
          <Link
            href="/receipt"
            className="text-amber-400 hover:text-amber-300 transition-colors"
          >
            ← Back to receipt
          </Link>
        </footer>
      </div>
    </main>
  );
}
