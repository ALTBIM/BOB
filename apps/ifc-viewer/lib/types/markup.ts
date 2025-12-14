// Phase 3: Markup types for issue annotations

export type MarkupTool = "PIN" | "RECT" | "FREEHAND" | "SELECT"

export type MarkupPin = {
  id: string
  type: "PIN"
  x: number // normalized 0-1
  y: number // normalized 0-1
  label?: string
}

export type MarkupRect = {
  id: string
  type: "RECT"
  x: number
  y: number
  w: number
  h: number
  label?: string
}

export type MarkupFreehand = {
  id: string
  type: "FREEHAND"
  points: Array<{ x: number; y: number }>
  label?: string
}

export type MarkupItem = MarkupPin | MarkupRect | MarkupFreehand

export type IssueMarkup = {
  issueId: string
  snapshotUrl: string
  items: MarkupItem[]
  updatedAt: string
}
