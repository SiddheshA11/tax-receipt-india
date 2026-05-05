import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

const FRAMING_LINES: Record<string, string> = {
  interest_dominant: "60c of every rupee goes to debt interest",
  committed_spend: "Most of your taxes are already committed",
  defence_share: "Defence gets more than education + health combined",
  default: "See exactly where your money goes",
};

function fmtINR(n: number): string {
  if (n >= 10_000_000) return `Rs.${(n / 10_000_000).toFixed(1)}Cr`;
  if (n >= 100_000) return `Rs.${(n / 100_000).toFixed(1)}L`;
  return `Rs.${n.toLocaleString("en-IN")}`;
}

const SEGMENTS = [
  { id: "interest", label: "Interest", color: "#ef4444" },
  { id: "defence", label: "Defence", color: "#64748b" },
  { id: "subsidies", label: "Subsidies", color: "#475569" },
  { id: "education", label: "Education", color: "#334155" },
  { id: "health", label: "Health", color: "#1e293b" },
];

const SEGMENT_PCTS: Record<string, number> = {
  interest: 26.0,
  defence: 13.5,
  subsidies: 8.0,
  education: 6.5,
  health: 4.5,
};

const flex = "flex" as const;
const column = "column" as const;
const row = "row" as const;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const total = Number(searchParams.get("total") ?? 0);
  const pct = Number(searchParams.get("pct") ?? 0);
  const interest = Number(searchParams.get("interest") ?? 0);
  const framingKey = searchParams.get("framing") ?? "default";
  const framingLine = FRAMING_LINES[framingKey] ?? FRAMING_LINES.default;

  const barH = 380;
  const barW = 76;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#0a0a0a",
          display: flex,
          flexDirection: column,
          fontFamily: "sans-serif",
          color: "#fafafa",
        }}
      >
        {/* Main content row */}
        <div style={{ display: flex, flex: 1, padding: "52px 56px 0 56px" }}>

          {/* Left 60% */}
          <div
            style={{
              display: flex,
              flexDirection: column,
              width: "60%",
              paddingRight: 40,
              justifyContent: "center",
            }}
          >
            <div
              style={{
                display: flex,
                fontSize: 13,
                letterSpacing: "0.15em",
                color: "#71717a",
                textTransform: "uppercase",
                marginBottom: 16,
              }}
            >
              MY TAX RECEIPT - FY 2026-27
            </div>
            <div
              style={{
                display: flex,
                fontSize: 88,
                fontWeight: 800,
                lineHeight: 1,
                color: "#fafafa",
                marginBottom: 12,
              }}
            >
              {fmtINR(total)}
            </div>
            <div
              style={{
                display: flex,
                fontSize: 34,
                fontWeight: 700,
                color: "#f59e0b",
                marginBottom: 20,
              }}
            >
              {pct.toFixed(1)}% effective rate
            </div>
            {interest > 0 && (
              <div
                style={{
                  display: flex,
                  fontSize: 18,
                  color: "#ef4444",
                  marginBottom: 16,
                }}
              >
                Rs.{interest.toLocaleString("en-IN")} goes to debt interest
              </div>
            )}
            <div
              style={{
                display: flex,
                fontSize: 20,
                color: "#a1a1aa",
                lineHeight: 1.4,
                maxWidth: 480,
              }}
            >
              {framingLine}
            </div>
          </div>

          {/* Right 40% */}
          <div
            style={{
              width: "40%",
              display: flex,
              flexDirection: column,
              alignItems: "center",
              justifyContent: "flex-end",
              paddingBottom: 20,
            }}
          >
            <div
              style={{
                display: flex,
                fontSize: 11,
                letterSpacing: "0.12em",
                color: "#52525b",
                textTransform: "uppercase",
                marginBottom: 14,
              }}
            >
              Govt spend breakdown
            </div>
            <div
              style={{
                display: flex,
                flexDirection: row,
                alignItems: "flex-end",
                height: barH,
              }}
            >
              {SEGMENTS.map((seg) => {
                const segH = Math.max(8, Math.round((SEGMENT_PCTS[seg.id] / 58.5) * barH));
                return (
                  <div
                    key={seg.id}
                    style={{
                      display: flex,
                      flexDirection: column,
                      alignItems: "center",
                      justifyContent: "flex-end",
                      marginLeft: 6,
                    }}
                  >
                    <div
                      style={{
                        display: flex,
                        fontSize: 10,
                        color: "#71717a",
                        marginBottom: 4,
                        textAlign: "center",
                        width: barW,
                        justifyContent: "center",
                      }}
                    >
                      {seg.label}
                    </div>
                    <div
                      style={{
                        display: flex,
                        width: barW,
                        height: segH,
                        background: seg.color,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom strip */}
        <div
          style={{
            height: 52,
            borderTop: "1px solid #27272a",
            display: flex,
            alignItems: "center",
            padding: "0 56px",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: flex, fontSize: 15, color: "#f59e0b", fontWeight: 600 }}>
            Calculate yours at taxreceipt.in
          </div>
          <div style={{ display: flex, fontSize: 12, color: "#52525b" }}>
            Source: Union Budget 2026-27, PRS
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
