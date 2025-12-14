import { NextResponse } from "next/server"

// Example API route handler for rule summary
export async function GET(request: Request, { params }: { params: { modelId: string; ruleId: string } }) {
  const { searchParams } = new URL(request.url)
  const version = searchParams.get("version")

  // Mock rule summary - replace with actual rule execution results
  const summary = {
    ruleId: params.ruleId,
    counts: {
      PASS: 800,
      FAIL: 120,
      MISSING: 45,
      NOT_CHECKED: 0,
    },
  }

  return NextResponse.json(summary)
}
