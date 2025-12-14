"use client"

// Viewer state management using React hooks and context

import { create } from "zustand"
import type {
  ViewerColorMode,
  FilterGroup,
  FilterResult,
  Facets,
  FilterPreset,
  SelectionSet,
  ElementProperty,
} from "@/lib/types/viewer"
import type { SavedView } from "@/lib/types/viewpoint"
import type { Issue } from "@/lib/types/issue"
import type { RuleDefinition } from "@/lib/types/rules"
import type { IssueComment } from "@/lib/types/comment"
import type { IssueMarkup, MarkupTool } from "@/lib/types/markup"
import type { ProjectParticipants } from "@/lib/types/participant"
import type { Notification } from "@/lib/types/notification"

type VisibilityMode = "showAll" | "filtered" | "isolated"

interface ViewerState {
  // Filter state
  currentFilter: FilterGroup | null
  filterResults: FilterResult | null
  facets: Facets | null
  filterPresets: FilterPreset[]

  // Selection state
  selectedIds: string[]
  selectedProperties: ElementProperty[]
  selectionSets: SelectionSet[]

  // Visibility state
  visibilityMode: VisibilityMode
  hiddenIds: string[]
  isolatedIds: string[]

  // UI state
  nonResultsOpacity: number
  colorMode: ViewerColorMode
  isLoading: boolean
  error: string | null

  savedViews: SavedView[]
  issues: Issue[]
  rules: RuleDefinition[]
  activeRuleId: string | null

  selectedIssueId: string | null
  issueComments: Record<string, IssueComment[]>
  issueMarkup: Record<string, IssueMarkup>
  markupTool: MarkupTool
  participants: ProjectParticipants | null
  notifications: Notification[]
  unreadNotificationCount: number

  // Actions
  setCurrentFilter: (filter: FilterGroup | null) => void
  setFilterResults: (results: FilterResult | null) => void
  setFacets: (facets: Facets) => void
  setFilterPresets: (presets: FilterPreset[]) => void
  addFilterPreset: (preset: FilterPreset) => void

  setSelectedIds: (ids: string[]) => void
  setSelectedProperties: (properties: ElementProperty[]) => void
  setSelectionSets: (sets: SelectionSet[]) => void
  addSelectionSet: (set: SelectionSet) => void

  setVisibilityMode: (mode: VisibilityMode) => void
  setHiddenIds: (ids: string[]) => void
  setIsolatedIds: (ids: string[]) => void

  setNonResultsOpacity: (opacity: number) => void
  setColorMode: (mode: ViewerColorMode) => void
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void

  setSavedViews: (views: SavedView[]) => void
  addSavedView: (view: SavedView) => void
  removeSavedView: (viewId: string) => void

  setIssues: (issues: Issue[]) => void
  addIssue: (issue: Issue) => void
  updateIssue: (issueId: string, updates: Partial<Issue>) => void

  setRules: (rules: RuleDefinition[]) => void
  setActiveRuleId: (ruleId: string | null) => void

  setSelectedIssueId: (issueId: string | null) => void
  setIssueComments: (issueId: string, comments: IssueComment[]) => void
  addIssueComment: (issueId: string, comment: IssueComment) => void
  setIssueMarkup: (issueId: string, markup: IssueMarkup) => void
  setMarkupTool: (tool: MarkupTool) => void
  setParticipants: (participants: ProjectParticipants) => void
  setNotifications: (notifications: Notification[]) => void
  addNotification: (notification: Notification) => void
  markNotificationRead: (notificationId: string) => void

  reset: () => void
}

const initialState = {
  currentFilter: null,
  filterResults: null,
  facets: null,
  filterPresets: [],
  selectedIds: [],
  selectedProperties: [],
  selectionSets: [],
  visibilityMode: "showAll" as VisibilityMode,
  hiddenIds: [],
  isolatedIds: [],
  nonResultsOpacity: 0.2,
  colorMode: "default" as ViewerColorMode,
  isLoading: false,
  error: null,
  savedViews: [],
  issues: [],
  rules: [],
  activeRuleId: null,
  selectedIssueId: null,
  issueComments: {},
  issueMarkup: {},
  markupTool: "SELECT" as MarkupTool,
  participants: null,
  notifications: [],
  unreadNotificationCount: 0,
}

export const useViewerStore = create<ViewerState>((set) => ({
  ...initialState,

  setCurrentFilter: (filter) => set({ currentFilter: filter }),
  setFilterResults: (results) => set({ filterResults: results }),
  setFacets: (facets) => set({ facets }),
  setFilterPresets: (presets) => set({ filterPresets: presets }),
  addFilterPreset: (preset) =>
    set((state) => ({
      filterPresets: [...state.filterPresets, preset],
    })),

  setSelectedIds: (ids) => set({ selectedIds: ids }),
  setSelectedProperties: (properties) => set({ selectedProperties: properties }),
  setSelectionSets: (sets) => set({ selectionSets: sets }),
  addSelectionSet: (set_) =>
    set((state) => ({
      selectionSets: [...state.selectionSets, set_],
    })),

  setVisibilityMode: (mode) => set({ visibilityMode: mode }),
  setHiddenIds: (ids) => set({ hiddenIds: ids }),
  setIsolatedIds: (ids) => set({ isolatedIds: ids }),

  setNonResultsOpacity: (opacity) => set({ nonResultsOpacity: opacity }),
  setColorMode: (mode) => set({ colorMode: mode }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),

  setSavedViews: (views) => set({ savedViews: views }),
  addSavedView: (view) =>
    set((state) => ({
      savedViews: [...state.savedViews, view],
    })),
  removeSavedView: (viewId) =>
    set((state) => ({
      savedViews: state.savedViews.filter((v) => v.id !== viewId),
    })),

  setIssues: (issues) => set({ issues }),
  addIssue: (issue) =>
    set((state) => ({
      issues: [...state.issues, issue],
    })),
  updateIssue: (issueId, updates) =>
    set((state) => ({
      issues: state.issues.map((i) => (i.id === issueId ? { ...i, ...updates } : i)),
    })),

  setRules: (rules) => set({ rules }),
  setActiveRuleId: (ruleId) => set({ activeRuleId: ruleId }),

  setSelectedIssueId: (issueId) => set({ selectedIssueId: issueId }),

  setIssueComments: (issueId, comments) =>
    set((state) => ({
      issueComments: { ...state.issueComments, [issueId]: comments },
    })),

  addIssueComment: (issueId, comment) =>
    set((state) => ({
      issueComments: {
        ...state.issueComments,
        [issueId]: [...(state.issueComments[issueId] || []), comment],
      },
    })),

  setIssueMarkup: (issueId, markup) =>
    set((state) => ({
      issueMarkup: { ...state.issueMarkup, [issueId]: markup },
    })),

  setMarkupTool: (tool) => set({ markupTool: tool }),

  setParticipants: (participants) => set({ participants }),

  setNotifications: (notifications) =>
    set({
      notifications,
      unreadNotificationCount: notifications.filter((n) => !n.read).length,
    }),

  addNotification: (notification) =>
    set((state) => ({
      notifications: [notification, ...state.notifications],
      unreadNotificationCount: notification.read ? state.unreadNotificationCount : state.unreadNotificationCount + 1,
    })),

  markNotificationRead: (notificationId) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
      unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1),
    })),

  reset: () => set(initialState),
}))
