"use client"

import type React from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PropertyInspectorPanel } from "./property-inspector-panel"
import { IssuesPanel } from "./issues-panel"
import { RuleChecksPanel } from "./rule-checks-panel"

interface RightSidebarProps {
  viewerRef?: React.RefObject<any>
}

export function RightSidebar({ viewerRef }: RightSidebarProps) {
  return (
    <div className="w-80 border-l bg-background flex flex-col">
      <Tabs defaultValue="properties" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-4 rounded-none border-b h-11">
          <TabsTrigger value="properties" className="text-xs">
            Properties
          </TabsTrigger>
          <TabsTrigger value="quantities" className="text-xs">
            Quantities
          </TabsTrigger>
          <TabsTrigger value="issues" className="text-xs">
            Issues
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs">
            Rules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="properties" className="flex-1 m-0">
          <PropertyInspectorPanel />
        </TabsContent>

        <TabsContent value="quantities" className="flex-1 m-0">
          <PropertyInspectorPanel showQuantitiesOnly />
        </TabsContent>

        <TabsContent value="issues" className="flex-1 m-0">
          <IssuesPanel viewerRef={viewerRef} />
        </TabsContent>

        <TabsContent value="rules" className="flex-1 m-0">
          <RuleChecksPanel />
        </TabsContent>
      </Tabs>
    </div>
  )
}
