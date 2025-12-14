"use client"

import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useState, useCallback } from "react"
import type { BCFImportOptions, BCFImportResult } from "@/lib/types/bcf"
import { Loader2, Upload, CheckCircle2, AlertTriangle, FileArchive } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"

interface ImportBCFModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImportBCFModal({ open, onOpenChange }: ImportBCFModalProps) {
  const params = useParams()
  const projectId = params.projectId as string
  const { setIssues } = useViewerStore()

  const [file, setFile] = useState<File | null>(null)
  const [options, setOptions] = useState<BCFImportOptions>({
    createNewIssues: true,
    updateExistingByGuid: true,
    mergeComments: true,
    overwriteViewpoints: false,
  })
  const [isImporting, setIsImporting] = useState(false)
  const [importResult, setImportResult] = useState<BCFImportResult | null>(null)
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0]
      if (droppedFile.name.endsWith(".bcfzip") || droppedFile.name.endsWith(".zip")) {
        setFile(droppedFile)
      }
    }
  }, [])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!file) return

    setIsImporting(true)
    try {
      const result = await viewerApi.importBCF(projectId, file, options)
      setImportResult(result)

      const updatedIssues = await viewerApi.getIssues(projectId)
      setIssues(updatedIssues)
    } catch (error) {
      console.error("Failed to import BCF:", error)
    } finally {
      setIsImporting(false)
    }
  }

  const handleClose = () => {
    onOpenChange(false)
    setFile(null)
    setImportResult(null)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import BCF</DialogTitle>
        </DialogHeader>

        {importResult ? (
          <div className="space-y-4">
            <div className="text-center space-y-3 py-4">
              <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto" />
              <div className="text-lg font-semibold">Import Complete</div>
              <div className="grid grid-cols-3 gap-4 mt-4">
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-green-600">{importResult.created}</div>
                  <div className="text-xs text-muted-foreground">Created</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-blue-600">{importResult.updated}</div>
                  <div className="text-xs text-muted-foreground">Updated</div>
                </div>
                <div className="space-y-1">
                  <div className="text-2xl font-bold text-gray-600">{importResult.skipped}</div>
                  <div className="text-xs text-muted-foreground">Skipped</div>
                </div>
              </div>
            </div>

            {importResult.warnings.length > 0 && (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  <div className="font-semibold mb-2">Warnings:</div>
                  <ul className="space-y-1 text-sm">
                    {importResult.warnings.map((warning, i) => (
                      <li key={i}>
                        <strong>{warning.issueTitle}:</strong> {warning.message}
                      </li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? "border-primary bg-accent" : "border-muted-foreground/25"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {file ? (
                <div className="space-y-2">
                  <FileArchive className="h-12 w-12 mx-auto text-primary" />
                  <div className="font-medium">{file.name}</div>
                  <div className="text-sm text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</div>
                  <Button variant="outline" size="sm" onClick={() => setFile(null)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <Upload className="h-12 w-12 mx-auto text-muted-foreground" />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Drop BCF file here or click to browse</div>
                    <div className="text-xs text-muted-foreground">Supports .bcfzip and .zip files</div>
                  </div>
                  <input
                    type="file"
                    accept=".bcfzip,.zip"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="bcf-file-input"
                  />
                  <Button variant="outline" size="sm" asChild>
                    <label htmlFor="bcf-file-input" className="cursor-pointer">
                      Browse Files
                    </label>
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label>Import Options</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createNew"
                    checked={options.createNewIssues}
                    onCheckedChange={(checked) => setOptions({ ...options, createNewIssues: checked as boolean })}
                  />
                  <Label htmlFor="createNew" className="text-sm font-normal">
                    Create new issues if missing
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="updateExisting"
                    checked={options.updateExistingByGuid}
                    onCheckedChange={(checked) => setOptions({ ...options, updateExistingByGuid: checked as boolean })}
                  />
                  <Label htmlFor="updateExisting" className="text-sm font-normal">
                    Update existing issues by GUID
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="mergeComments"
                    checked={options.mergeComments}
                    onCheckedChange={(checked) => setOptions({ ...options, mergeComments: checked as boolean })}
                  />
                  <Label htmlFor="mergeComments" className="text-sm font-normal">
                    Merge comments
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="overwriteViewpoints"
                    checked={options.overwriteViewpoints}
                    onCheckedChange={(checked) => setOptions({ ...options, overwriteViewpoints: checked as boolean })}
                  />
                  <Label htmlFor="overwriteViewpoints" className="text-sm font-normal">
                    Overwrite viewpoints
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button onClick={handleImport} disabled={!file || isImporting}>
                {isImporting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    Import
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
