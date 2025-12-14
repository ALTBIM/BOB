// Phase 2: Issue/BCF types

import type { Viewpoint } from "./viewpoint"

export type IssueStatus = "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED"
export type IssuePriority = "LOW" | "MEDIUM" | "HIGH"

export type Issue = {
  id: string
  projectId: string
  modelId: string
  version: number

  title: string
  description?: string

  status: IssueStatus
  priority: IssuePriority

  assignee?: { userId: string; name: string }
  createdBy: { userId: string; name: string }

  viewpoint: Viewpoint

  labels?: string[]
  dueDate?: string

  createdAt: string
  updatedAt: string
}

export type IssueComment = {
  id: string
  issueId: string
  content: string
  author: { userId: string; name: string }
  createdAt: string
}
