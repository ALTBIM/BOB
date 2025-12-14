import { NextResponse } from "next/server"
import { nanoid } from "nanoid"
import type { IssueComment } from "@/lib/types/comment"

export async function GET(request: Request, { params }: { params: { projectId: string; issueId: string } }) {
  try {
    // Stub implementation - return sample comments
    const comments: IssueComment[] = [
      {
        id: nanoid(),
        issueId: params.issueId,
        text: "This needs to be addressed before the inspection next week.",
        author: {
          userId: "user1",
          name: "John Smith",
          companyId: "c1",
        },
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: nanoid(),
        issueId: params.issueId,
        text: "I've contacted the contractor about this. Should be fixed by tomorrow.",
        author: {
          userId: "user2",
          name: "Emma Johnson",
          companyId: "c2",
        },
        createdAt: new Date(Date.now() - 43200000).toISOString(),
      },
    ]

    return NextResponse.json(comments)
  } catch (error) {
    console.error("Get comments error:", error)
    return NextResponse.json({ error: "Failed to fetch comments" }, { status: 500 })
  }
}

export async function POST(request: Request, { params }: { params: { projectId: string; issueId: string } }) {
  try {
    const body = await request.json()

    // Stub implementation - in production, this would:
    // 1. Validate user authentication
    // 2. Store comment in database
    // 3. Process mentions and create notifications
    // 4. Return created comment

    const comment: IssueComment = {
      id: nanoid(),
      issueId: params.issueId,
      text: body.text,
      author: {
        userId: "current-user",
        name: "Current User",
      },
      mentions: body.mentions,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json(comment)
  } catch (error) {
    console.error("Add comment error:", error)
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 })
  }
}
