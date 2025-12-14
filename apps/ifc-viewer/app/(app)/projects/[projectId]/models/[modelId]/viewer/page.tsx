"use client"

import { useRef, useEffect } from "react"
import { ViewerCanvas, type ViewerCanvasRef } from "@/components/viewer/viewer-canvas"
import { ViewerTopBar } from "@/components/viewer/viewer-top-bar"
import { LeftSidebar } from "@/components/viewer/left-sidebar"
import { RightSidebar } from "@/components/viewer/right-sidebar"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"

export default function ViewerPage() {
  const params = useParams()
  const projectId = params.projectId as string
  const modelId = params.modelId as string
  const viewerRef = useRef<ViewerCanvasRef>(null)

  const {
    filterResults,
    visibilityMode,
    nonResultsOpacity,
    colorMode,
    setFacets,
    setFilterPresets,
    setSelectionSets,
    setLoading,
    setError,
  } = useViewerStore()

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      console.log("[v0] Loading viewer for project:", projectId, "model:", modelId)
      setLoading(true)
      try {
        const [facets, presets, sets] = await Promise.all([
          viewerApi.getFacets(modelId, 3),
          viewerApi.getFilterPresets(projectId, modelId, 3),
          viewerApi.getSelectionSets(projectId, modelId, 3),
        ])
        setFacets(facets)
        setFilterPresets(presets)
        setSelectionSets(sets)
        console.log("[v0] Initial data loaded successfully")
      } catch (err) {
        console.error("[v0] Error loading initial data:", err)
        setError(err instanceof Error ? err.message : "Failed to load data")
      } finally {
        setLoading(false)
      }
    }

    loadInitialData()
  }, [modelId, projectId, setFacets, setFilterPresets, setSelectionSets, setLoading, setError])

  // Update viewer when filter results change
  useEffect(() => {
    if (!viewerRef.current || !filterResults) return

    if (visibilityMode === "filtered") {
      viewerRef.current.highlight(filterResults.elementIds)
    } else if (visibilityMode === "isolated") {
      viewerRef.current.isolate(filterResults.elementIds)
    }
  }, [filterResults, visibilityMode])

  // Update viewer opacity
  useEffect(() => {
    if (!viewerRef.current) return
    viewerRef.current.setNonResultsOpacity(nonResultsOpacity)
  }, [nonResultsOpacity])

  // Update viewer color mode
  useEffect(() => {
    if (!viewerRef.current) return
    viewerRef.current.setColorMode(colorMode)
  }, [colorMode])

  const handleFit = () => viewerRef.current?.fitTo()
  const handleReset = () => viewerRef.current?.showAll()
  const handleSectionBox = () => viewerRef.current?.setSectionBox(true)
  const handleClippingPlanes = () => viewerRef.current?.setClippingPlanes(true)
  const handleSavePreset = () => {
    console.log("[v0] Save preset")
    // Implement save preset dialog
  }
  const handleLoadPreset = () => {
    console.log("[v0] Load preset")
    // Implement load preset dialog
  }

  return (
    <div className="h-screen flex flex-col bg-slate-950">
      <ViewerTopBar
        modelName="Office Building Model"
        onFit={handleFit}
        onReset={handleReset}
        onSectionBox={handleSectionBox}
        onClippingPlanes={handleClippingPlanes}
        onSavePreset={handleSavePreset}
        onLoadPreset={handleLoadPreset}
      />

      <div className="flex-1 flex overflow-hidden">
        <LeftSidebar viewerRef={viewerRef} />

        <div className="flex-1 relative">
          <ViewerCanvas ref={viewerRef} />
        </div>

        <RightSidebar viewerRef={viewerRef} />
      </div>
    </div>
  )
}
