// Phase 2: Rule check types

export type RuleStatus = "PASS" | "FAIL" | "MISSING" | "NOT_CHECKED"

export type RuleDefinition = {
  id: string
  name: string
  description?: string
}

export type RuleResultSummary = {
  ruleId: string
  counts: { PASS: number; FAIL: number; MISSING: number; NOT_CHECKED: number }
}

export type RuleElementStatus = {
  elementId: string
  status: RuleStatus
  message?: string
}
