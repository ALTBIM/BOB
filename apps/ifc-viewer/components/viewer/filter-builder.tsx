"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { FilterGroupComponent } from "./filter-group-component"
import type { FilterGroup } from "@/lib/types/viewer"
import { nanoid } from "nanoid"

interface FilterBuilderProps {
  onChange: (filter: FilterGroup | null) => void
}

export function FilterBuilder({ onChange }: FilterBuilderProps) {
  const [rootGroup, setRootGroup] = useState<FilterGroup | null>(null)

  useEffect(() => {
    onChange(rootGroup)
  }, [rootGroup, onChange])

  const handleCreateRootGroup = () => {
    const newGroup: FilterGroup = {
      id: nanoid(),
      type: "group",
      op: "AND",
      children: [],
    }
    setRootGroup(newGroup)
  }

  const handleClearAll = () => {
    setRootGroup(null)
  }

  if (!rootGroup) {
    return (
      <div className="space-y-3">
        <div className="text-center py-8">
          <p className="text-xs text-muted-foreground mb-3">No filters defined</p>
          <Button size="sm" onClick={handleCreateRootGroup} className="h-8 text-xs">
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Create Filter
          </Button>
        </div>

        <div className="space-y-2">
          <div className="text-xs font-semibold">Quick Filters</div>
          <div className="space-y-1">
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start bg-transparent"
              onClick={() => {
                // Quick filter: Missing material
                const group: FilterGroup = {
                  id: nanoid(),
                  type: "group",
                  op: "AND",
                  children: [
                    {
                      id: nanoid(),
                      type: "rule",
                      field: { kind: "material" },
                      op: "IS_NULL",
                    },
                  ],
                }
                setRootGroup(group)
              }}
            >
              Elements Missing Material
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start bg-transparent"
              onClick={() => {
                const group: FilterGroup = {
                  id: nanoid(),
                  type: "group",
                  op: "AND",
                  children: [
                    {
                      id: nanoid(),
                      type: "rule",
                      field: { kind: "classification" },
                      op: "IS_NULL",
                    },
                  ],
                }
                setRootGroup(group)
              }}
            >
              Elements Missing Classification
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-full h-8 text-xs justify-start bg-transparent"
              onClick={() => {
                const group: FilterGroup = {
                  id: nanoid(),
                  type: "group",
                  op: "AND",
                  children: [
                    {
                      id: nanoid(),
                      type: "rule",
                      field: { kind: "spaceId" },
                      op: "IS_NULL",
                    },
                  ],
                }
                setRootGroup(group)
              }}
            >
              Elements Not in Space
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium text-muted-foreground">Root Filter</div>
        <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleClearAll}>
          <Trash2 className="h-3 w-3 mr-1" />
          Clear All
        </Button>
      </div>

      <FilterGroupComponent group={rootGroup} onChange={setRootGroup} depth={0} />
    </div>
  )
}

export default FilterBuilder
