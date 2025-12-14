// Phase 3: BCF (BIM Collaboration Format) types

export type BCFVersion = 2.1 | 3

export type BCFExportScope = "all" | "filtered" | "selected"

export type BCFExportOptions = {
  includeViewpoints: boolean
  includeSnapshots: boolean
  includeComments: boolean
  includeRuleContext: boolean
}

export type BCFExportRequest = {
  modelId: string
  version: number
  scope: BCFExportScope
  issueIds?: string[]
  options: BCFExportOptions
}

export type BCFExportResponse = {
  downloadUrl: string
  filename: string
  issueCount: number
}

export type BCFImportOptions = {
  createNewIssues: boolean
  updateExistingByGuid: boolean
  mergeComments: boolean
  overwriteViewpoints: boolean
}

export type BCFImportWarning = {
  issueTitle: string
  message: string
}

export type BCFImportResult = {
  created: number
  updated: number
  skipped: number
  warnings: BCFImportWarning[]
}
