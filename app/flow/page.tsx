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
        {/* ── Nav ── */}
        <div className="flex items-center justify-between mb-6">
          <Link href="/receipt" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Back to receipt
          </Link>
          <Link href="/methodology" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            Methodology →
          </Link>
        </div>

        {/* ── Header ── */}
        <header className="mb-8 sm:mb-10">
          <h1 className="text-2xl sm:text-3xl font-bold leading-tight mb-2 text-balance">
            Where your{" "}
            <span className="text-amber-400">{fmtINR(breakdown.totalTax.mid)}</span>{" "}
            actually went
          </h1>
          <p className="text-zinc-400 text-sm sm:text-base">
            Following every rupee through the system — and how India compares to the world.
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

        {/* ── Your money, decoded ── */}
        <section className="mt-14">
          <p className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase mb-6">Your money, decoded</p>

          <div className="mb-10">
            <p className="text-zinc-400 text-sm mb-4">You worked this many days just to service old government debt:</p>
            <div className="flex items-end gap-3 mb-3">
              <span className="text-7xl sm:text-8xl font-black text-zinc-100 tabular-nums leading-none">
                {(Math.round((breakdown.totalTax.mid * 0.26) / (breakdown.grossIncome / 250) * 10) / 10).toFixed(1)}
              </span>
              <span className="text-2xl font-semibold text-zinc-500 pb-2">days</span>
            </div>
            <p className="text-zinc-600 text-xs font-mono">
              {fmtINR(Math.round(breakdown.totalTax.mid * 0.26))} debt interest share ÷ {fmtINR(Math.round(breakdown.grossIncome / 250))} earned per working day
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 border-t border-zinc-800 pt-7">
            <div>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.18em] mb-3">Your interest share</p>
              <p className="text-3xl font-black text-zinc-100 tabular-nums leading-none">{fmtINR(Math.round(breakdown.totalTax.mid * 0.26))}</p>
              <p className="text-zinc-600 text-xs mt-2">of your total tax paid</p>
            </div>
            <div>
              <p className="text-zinc-500 text-[10px] uppercase tracking-[0.18em] mb-3">Share to debt</p>
              <p className="text-3xl font-black text-zinc-100 tabular-nums leading-none">26%</p>
              <p className="text-zinc-600 text-xs mt-2">of every rupee collected</p>
            </div>
          </div>
        </section>

        {/* ── The national scale ── */}
        <section className="mt-14">
          <p className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase mb-6">The national scale</p>
          <div className="divide-y divide-zinc-800/80 border-y border-zinc-800/80">

            <div className="py-7">
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black text-zinc-100 tabular-nums leading-none">₹4.4 lakh</span>
                <span className="text-zinc-500 text-sm">per second on debt interest</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                That&apos;s ₹2.64 crore every minute, ₹158 crore every hour, ₹3,810 crore every day — non-stop, 365 days a year. In a single day, India pays as much in interest as <span className="text-zinc-200">six Chandrayaan-3 missions</span> cost combined (₹615 Cr each).
              </p>
            </div>

            <div className="py-7">
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black text-zinc-100 tabular-nums leading-none">₹1.57 lakh</span>
                <span className="text-zinc-500 text-sm">owed by every Indian — newborns included</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                At 55.6% debt-to-GDP, central government liabilities sit around ₹219 lakh crore. Spread across 1.4 billion people, every Indian carries ₹1.57 lakh of national debt — a <span className="text-zinc-200">family of four owes ₹6.27 lakh</span>, before any state debt is added.
              </p>
            </div>

            <div className="py-7">
              <p className="text-3xl sm:text-4xl font-black text-zinc-100 leading-none mb-2">Interest &gt; Defence + Education + Health</p>
              <p className="text-zinc-400 text-sm leading-relaxed">
                ₹13.9L Cr in interest beats Defence (₹7.85L Cr) + Education (₹1.10L Cr) + Health (₹0.90L Cr) = ₹9.85L Cr — by 41%. India pays creditors more than it pays its army, schools, and hospitals combined.
              </p>
            </div>

            <div className="py-7">
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black text-zinc-100 tabular-nums leading-none">~6%</span>
                <span className="text-zinc-500 text-sm">of Indians file income tax returns</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Roughly 8.5 crore people file ITRs out of 1.4 billion. Of those, only ~2 crore actually pay positive income tax. The formal salaried class — people like you — effectively cross-subsidises the welfare system for everyone else.
              </p>
            </div>

            <div className="py-7">
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black text-zinc-100 tabular-nums leading-none">65%</span>
                <span className="text-zinc-500 text-sm">of revenue is committed before any welfare</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Interest + defence salaries + government pensions absorb 65 paise of every ₹1 of revenue receipts before the government can fund a single school, road, or hospital.
              </p>
            </div>

            <div className="py-7">
              <div className="flex items-baseline gap-3 mb-2 flex-wrap">
                <span className="text-3xl sm:text-4xl font-black text-zinc-100 tabular-nums leading-none">79 years</span>
                <span className="text-zinc-500 text-sm">of unbroken fiscal deficits</span>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                India has not run a fiscal surplus in any year since 1947. The FY 2026-27 deficit is 4.3% of GDP — meaning the debt pile, and the interest bill on it, only compound year after year.
              </p>
            </div>
          </div>
        </section>

        {/* ── For every ₹100 — detailed breakdown ── */}
        <section className="mt-14">
          <p className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase mb-2">For every ₹100 the government spends</p>
          <p className="text-zinc-500 text-xs mb-8">FY 2026-27 Union Budget · ₹53.47 lakh crore total expenditure</p>

          <div className="space-y-12">

            {/* Interest */}
            <div>
              <div className="flex items-start gap-5 mb-4">
                <span className="text-5xl font-black text-zinc-100 tabular-nums leading-none w-20 shrink-0 pt-0.5">₹26</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-zinc-100 font-semibold text-base leading-tight">Interest payments</h3>
                  <p className="text-zinc-500 text-xs font-mono tabular-nums mt-1 mb-3">₹13.9 lakh crore</p>
                  <div className="h-[3px] bg-red-500/80 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Servicing past borrowing — coupon payments on Government Securities (G-Secs), discounts on Treasury bills, and interest on external loans. Pure cash outflow with zero return on investment. India&apos;s public debt has been growing 9–10% year-on-year for the past decade.
              </p>
            </div>

            {/* Capex */}
            <div>
              <div className="flex items-start gap-5 mb-4">
                <span className="text-5xl font-black text-zinc-100 tabular-nums leading-none w-20 shrink-0 pt-0.5">₹23</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-zinc-100 font-semibold text-base leading-tight">Capital expenditure</h3>
                  <p className="text-zinc-500 text-xs font-mono tabular-nums mt-1 mb-3">₹12.2 lakh crore</p>
                  <div className="h-[3px] bg-sky-500/80 rounded-full" style={{ width: '88%' }} />
                </div>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                Building physical assets that earn returns over time — roads, railways, ports, airports, defence kit. Unlike revenue spending, capex creates lasting infrastructure.
              </p>
              <ul className="space-y-2.5 text-xs pl-4 border-l border-zinc-800">
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Roads &amp; highways <span className="text-zinc-600">(NHAI, MoRTH)</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹2.87L Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Railways <span className="text-zinc-600">(IR capex)</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹2.65L Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Defence modernisation</span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹1.81L Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Loans to states for capex</span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹1.60L Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Telecom, urban housing, ports, other</span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹3.27L Cr</span></li>
              </ul>
            </div>

            {/* Schemes */}
            <div>
              <div className="flex items-start gap-5 mb-4">
                <span className="text-5xl font-black text-zinc-100 tabular-nums leading-none w-20 shrink-0 pt-0.5">₹19</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-zinc-100 font-semibold text-base leading-tight">Central schemes</h3>
                  <p className="text-zinc-500 text-xs font-mono tabular-nums mt-1 mb-3">₹9.9 lakh crore</p>
                  <div className="h-[3px] bg-amber-500/80 rounded-full" style={{ width: '71%' }} />
                </div>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                Welfare and development programmes — both Central Sector Schemes (run by the Centre alone) and Centrally Sponsored Schemes (run jointly with states). The scaffolding of India&apos;s social safety net.
              </p>
              <ul className="space-y-2.5 text-xs pl-4 border-l border-zinc-800">
                <li className="flex justify-between gap-3"><span className="text-zinc-300">MGNREGS <span className="text-zinc-600">— rural employment guarantee</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹86,000 Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">PM Awas Yojana <span className="text-zinc-600">— housing for poor</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹85,000 Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Jal Jeevan Mission <span className="text-zinc-600">— rural tap water</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹70,000 Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">PM-KISAN <span className="text-zinc-600">— farmer income support</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹60,000 Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Samagra Shiksha <span className="text-zinc-600">— school education</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹38,000 Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">National Health Mission</span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹37,000 Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Saksham Anganwadi &amp; POSHAN 2.0</span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹22,000 Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">PM POSHAN <span className="text-zinc-600">— mid-day meal</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹13,000 Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-400">Other schemes <span className="text-zinc-600">(PMGSY, Swachh Bharat, dozens more)</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹4.79L Cr</span></li>
              </ul>
            </div>

            {/* Defence */}
            <div>
              <div className="flex items-start gap-5 mb-4">
                <span className="text-5xl font-black text-zinc-100 tabular-nums leading-none w-20 shrink-0 pt-0.5">₹15</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-zinc-100 font-semibold text-base leading-tight">Defence</h3>
                  <p className="text-zinc-500 text-xs font-mono tabular-nums mt-1 mb-3">₹7.85 lakh crore</p>
                  <div className="h-[3px] bg-zinc-400/80 rounded-full" style={{ width: '57%' }} />
                </div>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                India&apos;s single largest ministry by budget allocation. Covers the Army, Navy, Air Force, Coast Guard, defence R&amp;D (DRDO), and the ordnance factory ecosystem.
              </p>
              <ul className="space-y-2.5 text-xs pl-4 border-l border-zinc-800">
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Pay &amp; allowances <span className="text-zinc-600">(revenue)</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹2.70L Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Defence pensions</span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹1.41L Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Capital outlay <span className="text-zinc-600">(modernisation)</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹1.81L Cr</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Stores, equipment, civil expenditure</span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹1.93L Cr</span></li>
              </ul>
            </div>

            {/* Subsidies */}
            <div>
              <div className="flex items-start gap-5 mb-4">
                <span className="text-5xl font-black text-zinc-100 tabular-nums leading-none w-20 shrink-0 pt-0.5">₹9</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-zinc-100 font-semibold text-base leading-tight">Subsidies</h3>
                  <p className="text-zinc-500 text-xs font-mono tabular-nums mt-1 mb-3">₹4.55 lakh crore</p>
                  <div className="h-[3px] bg-emerald-500/80 rounded-full" style={{ width: '33%' }} />
                </div>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                Direct transfers that keep essentials affordable for the poor. The food subsidy funds the Public Distribution System (PDS), which delivers ration grain to <span className="text-zinc-200">81 crore Indians</span>.
              </p>
              <ul className="space-y-2.5 text-xs pl-4 border-l border-zinc-800">
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Food subsidy <span className="text-zinc-600">(PDS, NFSA)</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹2.28L Cr · 50%</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Fertilizer subsidy</span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹1.71L Cr · 38%</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">Other subsidies <span className="text-zinc-600">(interest equalisation, exports, etc.)</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹0.45L Cr · 10%</span></li>
                <li className="flex justify-between gap-3"><span className="text-zinc-300">LPG subsidy <span className="text-zinc-600">(PMUY)</span></span><span className="font-mono tabular-nums text-zinc-500 shrink-0">₹12,000 Cr · 3%</span></li>
              </ul>
            </div>

            {/* Pensions */}
            <div>
              <div className="flex items-start gap-5 mb-4">
                <span className="text-5xl font-black text-zinc-100 tabular-nums leading-none w-20 shrink-0 pt-0.5">₹6</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-zinc-100 font-semibold text-base leading-tight">Government pensions</h3>
                  <p className="text-zinc-500 text-xs font-mono tabular-nums mt-1 mb-3">₹2.96 lakh crore</p>
                  <div className="h-[3px] bg-purple-400/80 rounded-full" style={{ width: '21%' }} />
                </div>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed">
                Pensions paid to retired civil servants, central armed police forces, and railway employees. (Defence pensions sit under the Defence head above.) Excludes the National Pension System, which is contributory and funded by employees themselves.
              </p>
            </div>

            {/* Other */}
            <div>
              <div className="flex items-start gap-5 mb-4">
                <span className="text-5xl font-black text-zinc-100 tabular-nums leading-none w-20 shrink-0 pt-0.5">₹4</span>
                <div className="flex-1 min-w-0">
                  <h3 className="text-zinc-100 font-semibold text-base leading-tight">Other</h3>
                  <p className="text-zinc-500 text-xs font-mono tabular-nums mt-1 mb-3">₹2.12 lakh crore</p>
                  <div className="h-[3px] bg-zinc-600 rounded-full" style={{ width: '15%' }} />
                </div>
              </div>
              <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                The residual head — everything that doesn&apos;t fit the categories above. Mostly small, slow-moving line items spread across departments:
              </p>
              <ul className="space-y-2 text-xs pl-4 border-l border-zinc-800 text-zinc-400">
                <li>Statutory transfers to states (Finance Commission grants)</li>
                <li>Postal services and telecom departmental costs</li>
                <li>Tax administration (CBDT, CBIC operating costs)</li>
                <li>Audit, accounts, contingency, and reserve funds</li>
                <li>Smaller departmental establishments</li>
              </ul>
            </div>

          </div>

          <p className="text-zinc-700 text-[11px] mt-12 pt-6 border-t border-zinc-800/80 leading-relaxed">
            Sources: Union Budget 2026-27 · PRS India Budget Analysis · Demand for Grants. Note: Defence&apos;s ₹1.81L Cr capital outlay overlaps with the capex line above; figures follow the standard PRS expenditure-head classification. Education (~₹1.10L Cr) and Health (~₹0.90L Cr) appear primarily within Schemes via Samagra Shiksha and the National Health Mission.
          </p>
        </section>

        {/* ── India vs the world ── */}
        <section className="mt-14">
          <p className="text-[10px] tracking-[0.2em] text-zinc-500 uppercase mb-2">India vs the world</p>
          <p className="text-zinc-100 text-lg font-semibold mb-1">Low tax. High debt interest.</p>
          <p className="text-zinc-500 text-sm mb-9 leading-relaxed">
            India sits near the bottom for tax revenue as a share of GDP — yet near the top for the share of spending eaten by debt interest.
          </p>

          <div className="grid sm:grid-cols-2 gap-12">
            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-[0.18em] font-semibold mb-1">Tax revenue / GDP</p>
              <p className="text-zinc-600 text-xs mb-6">Higher = stronger fiscal capacity</p>
              <div className="space-y-3.5">
                {([
                  { country: "France", flag: "🇫🇷", pct: 45.4 },
                  { country: "Germany", flag: "🇩🇪", pct: 39.3 },
                  { country: "UK", flag: "🇬🇧", pct: 35.3 },
                  { country: "OECD avg", flag: "—", pct: 33.9 },
                  { country: "Brazil", flag: "🇧🇷", pct: 31.4 },
                  { country: "USA", flag: "🇺🇸", pct: 27.1 },
                  { country: "South Africa", flag: "🇿🇦", pct: 26.6 },
                  { country: "China", flag: "🇨🇳", pct: 21.0 },
                  { country: "Indonesia", flag: "🇮🇩", pct: 13.7 },
                  { country: "India", flag: "🇮🇳", pct: 11.4, hi: true },
                ] as { country: string; flag: string; pct: number; hi?: boolean }[]).map(({ country, flag, pct, hi }) => (
                  <div key={country} className="flex items-center gap-2.5">
                    <span className="text-base w-5 shrink-0 text-center">{flag}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs ${hi ? "text-zinc-100 font-semibold" : "text-zinc-400"}`}>{country}</span>
                        <span className={`text-xs font-mono tabular-nums ${hi ? "text-zinc-100 font-semibold" : "text-zinc-500"}`}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-zinc-800/80 overflow-hidden">
                        <div className={`h-full rounded-full ${hi ? "bg-amber-400" : "bg-zinc-600"}`} style={{ width: `${(pct / 50) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-zinc-700 text-[10px] mt-5">OECD Revenue Statistics 2024 · IMF 2024</p>
            </div>

            <div>
              <p className="text-[10px] text-zinc-400 uppercase tracking-[0.18em] font-semibold mb-1">Debt interest / spending</p>
              <p className="text-zinc-600 text-xs mb-6">Lower = less debt-trapped</p>
              <div className="space-y-3.5">
                {([
                  { country: "Germany", flag: "🇩🇪", pct: 4 },
                  { country: "France", flag: "🇫🇷", pct: 5 },
                  { country: "China", flag: "🇨🇳", pct: 6 },
                  { country: "OECD avg", flag: "—", pct: 7 },
                  { country: "UK", flag: "🇬🇧", pct: 8 },
                  { country: "Indonesia", flag: "🇮🇩", pct: 12 },
                  { country: "USA", flag: "🇺🇸", pct: 12 },
                  { country: "South Africa", flag: "🇿🇦", pct: 15 },
                  { country: "India", flag: "🇮🇳", pct: 26, hi: true },
                  { country: "Brazil", flag: "🇧🇷", pct: 28 },
                ] as { country: string; flag: string; pct: number; hi?: boolean }[]).sort((a, b) => a.pct - b.pct).map(({ country, flag, pct, hi }) => (
                  <div key={country} className="flex items-center gap-2.5">
                    <span className="text-base w-5 shrink-0 text-center">{flag}</span>
                    <div className="flex-1">
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-xs ${hi ? "text-zinc-100 font-semibold" : "text-zinc-400"}`}>{country}</span>
                        <span className={`text-xs font-mono tabular-nums ${hi ? "text-zinc-100 font-semibold" : "text-zinc-500"}`}>{pct}%</span>
                      </div>
                      <div className="h-1 rounded-full bg-zinc-800/80 overflow-hidden">
                        <div className={`h-full rounded-full ${hi ? "bg-red-500" : "bg-zinc-600"}`} style={{ width: `${(pct / 30) * 100}%` }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-zinc-700 text-[10px] mt-5">IMF Fiscal Monitor 2024 · World Bank 2024</p>
            </div>
          </div>

          <div className="mt-12 pt-7 border-t border-zinc-800">
            <p className="text-zinc-300 text-base leading-relaxed">
              <span className="text-white font-semibold">The paradox.</span> India is one of the world&apos;s lowest-tax states by GDP share — yet channels more of that spending into debt interest than almost any peer. With only 6% of the population paying income tax, the government borrows heavily to fill the gap, compounding a debt burden that crowds out spending on the 94% who need it most.
            </p>
          </div>
        </section>

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
