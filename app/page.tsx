"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { TaxInput } from "@/lib/calculateTax";

const PETROL_PRICE = 105;
const DIESEL_PRICE = 92;

const STATES: { label: string; value: string }[] = [
  { label: "Andhra Pradesh", value: "Andhra Pradesh" },
  { label: "Arunachal Pradesh", value: "Arunachal Pradesh" },
  { label: "Assam", value: "Assam" },
  { label: "Bihar", value: "Bihar" },
  { label: "Chhattisgarh", value: "Chhattisgarh" },
  { label: "Goa", value: "Goa" },
  { label: "Gujarat", value: "Gujarat" },
  { label: "Haryana", value: "Haryana" },
  { label: "Himachal Pradesh", value: "Himachal Pradesh" },
  { label: "Jharkhand", value: "Jharkhand" },
  { label: "Karnataka", value: "Karnataka" },
  { label: "Kerala", value: "Kerala" },
  { label: "Madhya Pradesh", value: "Madhya Pradesh" },
  { label: "Maharashtra", value: "Maharashtra" },
  { label: "Manipur", value: "Manipur" },
  { label: "Meghalaya", value: "Meghalaya" },
  { label: "Mizoram", value: "Mizoram" },
  { label: "Nagaland", value: "Nagaland" },
  { label: "Odisha", value: "Odisha" },
  { label: "Punjab", value: "Punjab" },
  { label: "Rajasthan", value: "Rajasthan" },
  { label: "Sikkim", value: "Sikkim" },
  { label: "Tamil Nadu", value: "Tamil Nadu" },
  { label: "Telangana", value: "Telangana" },
  { label: "Tripura", value: "Tripura" },
  { label: "Uttar Pradesh", value: "UP" },
  { label: "Uttarakhand", value: "Uttarakhand" },
  { label: "West Bengal", value: "West Bengal" },
  { label: "Andaman and Nicobar Islands", value: "Andaman and Nicobar Islands" },
  { label: "Chandigarh", value: "Chandigarh" },
  { label: "Dadra and Nagar Haveli and Daman and Diu", value: "Dadra and Nagar Haveli and Daman and Diu" },
  { label: "Delhi", value: "Delhi" },
  { label: "Jammu and Kashmir", value: "Jammu and Kashmir" },
  { label: "Ladakh", value: "Ladakh" },
  { label: "Lakshadweep", value: "Lakshadweep" },
  { label: "Puducherry", value: "Puducherry" },
];

type FuelType = "petrol" | "diesel" | "none";

function fmtIN(n: number): string {
  return n.toLocaleString("en-IN");
}

function parseAmount(s: string): number {
  return parseInt(s.replace(/[^0-9]/g, ""), 10) || 0;
}

function onCurrencyChange(
  setter: (v: string) => void,
  raw: string
) {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) { setter(""); return; }
  setter(fmtIN(parseInt(digits, 10)));
}

const inputCls = (hasError: boolean, disabled = false) =>
  [
    "w-full bg-zinc-900 border rounded-xl pl-9 pr-4 py-3.5 text-lg text-[#fafafa]",
    "placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-amber-500",
    "transition-colors",
    hasError ? "border-red-500" : "border-zinc-800 focus:border-amber-500",
    disabled ? "opacity-40 cursor-not-allowed" : "",
  ]
    .filter(Boolean)
    .join(" ");

