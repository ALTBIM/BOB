import { NextResponse } from "next/server"

// Example API route handler for rule results
export async function POST(request: Request, { params }: { params: { modelId: string; ruleId: string } }) {
  const body = await request.json()
  const { statusFilter, limit } = body

  // Mock rule results - replace with actual rule execution
  const items = Array.from({ length: 120 }, (_, i) => ({
    elementId: `el_${i + 1}`,
    status: statusFilter[0],
    message: statusFilter[0] === "FAIL" ? "Fire rating not specified" : undefined,
  }))

  return NextResponse.json({ items })
}
