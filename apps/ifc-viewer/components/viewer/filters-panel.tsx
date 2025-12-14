"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Separator } from "@/components/ui/separator"
import { Play, Eye, EyeOff, Maximize2, RotateCcw } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { useState, useEffect } from "react"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import type { FilterGroup } from "@/lib/types/viewer"
import { FilterBuilder } from "./filter-builder" // Declare the FilterBuilder variable

export function FiltersPanel() {
  const params = useParams()
  const modelId = params.modelId as string
  const [liveMode, setLiveMode] = useState(false)
  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null)

  const {
    currentFilter,
    filterResults,
    nonResultsOpacity,
    facets,
    setCurrentFilter,
    setFilterResults,
    setNonResultsOpacity,
    setVisibilityMode,
    setLoading,
    setFacets,
  } = useViewerStore()

  useEffect(() => {
    const loadFacets = async () => {
      try {
        const facetsData = await viewerApi.getFacets(modelId, 3)
        setFacets(facetsData)
      } catch (err) {
        console.error("Failed to load facets:", err)
        setFacets([])
      }
    }

    if (facets === null) {
      loadFacets()
    }
  }, [modelId, facets, setFacets])

  const handleFilterChange = (filter: FilterGroup | null) => {
    setCurrentFilter(filter)

    if (liveMode && filter) {
      // Debounce live filter execution
      if (debounceTimer) clearTimeout(debounceTimer)
      const timer = setTimeout(() => executeFilter(filter), 800)
      setDebounceTimer(timer)
    }
  }

  const executeFilter = async (filter: FilterGroup) => {
    if (!filter) return

    setLoading(true)
    try {
      const result = await viewerApi.executeFilter(modelId, 3, filter)
      setFilterResults(result)
      setVisibilityMode("filtered")
    } catch (err) {
      console.error("Failed to execute filter:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleApplyFilter = () => {
    if (currentFilter) {
      executeFilter(currentFilter)
    }
  }

  const handleIsolateResults = () => {
    if (filterResults) {
      setVisibilityMode("isolated")
    }
  }

  const handleHideResults = () => {
    // Hide filter results - would update hiddenIds in store
    console.log("[v0] Hide results")
  }

  const handleShowOnlyResults = () => {
    if (filterResults) {
      setVisibilityMode("isolated")
    }
  }

  const handleResetVisibility = () => {
    setVisibilityMode("showAll")
  }

  useEffect(() => {
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer)
    }
  }, [debounceTimer])

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold">Filter Builder</div>
          {filterResults && (
            <div className="text-xs text-muted-foreground">{filterResults.resultCount.toLocaleString()} elements</div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button size="sm" className="flex-1 h-8 text-xs" onClick={handleApplyFilter} disabled={!currentFilter}>
            <Play className="h-3.5 w-3.5 mr-1.5" />
            Apply Filter
          </Button>
          <div className="flex items-center gap-1.5">
            <Switch id="live-mode" checked={liveMode} onCheckedChange={setLiveMode} className="scale-75" />
            <Label htmlFor="live-mode" className="text-xs text-muted-foreground cursor-pointer">
              Live
            </Label>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {facets === null ? (
          <div className="p-3 flex items-center justify-center">
            <div className="text-xs text-muted-foreground">Loading filters...</div>
          </div>
        ) : (
          <div className="p-3">
            <FilterBuilder onChange={handleFilterChange} />
          </div>
        )}
      </ScrollArea>

      {filterResults && (
        <>
          <Separator />
          <div className="p-3 space-y-3 border-t bg-muted/20">
            <div className="text-xs font-semibold">Quick Actions</div>

            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent" onClick={handleIsolateResults}>
                <Maximize2 className="h-3 w-3 mr-1.5" />
                Isolate
              </Button>
              <Button variant="outline" size="sm" className="h-8 text-xs bg-transparent" onClick={handleHideResults}>
                <EyeOff className="h-3 w-3 mr-1.5" />
                Hide
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-transparent"
                onClick={handleShowOnlyResults}
              >
                <Eye className="h-3 w-3 mr-1.5" />
                Show Only
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs bg-transparent"
                onClick={handleResetVisibility}
              >
                <RotateCcw className="h-3 w-3 mr-1.5" />
                Reset
              </Button>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Non-results Opacity ({Math.round(nonResultsOpacity * 100)}%)</Label>
              <Slider
                value={[nonResultsOpacity * 100]}
                onValueChange={([value]) => setNonResultsOpacity(value / 100)}
                min={0}
                max={100}
                step={5}
                className="w-full"
              />
            </div>
          </div>
        </>
      )}
    </div>
  )
}
