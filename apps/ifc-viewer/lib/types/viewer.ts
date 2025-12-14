// Core viewer types for BOB IFC Viewer

export type ViewerColorMode =
  | "default"
  | "byType"
  | "byStorey"
  | "byZone"
  | "byMaterial"
  | "byClassification"
  | "byRuleStatus"

export type LogicalOp = "AND" | "OR"

export type RuleField =
  | { kind: "ifcType" }
  | { kind: "storeyId" }
  | { kind: "spaceId" }
  | { kind: "zoneId" }
  | { kind: "material" }
  | { kind: "classification" }
  | { kind: "property"; pset: string; prop: string; valueType: "string" | "number" | "boolean" }
  | { kind: "quantity"; name: "Length" | "Area" | "Volume" }
  | { kind: "ruleStatus"; ruleId?: string }

export type Operator =
  | "IN"
  | "NOT_IN"
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "IS_NULL"
  | "NOT_NULL"

export type FilterRule = {
  id: string
  type: "rule"
  field: RuleField
  op: Operator
  value?: string | number | boolean | string[] | number[]
}

export type FilterGroup = {
  id: string
  type: "group"
  op: LogicalOp
  children: Array<FilterGroup | FilterRule>
}

export type FilterPreset = {
  id: string
  name: string
  projectId: string
  modelId: string
  version: number
  expression: FilterGroup
  ui: { colorMode?: ViewerColorMode; nonResultsOpacity?: number }
  createdBy: string
  createdAt: string
}

export type SelectionSet = {
  id: string
  name: string
  projectId: string
  modelId: string
  version: number
  elementIds: string[]
  meta?: {
    source?: "filter" | "manual"
    expression?: FilterGroup
  }
  createdBy: string
  createdAt: string
}

export type FacetItem = {
  key: string
  count: number
}

export type FacetItemWithId = {
  id: string
  name: string
  count: number
}

export type PropertyValue = {
  pset: string
  props: Array<{
    name: string
    valueType: "string" | "number" | "boolean"
  }>
}

export type Facets = {
  ifcTypes: FacetItem[]
  storeys: FacetItemWithId[]
  spaces: FacetItemWithId[]
  zones: FacetItemWithId[]
  materials: FacetItem[]
  classifications: Array<{ system: string; code: string; count: number }>
  psets: PropertyValue[]
}

export type FilterResult = {
  resultCount: number
  elementIds: string[]
  stats: {
    byType: FacetItem[]
    byStorey: FacetItem[]
  }
}

export type ElementProperty = {
  elementId: string
  globalId: string
  ifcType: string
  name: string
  tag?: string
  storey?: string
  space?: string
  materials?: string[]
  quantities?: {
    Length?: number
    Area?: number
    Volume?: number
  }
  psets?: Record<string, Record<string, string | number | boolean>>
}

export type PropertiesResponse = {
  items: ElementProperty[]
}
