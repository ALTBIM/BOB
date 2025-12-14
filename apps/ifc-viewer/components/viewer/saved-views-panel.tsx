"use client"

import type React from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, Eye } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useEffect } from "react"
import { nanoid } from "nanoid"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import type { Viewpoint } from "@/lib/types/viewpoint"

interface SavedViewsPanelProps {
  viewerRef?: React.RefObject<any>
}

export function SavedViewsPanel({ viewerRef }: SavedViewsPanelProps = {}) {
  const params = useParams()
  const projectId = params.projectId as string
  const modelId = params.modelId as string
  const { savedViews, setSavedViews, addSavedView, removeSavedView, currentFilter, selectedIds } = useViewerStore()
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [viewName, setViewName] = useState("")

  useEffect(() => {
    const loadSavedViews = async () => {
      try {
        const views = await viewerApi.getSavedViews(projectId, modelId, 3)
        setSavedViews(views)
      } catch (err) {
        console.error("Failed to load saved views:", err)
      }
    }

    loadSavedViews()
  }, [projectId, modelId, setSavedViews])

  const handleSaveView = async () => {
    if (!viewName.trim()) return

    try {
      const camera = viewerRef?.current?.getCamera() || {
        position: [10, 10, 10],
        target: [0, 0, 0],
        up: [0, 0, 1],
        fov: 45,
      }

      const clipping = viewerRef?.current?.getClippingState() || {
        planes: { enabled: false },
        sectionBox: { enabled: false, min: [0, 0, 0], max: [10, 10, 10] },
      }

      const snapshotUrl = viewerRef?.current ? await viewerRef.current.captureSnapshot() : "/3d-building-model.jpg"

      const viewpoint: Viewpoint = {
        id: nanoid(),
        projectId,
        modelId,
        version: 3,
        camera,
        selectedIds,
        highlightedIds: [],
        hiddenIds: [],
        colorMode: "default",
        nonResultsOpacity: 0.2,
        clipping,
        filter: currentFilter ? { expression: currentFilter } : undefined,
        snapshotUrl,
        createdBy: "current-user",
        createdAt: new Date().toISOString(),
      }

      const savedView = await viewerApi.saveSavedView(projectId, {
        name: viewName,
        projectId,
        modelId,
        version: 3,
        viewpoint,
        createdBy: "current-user",
      })

      addSavedView(savedView)
      setViewName("")
      setIsDialogOpen(false)
    } catch (err) {
      console.error("Failed to save view:", err)
    }
  }

  const handleApplyView = (viewpoint: Viewpoint) => {
    if (viewerRef?.current) {
      viewerRef.current.applyViewpoint(viewpoint)
    }
  }

  const handleDeleteView = async (viewId: string) => {
    try {
      await viewerApi.deleteSavedView(projectId, viewId)
      removeSavedView(viewId)
    } catch (err) {
      console.error("Failed to delete view:", err)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full h-8 text-xs">
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Save Current View
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Save View</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>View Name</Label>
                <Input
                  placeholder="Enter view name..."
                  value={viewName}
                  onChange={(e) => setViewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveView()
                  }}
                />
              </div>
              <Button onClick={handleSaveView} className="w-full">
                Save View
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <ScrollArea className="flex-1">
        {savedViews.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">
              No saved views yet. Save your current camera position and filters for quick access.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {savedViews.map((view) => (
              <div
                key={view.id}
                className="border rounded-md overflow-hidden hover:border-primary/50 transition-colors group"
              >
                {view.viewpoint.snapshotUrl && (
                  <div className="w-full h-32 bg-muted relative">
                    <img
                      src={view.viewpoint.snapshotUrl || "/placeholder.svg"}
                      alt={view.name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-7 text-xs"
                        onClick={() => handleApplyView(view.viewpoint)}
                      >
                        <Eye className="h-3 w-3 mr-1.5" />
                        Apply View
                      </Button>
                    </div>
                  </div>
                )}
                <div className="p-2 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate">{view.name}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {new Date(view.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleDeleteView(view.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