export default function Home() {
  const router = useRouter();

  const [tickerVisible, setTickerVisible] = useState(false);
  const [annualIncome, setAnnualIncome] = useState("");
  const [isSalaried, setIsSalaried] = useState(true);
  const [state, setState] = useState("Delhi");
  const [monthlyFuelSpend, setMonthlyFuelSpend] = useState("");
  const [fuelType, setFuelType] = useState<FuelType>("petrol");
  const [monthlyDiscretionary, setMonthlyDiscretionary] = useState("");
  const [annualBigPurchases, setAnnualBigPurchases] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const t = setTimeout(() => setTickerVisible(true), 150);
    return () => clearTimeout(t);
  }, []);

  function validate(): boolean {
    const e: Record<string, string> = {};
    if (!parseAmount(annualIncome)) {
      e.annualIncome = "Please enter your annual income";
    }
    if (fuelType !== "none" && !monthlyFuelSpend) {
      e.monthlyFuelSpend = 'Please enter your monthly fuel spend, or select "I don\'t drive"';
    }
    if (monthlyDiscretionary === "") {
      e.monthlyDiscretionary =
        "Please enter your monthly discretionary spend (enter 0 if none)";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    const fuelSpend = parseAmount(monthlyFuelSpend);
    const taxInput: TaxInput = {
      annualIncome: parseAmount(annualIncome),
      isSalaried,
      state,
      monthlyPetrolLitres: fuelType === "petrol" ? fuelSpend / PETROL_PRICE : 0,
      monthlyDieselLitres: fuelType === "diesel" ? fuelSpend / DIESEL_PRICE : 0,
      monthlyDiscretionarySpend: parseAmount(monthlyDiscretionary),
      annualBigPurchases: parseAmount(annualBigPurchases),
    };

    localStorage.setItem("taxInput", JSON.stringify(taxInput));
    router.push("/receipt");
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      {/* ── Top nav ── */}
      <nav className="max-w-lg mx-auto px-4 pt-5 flex justify-between items-center">
        <span className="text-xs text-zinc-600 font-medium tracking-wide uppercase">Tax Receipt India</span>
        <a href="/flow" className="text-xs text-zinc-500 hover:text-amber-400 transition-colors">
          Budget breakdown →
        </a>
      </nav>
      <form
        id="tax-form"
        onSubmit={handleSubmit}
        noValidate
        className="max-w-lg mx-auto px-4 pt-8 pb-36"
      >
        {/* ── Ticker stat ─────────────────────────────────────────── */}
        <div
          aria-live="polite"
          className={`mb-10 rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-4 transition-all duration-500 ease-out ${
            tickerVisible
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-3 pointer-events-none"
          }`}
        >
          <p className="text-sm text-amber-300 leading-relaxed">
            In FY 2026-27, the government will spend{" "}
            <strong className="font-semibold text-amber-200">₹53.5 lakh crore</strong>.{" "}
            ₹13.9 lakh crore of that is interest on past borrowing — bigger than
            defence, education, and health combined.
          </p>
          <a
            href="https://prsindia.org/files/budget/budget_parliament/2026/Union_Budget_Analysis-2026-27.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-xs text-amber-500/60 underline underline-offset-2 hover:text-amber-500/90 transition-colors"
          >
            Source: PRS India Budget Analysis 2026-27 ↗
          </a>
        </div>

        {/* ── Hero ────────────────────────────────────────────────── */}
        <div className="mb-10">
          <h1 className="text-[2rem] font-bold leading-tight mb-3 text-balance">
            How much do you actually pay in tax?
          </h1>
          <p className="text-zinc-400 text-base leading-relaxed">
            Income tax is just the start. Add the GST on every purchase, the tax
            on every litre of fuel, and the picture changes.
          </p>
        </div>

        <div className="space-y-8">
          {/* ── Annual income ─────────────────────────────────────── */}
          <div>
            <label
              htmlFor="annualIncome"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Annual gross income
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg select-none pointer-events-none">
                ₹
              </span>
              <input
                id="annualIncome"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={annualIncome}
                onChange={(e) => onCurrencyChange(setAnnualIncome, e.target.value)}
                onBlur={() => {
                  if (errors.annualIncome && parseAmount(annualIncome)) {
                    setErrors((p) => { const n = { ...p }; delete n.annualIncome; return n; });
                  }
                }}
                placeholder="0"
                className={inputCls(!!errors.annualIncome)}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">Before tax, including bonus</p>
            {errors.annualIncome && (
              <p role="alert" className="mt-1.5 text-xs text-red-400">
                {errors.annualIncome}
              </p>
            )}
          </div>

          {/* ── Salaried toggle ───────────────────────────────────── */}
          <div>
            <p className="block text-sm font-medium text-zinc-300 mb-1.5">
              Employment type
            </p>
            <div
              role="group"
              aria-label="Employment type"
              className="flex rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900"
            >
              <button
                type="button"
                aria-pressed={isSalaried}
                onClick={() => setIsSalaried(true)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors min-h-[44px] ${
                  isSalaried
                    ? "bg-amber-500 text-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Salaried
              </button>
              <button
                type="button"
                aria-pressed={!isSalaried}
                onClick={() => setIsSalaried(false)}
                className={`flex-1 py-3.5 text-sm font-medium transition-colors min-h-[44px] ${
                  !isSalaried
                    ? "bg-amber-500 text-black"
                    : "text-zinc-400 hover:text-zinc-200"
                }`}
              >
                Self-employed
              </button>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Salaried employees get a ₹75,000 standard deduction under the new regime
            </p>
          </div>

          {/* ── State ─────────────────────────────────────────────── */}
          <div>
            <label
              htmlFor="state"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              State
            </label>
            <div className="relative">
              <select
                id="state"
                value={state}
                onChange={(e) => setState(e.target.value)}
                className="w-full appearance-none bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3.5 pr-10 text-[#fafafa] focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-colors min-h-[52px]"
              >
                {STATES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500">
                ▾
              </span>
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">Used for state fuel VAT calculation</p>
          </div>

          {/* ── Monthly fuel spend ────────────────────────────────── */}
          <div>
            <label
              htmlFor="monthlyFuelSpend"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Monthly fuel spend
            </label>
            <div className="relative">
              <span
                className={`absolute left-3 top-1/2 -translate-y-1/2 text-lg select-none pointer-events-none transition-colors ${
                  fuelType === "none" ? "text-zinc-700" : "text-zinc-400"
                }`}
              >
                ₹
              </span>
              <input
                id="monthlyFuelSpend"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={monthlyFuelSpend}
                onChange={(e) => onCurrencyChange(setMonthlyFuelSpend, e.target.value)}
                onBlur={() => {
                  if (errors.monthlyFuelSpend && (monthlyFuelSpend || fuelType === "none")) {
                    setErrors((p) => { const n = { ...p }; delete n.monthlyFuelSpend; return n; });
                  }
                }}
                disabled={fuelType === "none"}
                placeholder="0"
                className={inputCls(!!errors.monthlyFuelSpend, fuelType === "none")}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">Approximate</p>
            {errors.monthlyFuelSpend && (
              <p role="alert" className="mt-1.5 text-xs text-red-400">
                {errors.monthlyFuelSpend}
              </p>
            )}
          </div>

          {/* ── Fuel type ─────────────────────────────────────────── */}
          <div>
            <p className="block text-sm font-medium text-zinc-300 mb-1.5">
              Fuel type
            </p>
            <div role="radiogroup" aria-label="Fuel type" className="space-y-2">
              {(
                [
                  { value: "petrol", label: "Petrol" },
                  { value: "diesel", label: "Diesel" },
                  { value: "none", label: "I don't drive" },
                ] as { value: FuelType; label: string }[]
              ).map((opt) => (
                <label
                  key={opt.value}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-colors min-h-[52px] ${
                    fuelType === opt.value
                      ? "border-amber-500/60 bg-amber-500/[0.06]"
                      : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
                  }`}
                >
                  <input
                    type="radio"
                    name="fuelType"
                    value={opt.value}
                    checked={fuelType === opt.value}
                    onChange={() => {
                      setFuelType(opt.value);
                      if (opt.value === "none") {
                        setErrors((p) => {
                          const n = { ...p };
                          delete n.monthlyFuelSpend;
                          return n;
                        });
                      }
                    }}
                    className="w-5 h-5 accent-amber-500 shrink-0"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* ── Monthly discretionary spend ───────────────────────── */}
          <div>
            <label
              htmlFor="monthlyDiscretionary"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Monthly discretionary spend
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg select-none pointer-events-none">
                ₹
              </span>
              <input
                id="monthlyDiscretionary"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={monthlyDiscretionary}
                onChange={(e) =>
                  onCurrencyChange(setMonthlyDiscretionary, e.target.value)
                }
                onBlur={() => {
                  if (errors.monthlyDiscretionary && monthlyDiscretionary !== "") {
                    setErrors((p) => { const n = { ...p }; delete n.monthlyDiscretionary; return n; });
                  }
                }}
                placeholder="0"
                className={inputCls(!!errors.monthlyDiscretionary)}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500 leading-relaxed">
              Groceries, dining, shopping, services, subscriptions — anything where
              GST applies. Skip rent and EMIs.
            </p>
            {errors.monthlyDiscretionary && (
              <p role="alert" className="mt-1.5 text-xs text-red-400">
                {errors.monthlyDiscretionary}
              </p>
            )}
          </div>

          {/* ── Big purchases ─────────────────────────────────────── */}
          <div>
            <label
              htmlFor="annualBigPurchases"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Big purchases this year{" "}
              <span className="text-zinc-500 font-normal">(optional)</span>
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-lg select-none pointer-events-none">
                ₹
              </span>
              <input
                id="annualBigPurchases"
                type="text"
                inputMode="numeric"
                autoComplete="off"
                value={annualBigPurchases}
                onChange={(e) =>
                  onCurrencyChange(setAnnualBigPurchases, e.target.value)
                }
                placeholder="0"
                className={inputCls(false)}
              />
            </div>
            <p className="mt-1.5 text-xs text-zinc-500">
              Cars, electronics, furniture — items with 18–28% GST
            </p>
          </div>

          {/* ── Trust badges ──────────────────────────────────────── */}
          <div className="pt-4 border-t border-zinc-800/50">
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5">
                <span aria-hidden>📊</span>
                Sources: PRS, Union Budget 2026-27
              </span>
              <a
                href="/methodology"
                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5 hover:border-zinc-600 hover:text-zinc-400 transition-colors"
              >
                <span aria-hidden>🔍</span>
                Methodology: open &amp; auditable
              </a>
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-900 border border-zinc-800 rounded-full px-3 py-1.5">
                <span aria-hidden>🔒</span>
                No accounts. No tracking. Your data never leaves this device.
              </span>
            </div>
          </div>
        </div>
      </form>

      {/* ── Sticky submit ───────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a]/95 backdrop-blur-sm border-t border-zinc-800/80 px-4 py-4 z-10">
        <div className="max-w-lg mx-auto">
          <button
            type="submit"
            form="tax-form"
            className="w-full bg-amber-500 hover:bg-amber-400 active:scale-[0.98] text-black font-semibold text-base rounded-xl py-4 transition-all duration-150 hover:scale-[1.01] min-h-[56px]"
          >
            Show me my real tax bill →
          </button>
        </div>
      </div>
    </div>
  );
}
