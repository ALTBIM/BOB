import { NextResponse } from "next/server"

// Example API route handler for issues
export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get("status")

  // Mock issues - replace with database query
  return NextResponse.json([])
}

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const body = await request.json()

  const issue = {
    id: `issue_${Date.now()}`,
    ...body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }

  return NextResponse.json(issue)
}
