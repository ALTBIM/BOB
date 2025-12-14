import { NextResponse } from "next/server"
import { nanoid } from "nanoid"
import type { Notification } from "@/lib/types/notification"

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  try {
    const { searchParams } = new URL(request.url)
    const unreadOnly = searchParams.get("unread") === "true"

    // Stub implementation - return sample notifications
    const notifications: Notification[] = [
      {
        id: nanoid(),
        projectId: params.projectId,
        type: "ISSUE_ASSIGNED",
        title: "New issue assigned",
        message: "You have been assigned to 'Wall alignment issue'",
        issueId: "issue1",
        userId: "current-user",
        read: false,
        createdAt: new Date(Date.now() - 3600000).toISOString(),
      },
      {
        id: nanoid(),
        projectId: params.projectId,
        type: "COMMENT_MENTION",
        title: "You were mentioned",
        message: "Emma Johnson mentioned you in a comment",
        issueId: "issue2",
        userId: "current-user",
        read: false,
        createdAt: new Date(Date.now() - 7200000).toISOString(),
      },
      {
        id: nanoid(),
        projectId: params.projectId,
        type: "BCF_IMPORT_COMPLETED",
        title: "BCF import completed",
        message: "Successfully imported 12 issues from external-issues.bcfzip",
        userId: "current-user",
        read: true,
        createdAt: new Date(Date.now() - 86400000).toISOString(),
      },
    ]

    const filtered = unreadOnly ? notifications.filter((n) => !n.read) : notifications

    return NextResponse.json(filtered)
  } catch (error) {
    console.error("Get notifications error:", error)
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 })
  }
}
