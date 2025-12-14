"use client"
import type React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SpatialTreePanel } from "./spatial-tree-panel"
import { FiltersPanel } from "./filters-panel"
import { SelectionSetsPanel } from "./selection-sets-panel"
import { SavedViewsPanel } from "./saved-views-panel"
import { BCFPanel } from "./bcf-panel"

interface LeftSidebarProps {
  viewerRef?: React.RefObject<any>
}

export function LeftSidebar({ viewerRef }: LeftSidebarProps) {
  return (
    <div className="w-80 border-r bg-background flex flex-col">
      <Tabs defaultValue="tree" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5 rounded-none border-b h-11">
          <TabsTrigger value="tree" className="text-xs">
            Tree
          </TabsTrigger>
          <TabsTrigger value="filters" className="text-xs">
            Filters
          </TabsTrigger>
          <TabsTrigger value="sets" className="text-xs">
            Sets
          </TabsTrigger>
          <TabsTrigger value="views" className="text-xs">
            Views
          </TabsTrigger>
          <TabsTrigger value="bcf" className="text-xs">
            BCF
          </TabsTrigger>
        </TabsList>

        <TabsContent value="tree" className="flex-1 m-0">
          <SpatialTreePanel />
        </TabsContent>

        <TabsContent value="filters" className="flex-1 m-0">
          <FiltersPanel />
        </TabsContent>

        <TabsContent value="sets" className="flex-1 m-0">
          <SelectionSetsPanel />
        </TabsContent>

        <TabsContent value="views" className="flex-1 m-0">
          <SavedViewsPanel viewerRef={viewerRef} />
        </TabsContent>

        <TabsContent value="bcf" className="flex-1 m-0">
          <BCFPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
