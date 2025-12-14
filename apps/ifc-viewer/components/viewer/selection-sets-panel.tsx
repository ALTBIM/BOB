"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"

export function SelectionSetsPanel() {
  const { selectionSets, selectedIds } = useViewerStore()

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <Button size="sm" className="w-full h-8 text-xs" disabled={selectedIds.length === 0}>
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Save Selection Set
        </Button>
      </div>

      <ScrollArea className="flex-1">
        {selectionSets.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              No selection sets yet. Select elements and save them for quick access.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {selectionSets.map((set) => (
              <div
                key={set.id}
                className="flex items-center justify-between p-2 rounded-md hover:bg-accent/50 transition-colors cursor-pointer group"
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium truncate">{set.name}</div>
                  <div className="text-[10px] text-muted-foreground">{set.elementIds.length} elements</div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
