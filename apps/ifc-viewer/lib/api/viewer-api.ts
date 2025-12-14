// API client for BOB IFC Viewer

import type {
  Facets,
  FilterGroup,
  FilterResult,
  PropertiesResponse,
  FilterPreset,
  SelectionSet,
} from "@/lib/types/viewer"
import type { SavedView } from "@/lib/types/viewpoint"
import type { Issue, IssueComment } from "@/lib/types/issue"
import type { RuleResultSummary, RuleElementStatus } from "@/lib/types/rules"
import type { IssueMarkup } from "@/lib/types/markup"
import type { BCFExportRequest, BCFExportResponse, BCFImportOptions, BCFImportResult } from "@/lib/types/bcf"
import type { ProjectParticipants } from "@/lib/types/participant"
import type { Notification, NotificationPreferences } from "@/lib/types/notification"

class ViewerAPI {
  private baseUrl = "/api"

  async getFacets(modelId: string, version: number): Promise<Facets> {
    const response = await fetch(`${this.baseUrl}/models/${modelId}/facets?version=${version}`)
    if (!response.ok) throw new Error("Failed to fetch facets")
    return response.json()
  }

  async executeFilter(modelId: string, version: number, expression: FilterGroup): Promise<FilterResult> {
    const response = await fetch(`${this.baseUrl}/models/${modelId}/filter`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        version,
        expression,
        return: "ids",
        limit: 200000,
      }),
    })
    if (!response.ok) throw new Error("Failed to execute filter")
    return response.json()
  }

  async getProperties(modelId: string, version: number, elementIds: string[]): Promise<PropertiesResponse> {
    const response = await fetch(`${this.baseUrl}/models/${modelId}/properties`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ version, elementIds }),
    })
    if (!response.ok) throw new Error("Failed to fetch properties")
    return response.json()
  }

  async getFilterPresets(projectId: string, modelId?: string, version?: number): Promise<FilterPreset[]> {
    const params = new URLSearchParams()
    if (modelId) params.append("modelId", modelId)
    if (version) params.append("version", version.toString())

    const response = await fetch(`${this.baseUrl}/projects/${projectId}/filter-presets?${params}`)
    if (!response.ok) throw new Error("Failed to fetch filter presets")
    return response.json()
  }

  async saveFilterPreset(projectId: string, preset: Omit<FilterPreset, "id" | "createdAt">): Promise<FilterPreset> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/filter-presets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preset),
    })
    if (!response.ok) throw new Error("Failed to save filter preset")
    return response.json()
  }

  async getSelectionSets(projectId: string, modelId?: string, version?: number): Promise<SelectionSet[]> {
    const params = new URLSearchParams()
    if (modelId) params.append("modelId", modelId)
    if (version) params.append("version", version.toString())

    const response = await fetch(`${this.baseUrl}/projects/${projectId}/selection-sets?${params}`)
    if (!response.ok) throw new Error("Failed to fetch selection sets")
    return response.json()
  }

  async saveSelectionSet(projectId: string, set: Omit<SelectionSet, "id" | "createdAt">): Promise<SelectionSet> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/selection-sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(set),
    })
    if (!response.ok) throw new Error("Failed to save selection set")
    return response.json()
  }

  async getSavedViews(projectId: string, modelId?: string, version?: number): Promise<SavedView[]> {
    const params = new URLSearchParams()
    if (modelId) params.append("modelId", modelId)
    if (version) params.append("version", version.toString())

    const response = await fetch(`${this.baseUrl}/projects/${projectId}/saved-views?${params}`)
    if (!response.ok) throw new Error("Failed to fetch saved views")
    return response.json()
  }

  async saveSavedView(projectId: string, view: Omit<SavedView, "id" | "createdAt">): Promise<SavedView> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/saved-views`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(view),
    })
    if (!response.ok) throw new Error("Failed to save view")
    return response.json()
  }

  async deleteSavedView(projectId: string, viewId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/saved-views/${viewId}`, {
      method: "DELETE",
    })
    if (!response.ok) throw new Error("Failed to delete view")
  }

  async getIssues(projectId: string, modelId?: string, status?: string, version?: number): Promise<Issue[]> {
    const params = new URLSearchParams()
    if (modelId) params.append("modelId", modelId)
    if (status) params.append("status", status)
    if (version) params.append("version", version.toString())

    const response = await fetch(`${this.baseUrl}/projects/${projectId}/issues?${params}`)
    if (!response.ok) throw new Error("Failed to fetch issues")
    return response.json()
  }

  async createIssue(projectId: string, issue: Omit<Issue, "id" | "createdAt" | "updatedAt">): Promise<Issue> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/issues`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(issue),
    })
    if (!response.ok) throw new Error("Failed to create issue")
    return response.json()
  }

  async updateIssue(projectId: string, issueId: string, updates: Partial<Issue>): Promise<Issue> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/issues/${issueId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    })
    if (!response.ok) throw new Error("Failed to update issue")
    return response.json()
  }

  async getIssueComments(projectId: string, issueId: string): Promise<IssueComment[]> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/issues/${issueId}/comments`)
    if (!response.ok) throw new Error("Failed to fetch comments")
    return response.json()
  }

  async addIssueComment(
    projectId: string,
    issueId: string,
    text: string,
    mentions?: Array<{ type: string; value: string; id: string }>,
  ): Promise<IssueComment> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/issues/${issueId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, mentions }),
    })
    if (!response.ok) throw new Error("Failed to add comment")
    return response.json()
  }

  // Markup
  async getIssueMarkup(projectId: string, issueId: string): Promise<IssueMarkup> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/issues/${issueId}/markup`)
    if (!response.ok) throw new Error("Failed to fetch markup")
    return response.json()
  }

  async saveIssueMarkup(projectId: string, issueId: string, markup: IssueMarkup): Promise<IssueMarkup> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/issues/${issueId}/markup`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(markup),
    })
    if (!response.ok) throw new Error("Failed to save markup")
    return response.json()
  }

  // BCF Export/Import
  async exportBCF(projectId: string, request: BCFExportRequest): Promise<BCFExportResponse> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/bcf/export`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    })
    if (!response.ok) throw new Error("Failed to export BCF")
    return response.json()
  }

  async importBCF(projectId: string, file: File, options: BCFImportOptions): Promise<BCFImportResult> {
    const formData = new FormData()
    formData.append("file", file)
    formData.append("options", JSON.stringify(options))

    const response = await fetch(`${this.baseUrl}/projects/${projectId}/bcf/import`, {
      method: "POST",
      body: formData,
    })
    if (!response.ok) throw new Error("Failed to import BCF")
    return response.json()
  }

  // Participants
  async getParticipants(projectId: string): Promise<ProjectParticipants> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/participants`)
    if (!response.ok) throw new Error("Failed to fetch participants")
    return response.json()
  }

  // Notifications
  async getNotifications(projectId: string, unreadOnly?: boolean): Promise<Notification[]> {
    const params = new URLSearchParams()
    if (unreadOnly) params.append("unread", "true")

    const response = await fetch(`${this.baseUrl}/projects/${projectId}/notifications?${params}`)
    if (!response.ok) throw new Error("Failed to fetch notifications")
    return response.json()
  }

  async markNotificationRead(projectId: string, notificationId: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/notifications/${notificationId}/read`, {
      method: "POST",
    })
    if (!response.ok) throw new Error("Failed to mark notification as read")
  }

  async getNotificationPreferences(projectId: string): Promise<NotificationPreferences> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/notification-preferences`)
    if (!response.ok) throw new Error("Failed to fetch preferences")
    return response.json()
  }

  async updateNotificationPreferences(
    projectId: string,
    preferences: NotificationPreferences,
  ): Promise<NotificationPreferences> {
    const response = await fetch(`${this.baseUrl}/projects/${projectId}/notification-preferences`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    })
    if (!response.ok) throw new Error("Failed to update preferences")
    return response.json()
  }

  async getRuleSummary(modelId: string, ruleId: string, version: number): Promise<RuleResultSummary> {
    const response = await fetch(`${this.baseUrl}/models/${modelId}/rules/${ruleId}/summary?version=${version}`)
    if (!response.ok) throw new Error("Failed to fetch rule summary")
    return response.json()
  }

  async getRuleResults(
    modelId: string,
    ruleId: string,
    version: number,
    statusFilter: string[],
  ): Promise<{ items: RuleElementStatus[] }> {
    const response = await fetch(`${this.baseUrl}/models/${modelId}/rules/${ruleId}/results?version=${version}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusFilter, limit: 200000 }),
    })
    if (!response.ok) throw new Error("Failed to fetch rule results")
    return response.json()
  }
}

export const viewerApi = new ViewerAPI()
