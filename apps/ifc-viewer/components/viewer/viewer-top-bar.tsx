"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  Search,
  Maximize2,
  RotateCcw,
  Box,
  Scissors,
  Palette,
  Save,
  FolderOpen,
  Download,
  UploadIcon,
} from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import type { ViewerColorMode } from "@/lib/types/viewer"
import { useState } from "react"
import { ExportBCFModal } from "./export-bcf-modal"
import { ImportBCFModal } from "./import-bcf-modal"
import { NotificationDropdown } from "./notification-dropdown"

interface ViewerTopBarProps {
  modelName: string
  onFit: () => void
  onReset: () => void
  onSectionBox: () => void
  onClippingPlanes: () => void
  onSavePreset: () => void
  onLoadPreset: () => void
  onUploadIFC?: () => void
}

export function ViewerTopBar({
  modelName,
  onFit,
  onReset,
  onSectionBox,
  onClippingPlanes,
  onSavePreset,
  onLoadPreset,
}: ViewerTopBarProps) {
  const { colorMode, setColorMode } = useViewerStore()
  const [isExportBCFOpen, setIsExportBCFOpen] = useState(false)
  const [isImportBCFOpen, setIsImportBCFOpen] = useState(false)

  return (
    <div className="h-14 border-b bg-background px-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-4 flex-1">
        <div className="font-semibold text-sm">{modelName}</div>
        <Select defaultValue="v3">
          <SelectTrigger className="w-32 h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="v3">Version 3</SelectItem>
            <SelectItem value="v2">Version 2</SelectItem>
            <SelectItem value="v1">Version 1</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-2 flex-1 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search elements..." className="h-8 pl-8 text-xs" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onFit}>
          <Maximize2 className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onReset}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onSectionBox}>
          <Box className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2" onClick={onClippingPlanes}>
          <Scissors className="h-4 w-4" />
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5">
              <Palette className="h-4 w-4" />
              <span className="text-xs">{colorModeLabels[colorMode]}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {Object.entries(colorModeLabels).map(([mode, label]) => (
              <DropdownMenuItem key={mode} onClick={() => setColorMode(mode as ViewerColorMode)}>
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="w-px h-6 bg-border" />

        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5" onClick={() => setIsExportBCFOpen(true)}>
          <Download className="h-4 w-4" />
          <span className="text-xs">Export BCF</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5" onClick={() => setIsImportBCFOpen(true)}>
          <UploadIcon className="h-4 w-4" />
          <span className="text-xs">Import BCF</span>
        </Button>

        <div className="w-px h-6 bg-border" />

        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5" onClick={onSavePreset}>
          <Save className="h-4 w-4" />
          <span className="text-xs">Save</span>
        </Button>
        <Button variant="ghost" size="sm" className="h-8 px-2 gap-1.5" onClick={onLoadPreset}>
          <FolderOpen className="h-4 w-4" />
          <span className="text-xs">Load</span>
        </Button>

        <div className="w-px h-6 bg-border" />

        <NotificationDropdown />
      </div>

      <ExportBCFModal open={isExportBCFOpen} onOpenChange={setIsExportBCFOpen} />
      <ImportBCFModal open={isImportBCFOpen} onOpenChange={setIsImportBCFOpen} />
    </div>
  )
}

const colorModeLabels: Record<ViewerColorMode, string> = {
  default: "Default",
  byType: "By Type",
  byStorey: "By Storey",
  byZone: "By Zone",
  byMaterial: "By Material",
  byClassification: "By Classification",
  byRuleStatus: "By Rule Status",
}
