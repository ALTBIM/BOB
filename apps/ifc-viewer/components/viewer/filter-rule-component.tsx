"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Trash2, GripVertical } from "lucide-react"
import type { FilterRule, RuleField, Operator } from "@/lib/types/viewer"
import { useViewerStore } from "@/lib/store/viewer-store"
import { MultiSelect } from "./multi-select"

interface FilterRuleComponentProps {
  rule: FilterRule
  onChange: (rule: FilterRule) => void
  onRemove: () => void
}

const fieldTypes = [
  { value: "ifcType", label: "IFC Type" },
  { value: "storeyId", label: "Storey" },
  { value: "spaceId", label: "Space" },
  { value: "zoneId", label: "Zone" },
  { value: "material", label: "Material" },
  { value: "classification", label: "Classification" },
  { value: "property", label: "Property" },
  { value: "quantity", label: "Quantity" },
]

const operatorsByField: Record<string, Operator[]> = {
  ifcType: ["IN", "NOT_IN"],
  storeyId: ["IN", "NOT_IN"],
  spaceId: ["IN", "NOT_IN", "IS_NULL", "NOT_NULL"],
  zoneId: ["IN", "NOT_IN", "IS_NULL", "NOT_NULL"],
  material: ["CONTAINS", "NOT_CONTAINS", "IS_NULL", "NOT_NULL"],
  classification: ["CONTAINS", "NOT_CONTAINS", "IS_NULL", "NOT_NULL"],
  property: ["=", "!=", ">", ">=", "<", "<=", "CONTAINS", "NOT_CONTAINS", "IS_NULL", "NOT_NULL"],
  quantity: ["=", "!=", ">", ">=", "<", "<="],
}

const operatorLabels: Record<Operator, string> = {
  IN: "is one of",
  NOT_IN: "is not one of",
  "=": "equals",
  "!=": "not equals",
  ">": "greater than",
  ">=": "greater or equal",
  "<": "less than",
  "<=": "less or equal",
  CONTAINS: "contains",
  NOT_CONTAINS: "does not contain",
  IS_NULL: "is empty",
  NOT_NULL: "is not empty",
}

export function FilterRuleComponent({ rule, onChange, onRemove }: FilterRuleComponentProps) {
  const { facets } = useViewerStore()

  const fieldKind = rule.field.kind

  const handleFieldChange = (kind: string) => {
    let newField: RuleField
    switch (kind) {
      case "ifcType":
        newField = { kind: "ifcType" }
        break
      case "storeyId":
        newField = { kind: "storeyId" }
        break
      case "spaceId":
        newField = { kind: "spaceId" }
        break
      case "zoneId":
        newField = { kind: "zoneId" }
        break
      case "material":
        newField = { kind: "material" }
        break
      case "classification":
        newField = { kind: "classification" }
        break
      case "property":
        newField = { kind: "property", pset: "", prop: "", valueType: "string" }
        break
      case "quantity":
        newField = { kind: "quantity", name: "Length" }
        break
      default:
        newField = { kind: "ifcType" }
    }

    const availableOps = operatorsByField[kind]
    onChange({
      ...rule,
      field: newField,
      op: availableOps[0],
      value: undefined,
    })
  }

  const handleOperatorChange = (op: Operator) => {
    onChange({ ...rule, op })
  }

  const handleValueChange = (value: string | number | string[] | number[]) => {
    onChange({ ...rule, value })
  }

  const availableOperators = operatorsByField[fieldKind] || []
  const needsValue = !["IS_NULL", "NOT_NULL"].includes(rule.op)

  return (
    <div className="flex items-start gap-2 p-2 border rounded-md bg-muted/20">
      <GripVertical className="h-4 w-4 text-muted-foreground mt-1.5" />

      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Select value={fieldKind} onValueChange={handleFieldChange}>
            <SelectTrigger className="w-36 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {fieldTypes.map((ft) => (
                <SelectItem key={ft.value} value={ft.value}>
                  {ft.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={rule.op} onValueChange={handleOperatorChange}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableOperators.map((op) => (
                <SelectItem key={op} value={op}>
                  {operatorLabels[op]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {needsValue && (
          <div className="pl-0">
            {fieldKind === "ifcType" && (rule.op === "IN" || rule.op === "NOT_IN") && facets && (
              <MultiSelect
                options={facets.ifcTypes.map((t) => ({ value: t.key, label: `${t.key} (${t.count})` }))}
                value={(rule.value as string[]) || []}
                onChange={handleValueChange}
                placeholder="Select IFC types..."
              />
            )}

            {fieldKind === "storeyId" && (rule.op === "IN" || rule.op === "NOT_IN") && facets && (
              <MultiSelect
                options={facets.storeys.map((s) => ({ value: s.id, label: `${s.name} (${s.count})` }))}
                value={(rule.value as string[]) || []}
                onChange={handleValueChange}
                placeholder="Select storeys..."
              />
            )}

            {fieldKind === "spaceId" && (rule.op === "IN" || rule.op === "NOT_IN") && facets && (
              <MultiSelect
                options={facets.spaces.map((s) => ({ value: s.id, label: `${s.name} (${s.count})` }))}
                value={(rule.value as string[]) || []}
                onChange={handleValueChange}
                placeholder="Select spaces..."
              />
            )}

            {fieldKind === "material" && (rule.op === "CONTAINS" || rule.op === "NOT_CONTAINS") && (
              <Input
                placeholder="Enter material name..."
                className="h-8 text-xs"
                value={(rule.value as string) || ""}
                onChange={(e) => handleValueChange(e.target.value)}
              />
            )}

            {fieldKind === "quantity" && (
              <Input
                type="number"
                placeholder="Enter value..."
                className="h-8 text-xs"
                value={(rule.value as number) || ""}
                onChange={(e) => handleValueChange(Number.parseFloat(e.target.value))}
              />
            )}

            {fieldKind === "property" && (
              <div className="space-y-2">
                <Input
                  placeholder="Property Set (e.g., Pset_WallCommon)"
                  className="h-8 text-xs"
                  value={rule.field.kind === "property" ? rule.field.pset : ""}
                  onChange={(e) => {
                    if (rule.field.kind === "property") {
                      onChange({
                        ...rule,
                        field: { ...rule.field, pset: e.target.value },
                      })
                    }
                  }}
                />
                <Input
                  placeholder="Property Name (e.g., FireRating)"
                  className="h-8 text-xs"
                  value={rule.field.kind === "property" ? rule.field.prop : ""}
                  onChange={(e) => {
                    if (rule.field.kind === "property") {
                      onChange({
                        ...rule,
                        field: { ...rule.field, prop: e.target.value },
                      })
                    }
                  }}
                />
                <Input
                  placeholder="Value..."
                  className="h-8 text-xs"
                  value={(rule.value as string) || ""}
                  onChange={(e) => handleValueChange(e.target.value)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onRemove}>
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  )
}
