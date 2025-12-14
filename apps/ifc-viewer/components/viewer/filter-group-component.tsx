"use client"

import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, Trash2, GripVertical } from "lucide-react"
import { FilterRuleComponent } from "./filter-rule-component"
import type { FilterGroup, FilterRule, LogicalOp } from "@/lib/types/viewer"
import { nanoid } from "nanoid"
import { cn } from "@/lib/utils"

interface FilterGroupComponentProps {
  group: FilterGroup
  onChange: (group: FilterGroup) => void
  onRemove?: () => void
  depth: number
}

export function FilterGroupComponent({ group, onChange, onRemove, depth }: FilterGroupComponentProps) {
  const handleOpChange = (op: LogicalOp) => {
    onChange({ ...group, op })
  }

  const handleAddRule = () => {
    const newRule: FilterRule = {
      id: nanoid(),
      type: "rule",
      field: { kind: "ifcType" },
      op: "IN",
      value: [],
    }
    onChange({
      ...group,
      children: [...group.children, newRule],
    })
  }

  const handleAddGroup = () => {
    const newGroup: FilterGroup = {
      id: nanoid(),
      type: "group",
      op: "AND",
      children: [],
    }
    onChange({
      ...group,
      children: [...group.children, newGroup],
    })
  }

  const handleChildChange = (index: number, child: FilterGroup | FilterRule) => {
    const newChildren = [...group.children]
    newChildren[index] = child
    onChange({ ...group, children: newChildren })
  }

  const handleChildRemove = (index: number) => {
    const newChildren = group.children.filter((_, i) => i !== index)
    onChange({ ...group, children: newChildren })
  }

  return (
    <div className={cn("border rounded-lg p-3 space-y-2 bg-card", depth > 0 && "ml-4 border-l-2 border-l-primary/30")}>
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
        <Select value={group.op} onValueChange={handleOpChange}>
          <SelectTrigger className="w-24 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="AND">AND</SelectItem>
            <SelectItem value="OR">OR</SelectItem>
          </SelectContent>
        </Select>
        <div className="text-xs text-muted-foreground">Match {group.op === "AND" ? "all" : "any"} conditions</div>
        {onRemove && (
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0 ml-auto" onClick={onRemove}>
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      {group.children.length > 0 && (
        <div className="space-y-2 pl-2">
          {group.children.map((child, index) =>
            child.type === "group" ? (
              <FilterGroupComponent
                key={child.id}
                group={child}
                onChange={(updated) => handleChildChange(index, updated)}
                onRemove={() => handleChildRemove(index)}
                depth={depth + 1}
              />
            ) : (
              <FilterRuleComponent
                key={child.id}
                rule={child}
                onChange={(updated) => handleChildChange(index, updated)}
                onRemove={() => handleChildRemove(index)}
              />
            ),
          )}
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button variant="outline" size="sm" className="h-7 text-xs flex-1 bg-transparent" onClick={handleAddRule}>
          <Plus className="h-3 w-3 mr-1" />
          Add Rule
        </Button>
        <Button variant="outline" size="sm" className="h-7 text-xs flex-1 bg-transparent" onClick={handleAddGroup}>
          <Plus className="h-3 w-3 mr-1" />
          Add Group
        </Button>
      </div>
    </div>
  )
}
