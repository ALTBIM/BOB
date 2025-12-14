"use client"

import type React from "react"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useState } from "react"
import { nanoid } from "nanoid"
import type { IssuePriority } from "@/lib/types/issue"
import type { Viewpoint } from "@/lib/types/viewpoint"
import type { FilterGroup } from "@/lib/types/viewer"
import { AssigneePicker } from "./assignee-picker"
import type { IssueAssignee } from "@/lib/types/participant"

interface CreateIssueModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  viewerRef?: React.RefObject<any>
  selectedIds: string[]
  currentFilter: FilterGroup | null
}

export function CreateIssueModal({ open, onOpenChange, viewerRef, selectedIds, currentFilter }: CreateIssueModalProps) {
  const params = useParams()
  const projectId = params.projectId as string
  const modelId = params.modelId as string
  const { addIssue } = useViewerStore()

  const [newIssue, setNewIssue] = useState({
    title: "",
    description: "",
    priority: "MEDIUM" as IssuePriority,
    assignee: null as IssueAssignee | null,
    dueDate: "",
  })

  const handleCreateIssue = async () => {
    if (!newIssue.title.trim()) return

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

      const snapshotUrl = viewerRef?.current ? await viewerRef.current.captureSnapshot() : "/3d-building-issue.jpg"

      const viewpoint: Viewpoint = {
        id: nanoid(),
        projectId,
        modelId,
        version: 3,
        camera,
        selectedIds,
        highlightedIds: selectedIds,
        hiddenIds: [],
        colorMode: "default",
        nonResultsOpacity: 0.2,
        clipping,
        filter: currentFilter ? { expression: currentFilter } : undefined,
        snapshotUrl,
        createdBy: "current-user",
        createdAt: new Date().toISOString(),
      }

      const issue = await viewerApi.createIssue(projectId, {
        projectId,
        modelId,
        version: 3,
        title: newIssue.title,
        description: newIssue.description,
        status: "OPEN",
        priority: newIssue.priority,
        assignee: newIssue.assignee
          ? {
              userId: newIssue.assignee.userId || newIssue.assignee.roleId || "",
              name: newIssue.assignee.displayName,
            }
          : undefined,
        dueDate: newIssue.dueDate || undefined,
        createdBy: { userId: "current-user", name: "Current User" },
        viewpoint,
      })

      addIssue(issue)
      setNewIssue({ title: "", description: "", priority: "MEDIUM", assignee: null, dueDate: "" })
      onOpenChange(false)
    } catch (err) {
      console.error("Failed to create issue:", err)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Title</Label>
            <Input
              placeholder="Enter issue title..."
              value={newIssue.title}
              onChange={(e) => setNewIssue({ ...newIssue, title: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label>Description</Label>
            <Textarea
              placeholder="Describe the issue..."
              value={newIssue.description}
              onChange={(e) => setNewIssue({ ...newIssue, description: e.target.value })}
              rows={4}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Priority</Label>
              <Select
                value={newIssue.priority}
                onValueChange={(value) => setNewIssue({ ...newIssue, priority: value as IssuePriority })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="LOW">Low</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input
                type="date"
                value={newIssue.dueDate}
                onChange={(e) => setNewIssue({ ...newIssue, dueDate: e.target.value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Assignee</Label>
            <AssigneePicker value={newIssue.assignee} onChange={(assignee) => setNewIssue({ ...newIssue, assignee })} />
          </div>
          <Button onClick={handleCreateIssue} className="w-full" disabled={!newIssue.title.trim()}>
            Create Issue
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
