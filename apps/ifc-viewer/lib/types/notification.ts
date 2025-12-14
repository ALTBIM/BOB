// Phase 3: Notification types

export type NotificationType =
  | "ISSUE_ASSIGNED"
  | "ISSUE_STATUS_CHANGED"
  | "COMMENT_ADDED"
  | "COMMENT_MENTION"
  | "BCF_IMPORT_COMPLETED"
  | "BCF_EXPORT_COMPLETED"
  | "RULE_CHECK_FAILED"

export type NotificationFrequency = "immediate" | "daily" | "weekly"

export type Notification = {
  id: string
  projectId: string
  type: NotificationType
  title: string
  message: string
  issueId?: string
  userId: string
  read: boolean
  createdAt: string
  metadata?: Record<string, any>
}

export type NotificationPreferences = {
  userId: string
  projectId: string
  preferences: Record<NotificationType, { enabled: boolean; frequency: NotificationFrequency }>
}
