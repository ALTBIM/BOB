// Phase 2: Viewpoint and BCF types

import type { ViewerColorMode, FilterGroup } from "./viewer"

export type Viewpoint = {
  id: string
  projectId: string
  modelId: string
  version: number

  // Camera & navigation
  camera: {
    position: [number, number, number]
    target: [number, number, number]
    up: [number, number, number]
    fov?: number
  }

  // Visibility & selection context
  selectedIds: string[]
  highlightedIds: string[]
  hiddenIds: string[]
  isolatedIds?: string[]
  colorMode: ViewerColorMode
  nonResultsOpacity: number

  // Clipping
  clipping: {
    planes?: { enabled: boolean; x?: number; y?: number; z?: number }
    sectionBox?: { enabled: boolean; min: [number, number, number]; max: [number, number, number] }
  }

  // Filter context snapshot
  filter?: {
    expression: FilterGroup
    resultCount?: number
  }

  // Optional screenshot thumbnail
  snapshotUrl?: string

  createdBy: string
  createdAt: string
}

export type SavedView = {
  id: string
  name: string
  projectId: string
  modelId: string
  version: number
  viewpoint: Viewpoint
  createdBy: string
  createdAt: string
}
