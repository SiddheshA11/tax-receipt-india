import Link from "next/link";

export const metadata = {
  title: "Methodology | India Tax Receipt FY 2026-27",
  description:
    "How we calculate income tax, GST, fuel tax, and what this tool does not include.",
};

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mb-12">
      <h2 className="text-lg font-semibold text-zinc-100 mb-4 pb-2 border-b border-zinc-800">
        {title}
      </h2>
      <div className="space-y-4 text-zinc-300 text-sm leading-relaxed">{children}</div>
    </section>
  );
}

export default function MethodologyPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#fafafa]">
      <div className="max-w-2xl mx-auto px-5 pt-12 pb-24">
        <div className="mb-10">
          <Link href="/" className="text-zinc-500 hover:text-zinc-300 text-sm transition-colors">
            ← Back
          </Link>
          <h1 className="text-3xl font-bold mt-4 mb-2">Methodology</h1>
          <p className="text-zinc-500 text-sm">
            How figures are calculated, what data sources we use, and where the numbers fall short.
          </p>
        </div>

        <Section id="what-it-does" title="What this tool does">
          <p>
            This tool estimates the total tax burden of an Indian taxpayer for FY 2026-27 by
            combining direct and indirect taxes. Direct tax means income tax — the amount you
            pay on your salary or professional income under the New Regime. Indirect taxes
            include GST embedded in your everyday purchases and the central excise plus state
            VAT baked into petrol and diesel prices. Together, these form the number most
            Indians never see in one place.
          </p>
          <p>
            The second part of the tool visualizes where central government expenditure goes.
            Using FY 2026-27 Union Budget figures, it shows how your tax rupees flow through the
            Consolidated Fund of India and out to major spending categories — interest payments,
            defence, subsidies, capital expenditure, and centrally sponsored schemes. The goal
            is not to make a political argument but to make public finance legible to ordinary
            citizens.
          </p>
        </Section>

        <Section id="sources" title="Sources">
          <ul className="space-y-2 list-none">
            {[
              {
                label: "Union Budget 2026-27",
                url: "https://www.indiabudget.gov.in/",
                note: "Official budget documents, receipts, and expenditure statements",
              },
              {
                label: "PRS Legislative Research — Budget Analysis 2026-27",
                url: "https://prsindia.org/files/budget/budget_parliament/2026/Union_Budget_Analysis-2026-27.pdf",
                note: "Primary source for expenditure category percentages and committed spend analysis",
              },
              {
                label: "Petroleum Planning & Analysis Cell (PPAC)",
                url: "https://ppac.gov.in/",
                note: "Central excise and state VAT rates on petrol and diesel",
              },
              {
                label: "CBDT — Income Tax Slabs FY 2026-27",
                url: "https://www.incometax.gov.in/",
                note: "New Regime slab rates, standard deduction, 87A rebate threshold",
              },
              {
                label: "15th Finance Commission Report",
                url: "https://fincomindia.nic.in/",
                note: "Centre-state revenue sharing formula underpinning the GST split",
              },
            ].map((s) => (
              <li key={s.url} className="flex flex-col gap-0.5">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-amber-400 hover:text-amber-300 font-medium transition-colors"
                >
                  {s.label} ↗
                </a>
                <span className="text-zinc-500 text-xs">{s.note}</span>
              </li>
            ))}
          </ul>
        </Section>

        <Section id="income-tax" title="How income tax is calculated">
          <p>
            We apply the FY 2026-27 New Regime slab rates to your taxable income. Taxable
            income is gross income minus the ₹75,000 standard deduction for salaried individuals
            (₹0 for non-salaried). The slabs are:
          </p>
          <div className="bg-zinc-900 rounded-lg overflow-hidden my-4">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2.5 text-zinc-400 font-medium">Income range</th>
                  <th className="text-right px-4 py-2.5 text-zinc-400 font-medium">Rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {[
                  ["Up to ₹4,00,000", "0%"],
                  ["₹4,00,001 – ₹8,00,000", "5%"],
                  ["₹8,00,001 – ₹12,00,000", "10%"],
                  ["₹12,00,001 – ₹16,00,000", "15%"],
                  ["₹16,00,001 – ₹20,00,000", "20%"],
                  ["₹20,00,001 – ₹24,00,000", "25%"],
                  ["Above ₹24,00,000", "30%"],
                ].map(([range, rate]) => (
                  <tr key={range}>
                    <td className="px-4 py-2.5 text-zinc-300">{range}</td>
                    <td className="px-4 py-2.5 text-zinc-300 text-right font-mono">{rate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            If taxable income is ₹12,00,000 or below, we apply the Section 87A rebate, which
            reduces your net tax liability to zero. Surcharge applies at 10% for income above
            ₹50 lakh, 15% above ₹1 crore, and 25% above ₹2 crore. Health and Education Cess
            of 4% applies to the sum of tax and surcharge.
          </p>
          <p className="text-zinc-500">
            <span className="font-semibold text-zinc-400">Known limitation:</span> We compute
            only the New Regime. Old Regime calculations (with deductions under 80C, 80D, HRA,
            etc.) are not supported. If you are on the Old Regime, your actual income tax will
            differ — potentially significantly lower for high-deduction profiles.
          </p>
        </Section>

        <Section id="gst" title="How GST is estimated">
          <p>
            GST is the hardest figure to estimate accurately because it depends on exactly what
            you buy. We do not have that data. Instead we apply assumed spending-mix ratios to
            your monthly discretionary spend and annual big purchases, then compute a range.
          </p>
          <p>For monthly discretionary spend we assume:</p>
          <ul className="list-disc list-inside space-y-1 pl-2 text-zinc-400">
            <li>
              <span className="text-zinc-300">30% essentials</span> (groceries, unbranded food,
              medicines) — taxed at 0–5%
            </li>
            <li>
              <span className="text-zinc-300">40% goods</span> (packaged food, appliances,
              clothing) — 12–18%
            </li>
            <li>
              <span className="text-zinc-300">25% services</span> (restaurants, telecom,
              financial, personal care) — 18%
            </li>
            <li>
              <span className="text-zinc-300">5% luxury/sin</span> (luxury goods, branded
              apparel, tobacco) — 28% plus cess
            </li>
          </ul>
          <p>For large one-off purchases we assume an 18–28% range.</p>
          <p>
            This produces a low–mid–high estimate rather than a single figure. The mid estimate
            is the simple average of low and high.
          </p>
          <p className="text-zinc-500">
            <span className="font-semibold text-zinc-400">Limitations:</span> This estimate
            does not account for input tax credits passed through to consumers via lower prices,
            regional rate variations across states, or exemptions on specific items (e.g.,
            fresh produce, healthcare services). The true GST incidence may be lower than our
            estimate for high-B2B-exposure spending.
          </p>
        </Section>

        <Section id="fuel-tax" title="How fuel tax is calculated">
          <p>
            Fuel taxes have two components. Central excise is a fixed per-litre amount: ₹13/L on
            petrol and ₹10/L on diesel, as of FY 2026-27. State VAT is ad-valorem — applied as a
            percentage of a base that typically includes the price-to-dealer, central excise, and
            dealer commission.
          </p>
          <p>
            We approximate the VAT base as 60% of the retail pump price (a conservative estimate
            consistent with PPAC data across major states). We use state-specific VAT rates for
            12 large states and a national average of 25% for all others. Combined, these give
            an estimated fuel-tax total per litre, multiplied by your reported monthly volume
            and annualised.
          </p>
          <p className="text-zinc-500">
            <span className="font-semibold text-zinc-400">Note:</span> Fuel prices change
            frequently and vary by city. We use approximate national averages of ₹105/L petrol
            and ₹92/L diesel. Your actual pump price may differ.
          </p>
        </Section>

        <Section id="not-included" title="What this tool does NOT include">
          <p>
            The figures shown here are likely an undercount of your real total tax burden.
            Categories not included:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
            {[
              "State taxes: property tax, professional tax, road tax on vehicles",
              "Capital gains tax (short-term and long-term)",
              "Securities Transaction Tax (STT) on equity trades",
              "Customs duties on imported goods, passed on in retail prices",
              "Stamp duty on property and financial transactions",
              "Entertainment tax and local body taxes",
              "Electricity duty levied by state DISCOMs",
            ].map((item) => (
              <li key={item} className="text-zinc-300">
                {item}
              </li>
            ))}
          </ul>
          <p className="text-zinc-500">
            Your actual total tax contribution to government revenues is higher than what this
            tool shows.
          </p>
        </Section>

        <Section id="macro-numbers" title="Where the macro numbers come from">
          <p>
            All FY 2026-27 expenditure figures are from PRS Legislative Research&apos;s analysis
            of the Union Budget presented on February 1, 2026. The headline figures:
          </p>
          <ul className="list-disc list-inside space-y-1.5 pl-2 text-zinc-400">
            {[
              "Total expenditure: ₹53,47,315 crore (PRS Budget Analysis 2026-27)",
              "Interest payments: ₹13,90,302 crore — 26.0% of total expenditure",
              "Defence: ₹7,84,678 crore — 14.7% of total expenditure",
              "Subsidies: ₹4,54,773 crore — food (₹2,27,629 Cr), fertilizer (₹1,70,799 Cr)",
              "Capital expenditure: ₹12,20,000 crore — roads, railways, infrastructure",
              "Centrally sponsored schemes: ₹9,89,885 crore",
              "Committed expenditure (interest + salaries + pensions): ~65% of revenue receipts",
            ].map((item) => (
              <li key={item} className="text-zinc-300">
                {item}
              </li>
            ))}
          </ul>
          <p>
            Fiscal deficit is 4.3% of GDP. Total debt-to-GDP is approximately 55.6%. Borrowing
            in FY 2026-27: ₹16,95,768 crore.
          </p>
          <p>
            Underspending data is from PRS&apos;s analysis of FY 2025-26 revised estimates —
            Centrally Sponsored Schemes saw ₹2,03,802 crore (19%) unspent; Jal Jeevan Mission
            alone saw ₹50,000 crore underspent.
          </p>
        </Section>

        <Section id="feedback" title="Errors and feedback">
          <p>
            This tool is built on publicly available data with several approximations. If you
            find a factual error — wrong slab, outdated rate, incorrect source — please get in
            touch. Accuracy matters here.
          </p>
          <p>
            Email{" "}
            <a
              href="mailto:siddheshagarwal10@gmail.com"
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              siddheshagarwal10@gmail.com
            </a>{" "}
            or open an issue on{" "}
            <a
              href="https://github.com/siddheshagarwal/tax-receipt-india"
              target="_blank"
              rel="noopener noreferrer"
              className="text-amber-400 hover:text-amber-300 transition-colors"
            >
              GitHub ↗
            </a>
            .
          </p>
        </Section>

        <div className="border-t border-zinc-800 pt-8 text-center">
          <Link href="/" className="text-amber-400 hover:text-amber-300 text-sm font-medium transition-colors">
            ← Calculate your tax receipt
          </Link>
        </div>
      </div>
    </main>
  );
}
