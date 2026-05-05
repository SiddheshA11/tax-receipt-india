import { NextRequest, NextResponse } from "next/server";
import { generateFraming, FramingInput } from "@/lib/generateFraming";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body: FramingInput = await req.json();

    if (!body.breakdown || !body.profile) {
      return NextResponse.json({ error: "Missing breakdown or profile" }, { status: 400 });
    }

    const framing = await generateFraming(body);
    return NextResponse.json({ framing });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    // Don't expose internal errors to client
    console.error("[/api/framing]", message);
    return NextResponse.json({ error: "Failed to generate framing" }, { status: 500 });
  }
}
