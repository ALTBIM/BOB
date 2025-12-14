"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { FileDown, FileUp, Info } from "lucide-react"
import { useState } from "react"
import { ExportBCFModal } from "./export-bcf-modal"
import { ImportBCFModal } from "./import-bcf-modal"

export function BCFPanel() {
  const [isExportOpen, setIsExportOpen] = useState(false)
  const [isImportOpen, setIsImportOpen] = useState(false)

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-2">
        <Button size="sm" className="w-full h-8 text-xs" onClick={() => setIsExportOpen(true)}>
          <FileDown className="h-3.5 w-3.5 mr-1.5" />
          Export BCF
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="w-full h-8 text-xs bg-transparent"
          onClick={() => setIsImportOpen(true)}
        >
          <FileUp className="h-3.5 w-3.5 mr-1.5" />
          Import BCF
        </Button>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-4 space-y-3">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-medium mb-1">BIM Collaboration Format</div>
              <div className="text-[10px] leading-relaxed">
                BCF enables issue tracking and collaboration between BIM software tools. Export issues to share with
                other stakeholders, or import issues from other applications.
              </div>
            </div>
          </div>

          <div className="space-y-2 pt-2">
            <div className="text-xs font-semibold">Supported Features:</div>
            <ul className="text-[10px] text-muted-foreground space-y-1 pl-4">
              <li>Issue metadata (title, status, priority, assignee)</li>
              <li>Viewpoints with camera positions</li>
              <li>Snapshot images</li>
              <li>Comments and mentions</li>
              <li>BOB-specific rule context (extension)</li>
            </ul>
          </div>
        </div>
      </ScrollArea>

      <ExportBCFModal open={isExportOpen} onOpenChange={setIsExportOpen} />
      <ImportBCFModal open={isImportOpen} onOpenChange={setIsImportOpen} />
    </div>
  )
}
