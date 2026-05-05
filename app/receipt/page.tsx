"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { computeTaxBreakdown, TaxInput, TaxBreakdown } from "@/lib/calculateTax";

function fmtINR(n: number): string {
  if (n >= 10_000_000) return `₹${(n / 10_000_000).toFixed(2)} Cr`;
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(2)} L`;
  return `₹${n.toLocaleString("en-IN")}`;
}

function buildOgImageUrl(breakdown: TaxBreakdown): string {
  const total = Math.round(breakdown.totalTax.mid);
  const pct = (breakdown.effectiveRate.mid * 100).toFixed(1);
  const interest = Math.round(total * 0.26);
  const framing = breakdown.totalTax.mid / breakdown.grossIncome > 0.2
    ? "interest_dominant"
    : "default";
  const base = typeof window !== "undefined" ? window.location.origin : "";
  return `${base}/api/og?total=${total}&pct=${pct}&interest=${interest}&framing=${framing}`;
}

function staticFraming(breakdown: TaxBreakdown): string {
  const total = Math.round(breakdown.totalTax.mid);
  const interest = Math.round(total * 0.26);
  return `₹${interest.toLocaleString("en-IN")} of your taxes go to debt interest alone — before any school, hospital, or road.`;
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`flex justify-between py-2.5 border-b border-zinc-800 last:border-0`}>
      <span className="text-zinc-400 text-sm">{label}</span>
      <span className={`font-mono font-semibold text-sm ${highlight ? "text-amber-400" : "text-zinc-100"}`}>
        {value}
      </span>
    </div>
  );
}

export default function ReceiptPage() {
  const router = useRouter();
  const [breakdown, setBreakdown] = useState<TaxBreakdown | null>(null);
  const [taxInput, setTaxInput] = useState<TaxInput | null>(null);
  const [copied, setCopied] = useState(false);
  const [framing, setFraming] = useState<string | null>(null);
  const [framingLoading, setFramingLoading] = useState(false);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem("taxInput");
    if (!raw) {
      setMissing(true);
      const timer = setTimeout(() => router.push("/"), 2000);
      return () => clearTimeout(timer);
    }
    try {
      const input: TaxInput = JSON.parse(raw);
      const bd = computeTaxBreakdown(input);
      setBreakdown(bd);
      setTaxInput(input);
    } catch {
      router.push("/");
    }
  }, [router]);

  // Fetch personalized framing once breakdown is ready
  useEffect(() => {
    if (!breakdown || !taxInput) return;
    setFramingLoading(true);

    fetch("/api/framing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        breakdown,
        profile: {
          income: taxInput.annualIncome,
          state: taxInput.state,
          fuelMonthly: taxInput.monthlyPetrolLitres + taxInput.monthlyDieselLitres,
        },
      }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.framing) setFraming(data.framing);
        else setFraming(staticFraming(breakdown));
      })
      .catch(() => setFraming(staticFraming(breakdown)))
      .finally(() => setFramingLoading(false));
  }, [breakdown, taxInput]);

  const handleCopy = useCallback(async () => {
    if (!breakdown) return;
    const url = `${window.location.origin}/receipt`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [breakdown]);

  if (missing) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-[#fafafa] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <p className="text-zinc-400 mb-2">No tax data found. Redirecting to start…</p>
          <Link href="/" className="text-amber-400 hover:text-amber-300 text-sm">
            Or go back now
          </Link>
        </div>
      </main>
    );
  }

  if (!breakdown) {
    return (
      <main className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
        <div className="max-w-lg mx-auto px-4 pt-12 pb-24">
          <div className="mb-8">
            <div className="h-3 w-32 bg-zinc-800 rounded animate-pulse mb-2" />
            <div className="h-16 w-48 bg-zinc-800 rounded animate-pulse mb-4" />
            <div className="h-8 w-40 bg-zinc-800 rounded animate-pulse" />
          </div>

          {/* Skeleton sections */}
          {[1, 2, 3].map((i) => (
            <section key={i} className="mb-6">
              <div className="h-4 w-32 bg-zinc-800 rounded animate-pulse mb-3" />
              <div className="bg-zinc-900 rounded-xl px-4 py-1 space-y-2.5">
                {[1, 2, 3].map((j) => (
                  <div key={j} className="flex justify-between py-2.5 border-b border-zinc-800">
                    <div className="h-3 w-24 bg-zinc-800 rounded animate-pulse" />
                    <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      </main>
    );
  }

  const total = Math.round(breakdown.totalTax.mid);
  const pct = (breakdown.effectiveRate.mid * 100).toFixed(1);
  const interestShare = Math.round(total * 0.26);
  const ogUrl = buildOgImageUrl(breakdown);
  const receiptUrl = typeof window !== "undefined" ? `${window.location.origin}/receipt` : "";

  const twitterText = encodeURIComponent(
    `I paid ${fmtINR(total)} in taxes this year (${pct}% effective rate). ₹${interestShare.toLocaleString("en-IN")} went straight to debt interest. See your tax receipt →`
  );
  const twitterUrl = `https://twitter.com/intent/tweet?text=${twitterText}&url=${encodeURIComponent(receiptUrl)}`;
  const waText = encodeURIComponent(
    `I paid ${fmtINR(total)} in total tax this FY (${pct}% of income). See your own tax receipt: ${receiptUrl}`
  );
  const waUrl = `https://wa.me/?text=${waText}`;

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      <div className="max-w-lg mx-auto px-4 pt-12 pb-24">

        {/* Header */}
        <div className="mb-8">
          <p className="text-xs tracking-widest text-zinc-500 uppercase mb-2">My Tax Receipt · FY 2026-27</p>
          <h1 className="text-5xl font-black leading-none mb-1">{fmtINR(total)}</h1>
          <p className="text-amber-400 text-xl font-semibold mt-2">{pct}% effective rate</p>
        </div>

        {/* Personalized framing line */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 px-5 py-4 mb-8 min-h-[72px] flex items-center">
          {framingLoading ? (
            <div className="flex items-center gap-3 w-full">
              <div className="w-2 h-2 rounded-full bg-amber-400/60 animate-pulse shrink-0" />
              <div className="h-4 bg-zinc-800 rounded animate-pulse w-3/4" />
            </div>
          ) : (
            <p className="text-zinc-200 text-sm leading-relaxed italic">
              &ldquo;{framing || staticFraming(breakdown)}&rdquo;
            </p>
          )}
        </div>

        {/* Income tax breakdown */}
        <section className="mb-6">
          <h2 className="text-xs tracking-widest text-zinc-500 uppercase mb-3">Income Tax</h2>
          <div className="bg-zinc-900 rounded-xl px-4 py-1">
            <Row label="Gross income" value={fmtINR(breakdown.grossIncome)} />
            <Row label="Standard deduction" value={`− ${fmtINR(breakdown.standardDeduction)}`} />
            <Row label="Taxable income" value={fmtINR(breakdown.taxableIncome)} />
            {breakdown.rebate87A > 0 && (
              <Row label="87A rebate" value={`− ${fmtINR(breakdown.rebate87A)}`} />
            )}
            {breakdown.surcharge > 0 && (
              <Row label="Surcharge" value={fmtINR(breakdown.surcharge)} />
            )}
            <Row label="Cess (4%)" value={fmtINR(breakdown.cess)} />
            <Row label="Total income tax" value={fmtINR(breakdown.totalIncomeTax)} highlight />
          </div>
        </section>

        {/* Other taxes */}
        <section className="mb-6">
          <h2 className="text-xs tracking-widest text-zinc-500 uppercase mb-3">Other Taxes</h2>
          <div className="bg-zinc-900 rounded-xl px-4 py-1">
            <Row label="Fuel tax (est.)" value={fmtINR(breakdown.fuelTax.total)} />
            <Row label="GST on spending (mid)" value={fmtINR(breakdown.gst.mid)} />
          </div>
        </section>

        {/* Total range */}
        <section className="mb-8">
          <div className="bg-zinc-900 rounded-xl px-4 py-1">
            <Row label="Low estimate" value={fmtINR(breakdown.totalTax.low)} />
            <Row label="Mid estimate" value={fmtINR(breakdown.totalTax.mid)} highlight />
            <Row label="High estimate" value={fmtINR(breakdown.totalTax.high)} />
          </div>
        </section>

        {/* Interest callout */}
        <div className="rounded-xl border border-red-900/50 bg-red-950/20 px-5 py-4 mb-8">
          <p className="text-red-400 text-sm font-semibold mb-1">Where does it go?</p>
          <p className="text-zinc-300 text-sm leading-relaxed">
            Of your {fmtINR(total)}, roughly{" "}
            <span className="text-red-400 font-semibold">{fmtINR(interestShare)}</span> (26%) goes
            directly to servicing India&apos;s debt — before any school, hospital, or road.
          </p>
        </div>

        {/* OG image preview */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <div className="mb-6 rounded-xl overflow-hidden border border-zinc-800">
          <img src={ogUrl} alt="Your tax receipt share card" className="w-full" />
        </div>

        {/* Share buttons */}
        <div className="space-y-3">
          <a
            href={twitterUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#1d9bf0] hover:bg-[#1a8cd8] text-white font-semibold py-3.5 text-sm transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.629 5.905-5.629zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
            Share on X / Twitter
          </a>

          <a
            href={waUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-[#25d366] hover:bg-[#20bd5a] text-white font-semibold py-3.5 text-sm transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Share on WhatsApp
          </a>

          <button
            onClick={handleCopy}
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-semibold py-3.5 text-sm transition-colors"
          >
            {copied ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
                Copy link
              </>
            )}
          </button>
        </div>

        {/* Nav links */}
        <div className="mt-10 flex items-center justify-between">
          <button
            onClick={() => router.push("/")}
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            ← Recalculate
          </button>
          <Link
            href="/methodology"
            className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors"
          >
            Methodology →
          </Link>
        </div>

        <p className="text-center text-zinc-600 text-xs mt-8">
          Source: Union Budget 2026-27, PRS · New Regime
        </p>
      </div>
    </main>
  );
}
