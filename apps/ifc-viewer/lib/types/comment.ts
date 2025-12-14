// Phase 3: Comment types with mentions

export type CommentMentionType = "user" | "role" | "company"

export type CommentMention = {
  type: CommentMentionType
  value: string
  id: string
}

export type IssueComment = {
  id: string
  issueId: string
  text: string
  author: {
    userId: string
    name: string
    companyId?: string
  }
  mentions?: CommentMention[]
  createdAt: string
  updatedAt?: string
}
