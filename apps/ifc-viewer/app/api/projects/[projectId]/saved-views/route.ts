import { NextResponse } from "next/server"

// Example API route handler for saved views
export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  const { searchParams } = new URL(request.url)
  const modelId = searchParams.get("modelId")

  // Mock saved views - replace with database query
  return NextResponse.json([])
}

export async function POST(request: Request, { params }: { params: { projectId: string } }) {
  const body = await request.json()

  const savedView = {
    id: `view_${Date.now()}`,
    ...body,
    createdAt: new Date().toISOString(),
  }

  return NextResponse.json(savedView)
}
