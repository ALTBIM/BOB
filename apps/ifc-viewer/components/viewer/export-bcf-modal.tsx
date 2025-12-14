"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useState } from "react"
import type { BCFExportScope, BCFExportOptions } from "@/lib/types/bcf"
import { Loader2, Download, CheckCircle2 } from "lucide-react"

interface ExportBCFModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ExportBCFModal({ open, onOpenChange }: ExportBCFModalProps) {
  const params = useParams()
  const projectId = params.projectId as string
  const modelId = params.modelId as string
  const { issues, filterResults } = useViewerStore()

  const [scope, setScope] = useState<BCFExportScope>("all")
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([])
  const [options, setOptions] = useState<BCFExportOptions>({
    includeViewpoints: true,
    includeSnapshots: true,
    includeComments: true,
    includeRuleContext: false,
  })
  const [isExporting, setIsExporting] = useState(false)
  const [exportResult, setExportResult] = useState<{ downloadUrl: string; filename: string } | null>(null)

  const filteredIssues =
    scope === "filtered" && filterResults
      ? issues.filter((i) => filterResults.ids.includes(i.viewpoint.selectedIds[0]))
      : issues

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const issueIds =
        scope === "selected" ? selectedIssueIds : scope === "filtered" ? filteredIssues.map((i) => i.id) : undefined

      const result = await viewerApi.exportBCF(projectId, {
        modelId,
        version: 3,
        scope,
        issueIds,
        options,
      })

      setExportResult(result)
    } catch (error) {
      console.error("Failed to export BCF:", error)
    } finally {
      setIsExporting(false)
    }
  }

  const handleDownload = () => {
    if (exportResult) {
      window.location.href = exportResult.downloadUrl
      onOpenChange(false)
      setExportResult(null)
      setSelectedIssueIds([])
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Export BCF</DialogTitle>
        </DialogHeader>

        {exportResult ? (
          <div className="space-y-4">
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-3">
                <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
                <div className="text-lg font-semibold">Export Complete</div>
                <div className="text-sm text-muted-foreground">{exportResult.filename} is ready to download</div>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
              <Button onClick={handleDownload}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Export Scope</Label>
              <RadioGroup value={scope} onValueChange={(v) => setScope(v as BCFExportScope)}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal">
                    All issues ({issues.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filtered" id="filtered" />
                  <Label htmlFor="filtered" className="font-normal">
                    Filtered issues ({filteredIssues.length})
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="font-normal">
                    Selected issues
                  </Label>
                </div>
              </RadioGroup>
            </div>

            {scope === "selected" && (
              <div className="space-y-2">
                <Label>Select Issues</Label>
                <ScrollArea className="h-48 border rounded-md p-3">
                  <div className="space-y-2">
                    {issues.map((issue) => (
                      <div key={issue.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={issue.id}
                          checked={selectedIssueIds.includes(issue.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedIssueIds([...selectedIssueIds, issue.id])
                            } else {
                              setSelectedIssueIds(selectedIssueIds.filter((id) => id !== issue.id))
                            }
                          }}
                        />
                        <Label htmlFor={issue.id} className="text-sm font-normal cursor-pointer">
                          {issue.title}
                        </Label>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}

            <div className="space-y-3">
              <Label>Include Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="viewpoints"
                    checked={options.includeViewpoints}
                    onCheckedChange={(checked) => setOptions({ ...options, includeViewpoints: checked as boolean })}
                  />
                  <Label htmlFor="viewpoints" className="text-sm font-normal">
                    Include viewpoints
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="snapshots"
                    checked={options.includeSnapshots}
                    onCheckedChange={(checked) => setOptions({ ...options, includeSnapshots: checked as boolean })}
                  />
                  <Label htmlFor="snapshots" className="text-sm font-normal">
                    Include snapshots
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="comments"
                    checked={options.includeComments}
                    onCheckedChange={(checked) => setOptions({ ...options, includeComments: checked as boolean })}
                  />
                  <Label htmlFor="comments" className="text-sm font-normal">
                    Include comments
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="ruleContext"
                    checked={options.includeRuleContext}
                    onCheckedChange={(checked) => setOptions({ ...options, includeRuleContext: checked as boolean })}
                  />
                  <Label htmlFor="ruleContext" className="text-sm font-normal">
                    Include rule context snapshot (BOB extension)
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleExport}
                disabled={isExporting || (scope === "selected" && selectedIssueIds.length === 0)}
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4 mr-2" />
                    Export
                  </>
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
