import Anthropic from "@anthropic-ai/sdk";
import { TaxBreakdown } from "./calculateTax";
import { budgetData } from "./budgetData";

export interface FramingInput {
  breakdown: TaxBreakdown;
  profile: {
    income: number;
    state: string;
    fuelMonthly: number;
  };
}

const SYSTEM_PROMPT = `You write one-line viral statements about Indian government finances for a tax visualization tool. Given a user's tax breakdown and FY 2026-27 budget data, generate ONE surprising, factually accurate line that would make this person stop scrolling. Use Indian rupee notation (₹X lakh, ₹X crore). Be neutral — not partisan. Compare numbers in human-meaningful ways (months of rent, equivalent in healthcare, etc.). One line, max 25 words. No emoji.`;

export async function generateFraming(input: FramingInput): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");

  const client = new Anthropic({ apiKey });

  const { breakdown, profile } = input;
  const totalMid = Math.round(breakdown.totalTax.mid);
  const interestShare = Math.round(totalMid * 0.26);
  const incomeTax = breakdown.totalIncomeTax;
  const effectivePct = (breakdown.effectiveRate.mid * 100).toFixed(1);
  const committedPct = budgetData.committed_expenditure_pct_revenue;

  const userPrompt = `User tax breakdown for FY 2026-27:
- Gross income: ₹${(profile.income / 100000).toFixed(1)} lakh
- State: ${profile.state}
- Total estimated tax (mid): ₹${totalMid.toLocaleString("en-IN")}
- Effective rate: ${effectivePct}%
- Income tax paid: ₹${incomeTax.toLocaleString("en-IN")}
- Fuel tax (annual): ₹${breakdown.fuelTax.total.toLocaleString("en-IN")}
- GST on spending (mid): ₹${breakdown.gst.mid.toLocaleString("en-IN")}
- Share going to debt interest: ₹${interestShare.toLocaleString("en-IN")} (26%)

Key FY 2026-27 budget facts:
- Total central expenditure: ₹53.47 lakh crore
- Interest payments alone: ₹13.9 lakh crore (26% of all spending)
- Committed spend (interest + salaries + pensions): ${committedPct}% of revenue receipts
- Defence: ₹7.85 lakh crore (14.7%)
- Subsidies: ₹4.55 lakh crore (food + fertilizer)
- Jal Jeevan Mission underspent by ₹50,000 crore in FY25-26

Generate one line (max 25 words) that makes this specific user understand something surprising about their taxes. Be factually accurate. No emoji.`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { type: "text"; text: string }).text)
    .join("")
    .trim();

  return text;
}
