// Phase 3: Participant types for role-based assignment

export type ProjectRole = {
  id: string
  name: string
  description?: string
}

export type ProjectCompany = {
  id: string
  name: string
  logoUrl?: string
}

export type ProjectUser = {
  id: string
  name: string
  email: string
  companyId: string
  roles: string[]
  avatarUrl?: string
}

export type ProjectParticipants = {
  companies: ProjectCompany[]
  roles: ProjectRole[]
  users: ProjectUser[]
}

export type IssueAssignee = {
  type: "user" | "role" | "company-role"
  userId?: string
  roleId?: string
  companyId?: string
  displayName: string
}
