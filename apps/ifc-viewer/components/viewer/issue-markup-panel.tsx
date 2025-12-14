"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MousePointer2, Square, Pen, Undo2, Redo2, Trash2, Save } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useEffect, useState, useRef } from "react"
import { nanoid } from "nanoid"
import type { MarkupItem, MarkupPin, MarkupRect, MarkupFreehand } from "@/lib/types/markup"

interface IssueMarkupPanelProps {
  issueId: string
  snapshotUrl: string
}

export function IssueMarkupPanel({ issueId, snapshotUrl }: IssueMarkupPanelProps) {
  const params = useParams()
  const projectId = params.projectId as string
  const { issueMarkup, setIssueMarkup, markupTool, setMarkupTool } = useViewerStore()

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const [items, setItems] = useState<MarkupItem[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [startPoint, setStartPoint] = useState<{ x: number; y: number } | null>(null)
  const [currentPoints, setCurrentPoints] = useState<Array<{ x: number; y: number }>>([])
  const [history, setHistory] = useState<MarkupItem[][]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [isSaving, setIsSaving] = useState(false)

  const markup = issueMarkup[issueId]

  useEffect(() => {
    const loadMarkup = async () => {
      try {
        const data = await viewerApi.getIssueMarkup(projectId, issueId)
        setIssueMarkup(issueId, data)
        setItems(data.items)
        setHistory([data.items])
        setHistoryIndex(0)
      } catch (error) {
        console.error("Failed to load markup:", error)
        setItems([])
        setHistory([[]])
        setHistoryIndex(0)
      }
    }

    loadMarkup()
  }, [projectId, issueId, setIssueMarkup])

  useEffect(() => {
    const canvas = canvasRef.current
    const image = imageRef.current
    if (!canvas || !image) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = snapshotUrl
    img.onload = () => {
      canvas.width = image.clientWidth
      canvas.height = image.clientHeight
      drawCanvas()
    }
  }, [snapshotUrl, items, selectedItemId, currentPoints, isDrawing])

  const drawCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext("2d")
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    items.forEach((item) => {
      const isSelected = item.id === selectedItemId

      ctx.strokeStyle = isSelected ? "#3b82f6" : "#ef4444"
      ctx.fillStyle = isSelected ? "rgba(59, 130, 246, 0.2)" : "rgba(239, 68, 68, 0.2)"
      ctx.lineWidth = 2

      if (item.type === "PIN") {
        const x = item.x * canvas.width
        const y = item.y * canvas.height
        ctx.beginPath()
        ctx.arc(x, y, 8, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        if (item.label) {
          ctx.fillStyle = "#000"
          ctx.font = "12px sans-serif"
          ctx.fillText(item.label, x + 12, y + 4)
        }
      } else if (item.type === "RECT") {
        const x = item.x * canvas.width
        const y = item.y * canvas.height
        const w = item.w * canvas.width
        const h = item.h * canvas.height
        ctx.fillRect(x, y, w, h)
        ctx.strokeRect(x, y, w, h)
      } else if (item.type === "FREEHAND") {
        if (item.points.length > 1) {
          ctx.beginPath()
          ctx.moveTo(item.points[0].x * canvas.width, item.points[0].y * canvas.height)
          for (let i = 1; i < item.points.length; i++) {
            ctx.lineTo(item.points[i].x * canvas.width, item.points[i].y * canvas.height)
          }
          ctx.stroke()
        }
      }
    })

    if (isDrawing && markupTool === "RECT" && startPoint && currentPoints.length > 0) {
      const endPoint = currentPoints[currentPoints.length - 1]
      ctx.strokeStyle = "#3b82f6"
      ctx.fillStyle = "rgba(59, 130, 246, 0.2)"
      ctx.lineWidth = 2
      const x = Math.min(startPoint.x, endPoint.x) * canvas.width
      const y = Math.min(startPoint.y, endPoint.y) * canvas.height
      const w = Math.abs(endPoint.x - startPoint.x) * canvas.width
      const h = Math.abs(endPoint.y - startPoint.y) * canvas.height
      ctx.fillRect(x, y, w, h)
      ctx.strokeRect(x, y, w, h)
    }

    if (isDrawing && markupTool === "FREEHAND" && currentPoints.length > 1) {
      ctx.strokeStyle = "#3b82f6"
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(currentPoints[0].x * canvas.width, currentPoints[0].y * canvas.height)
      for (let i = 1; i < currentPoints.length; i++) {
        ctx.lineTo(currentPoints[i].x * canvas.width, currentPoints[i].y * canvas.height)
      }
      ctx.stroke()
    }
  }

  const getNormalizedPosition = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }

    const rect = canvas.getBoundingClientRect()
    return {
      x: (e.clientX - rect.left) / rect.width,
      y: (e.clientY - rect.top) / rect.height,
    }
  }

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (markupTool === "SELECT") return

    const pos = getNormalizedPosition(e)
    setIsDrawing(true)
    setStartPoint(pos)

    if (markupTool === "PIN") {
      const newItem: MarkupPin = {
        id: nanoid(),
        type: "PIN",
        x: pos.x,
        y: pos.y,
      }
      addToHistory([...items, newItem])
      setIsDrawing(false)
    } else if (markupTool === "FREEHAND") {
      setCurrentPoints([pos])
    }
  }

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const pos = getNormalizedPosition(e)

    if (markupTool === "RECT") {
      setCurrentPoints([pos])
      drawCanvas()
    } else if (markupTool === "FREEHAND") {
      setCurrentPoints([...currentPoints, pos])
      drawCanvas()
    }
  }

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return

    const pos = getNormalizedPosition(e)

    if (markupTool === "RECT" && startPoint) {
      const newItem: MarkupRect = {
        id: nanoid(),
        type: "RECT",
        x: Math.min(startPoint.x, pos.x),
        y: Math.min(startPoint.y, pos.y),
        w: Math.abs(pos.x - startPoint.x),
        h: Math.abs(pos.y - startPoint.y),
      }
      addToHistory([...items, newItem])
    } else if (markupTool === "FREEHAND" && currentPoints.length > 1) {
      const newItem: MarkupFreehand = {
        id: nanoid(),
        type: "FREEHAND",
        points: currentPoints,
      }
      addToHistory([...items, newItem])
    }

    setIsDrawing(false)
    setStartPoint(null)
    setCurrentPoints([])
  }

  const addToHistory = (newItems: MarkupItem[]) => {
    const newHistory = history.slice(0, historyIndex + 1)
    newHistory.push(newItems)
    setHistory(newHistory)
    setHistoryIndex(newHistory.length - 1)
    setItems(newItems)
  }

  const handleUndo = () => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1)
      setItems(history[historyIndex - 1])
    }
  }

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1)
      setItems(history[historyIndex + 1])
    }
  }

  const handleDelete = () => {
    if (selectedItemId) {
      addToHistory(items.filter((item) => item.id !== selectedItemId))
      setSelectedItemId(null)
    }
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const markup = await viewerApi.saveIssueMarkup(projectId, issueId, {
        issueId,
        snapshotUrl,
        items,
        updatedAt: new Date().toISOString(),
      })
      setIssueMarkup(issueId, markup)
    } catch (error) {
      console.error("Failed to save markup:", error)
    } finally {
      setIsSaving(false)
    }
  }

  const selectedItem = selectedItemId ? items.find((item) => item.id === selectedItemId) : null

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-3">
        <div className="flex items-center gap-1">
          <Button
            variant={markupTool === "SELECT" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setMarkupTool("SELECT")}
          >
            <MousePointer2 className="h-4 w-4" />
          </Button>
          <Button
            variant={markupTool === "PIN" ? "default" : "ghost"}
            size="sm"
            className="h-8 px-2 gap-1"
            onClick={() => setMarkupTool("PIN")}
          >
            <span className="text-xs">Pin</span>
          </Button>
          <Button
            variant={markupTool === "RECT" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setMarkupTool("RECT")}
          >
            <Square className="h-4 w-4" />
          </Button>
          <Button
            variant={markupTool === "FREEHAND" ? "default" : "ghost"}
            size="sm"
            className="h-8 w-8 p-0"
            onClick={() => setMarkupTool("FREEHAND")}
          >
            <Pen className="h-4 w-4" />
          </Button>
          <div className="w-px h-6 bg-border mx-1" />
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleUndo} disabled={historyIndex <= 0}>
            <Undo2 className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0"
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
          >
            <Redo2 className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleDelete} disabled={!selectedItemId}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>

        {selectedItem && (
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              className="h-8 text-xs"
              placeholder="Add label..."
              value={selectedItem.label || ""}
              onChange={(e) => {
                const newItems = items.map((item) =>
                  item.id === selectedItemId ? { ...item, label: e.target.value } : item,
                )
                setItems(newItems)
              }}
            />
          </div>
        )}

        <Button size="sm" className="w-full h-8 text-xs" onClick={handleSave} disabled={isSaving}>
          <Save className="h-3.5 w-3.5 mr-1.5" />
          {isSaving ? "Saving..." : "Save Markup"}
        </Button>
      </div>

      <div className="flex-1 p-3 overflow-auto">
        <div className="relative w-full">
          <img ref={imageRef} src={snapshotUrl || "/placeholder.svg"} alt="Snapshot" className="w-full h-auto" />
          <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full cursor-crosshair"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={() => {
              if (isDrawing) handleMouseUp({} as any)
            }}
          />
        </div>
      </div>
    </div>
  )
}
