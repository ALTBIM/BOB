"use client"

import type React from "react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Plus, AlertCircle, CheckCircle2, Clock, XCircle, ChevronLeft } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { CreateIssueModal } from "./create-issue-modal"
import { IssueDetailView } from "./issue-detail-view"
import type { Issue } from "@/lib/types/issue"

const statusIcons = {
  OPEN: AlertCircle,
  IN_PROGRESS: Clock,
  RESOLVED: CheckCircle2,
  CLOSED: XCircle,
}

const statusColors = {
  OPEN: "bg-red-500/10 text-red-500 border-red-500/20",
  IN_PROGRESS: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  RESOLVED: "bg-green-500/10 text-green-500 border-green-500/20",
  CLOSED: "bg-gray-500/10 text-gray-500 border-gray-500/20",
}

const priorityColors = {
  LOW: "bg-gray-500/10 text-gray-600 border-gray-500/20",
  MEDIUM: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  HIGH: "bg-red-500/10 text-red-600 border-red-500/20",
}

interface IssuesPanelProps {
  viewerRef?: React.RefObject<any>
}

export function IssuesPanel({ viewerRef }: IssuesPanelProps = {}) {
  const params = useParams()
  const projectId = params.projectId as string
  const modelId = params.modelId as string
  const { issues, setIssues, selectedIds, currentFilter, selectedIssueId, setSelectedIssueId } = useViewerStore()
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [filterStatus, setFilterStatus] = useState<string>("OPEN")

  useEffect(() => {
    const loadIssues = async () => {
      try {
        const issuesData = await viewerApi.getIssues(projectId, modelId, filterStatus, 3)
        setIssues(issuesData)
      } catch (err) {
        console.error("Failed to load issues:", err)
      }
    }

    loadIssues()
  }, [projectId, modelId, filterStatus, setIssues])

  const handleIssueClick = (issue: Issue) => {
    setSelectedIssueId(issue.id)
    if (viewerRef?.current) {
      viewerRef.current.applyViewpoint(issue.viewpoint)
    }
  }

  const selectedIssue = selectedIssueId ? issues.find((i) => i.id === selectedIssueId) : null

  const issuesByStatus = {
    OPEN: issues.filter((i) => i.status === "OPEN").length,
    IN_PROGRESS: issues.filter((i) => i.status === "IN_PROGRESS").length,
    RESOLVED: issues.filter((i) => i.status === "RESOLVED").length,
    CLOSED: issues.filter((i) => i.status === "CLOSED").length,
  }

  if (selectedIssue) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-3 border-b flex items-center gap-2">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setSelectedIssueId(null)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-xs font-semibold truncate flex-1">Issue Details</div>
        </div>
        <IssueDetailView issue={selectedIssue} viewerRef={viewerRef} />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b space-y-3">
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={() => setIsCreateDialogOpen(true)}
          disabled={selectedIds.length === 0}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" />
          Create Issue
        </Button>

        <div className="grid grid-cols-2 gap-2">
          {Object.entries(issuesByStatus).map(([status, count]) => (
            <button
              key={status}
              className={`text-xs p-2 rounded-md border transition-colors ${
                filterStatus === status ? "bg-accent border-primary" : "bg-muted/20 hover:bg-accent/50"
              }`}
              onClick={() => setFilterStatus(status)}
            >
              <div className="font-semibold">{count}</div>
              <div className="text-[10px] text-muted-foreground">{status.replace("_", " ")}</div>
            </button>
          ))}
        </div>
      </div>

      <ScrollArea className="flex-1">
        {issues.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">No issues found. Select elements and create an issue.</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {issues.map((issue) => {
              const StatusIcon = statusIcons[issue.status]
              return (
                <button
                  key={issue.id}
                  className="w-full border rounded-md overflow-hidden hover:border-primary/50 transition-colors text-left"
                  onClick={() => handleIssueClick(issue)}
                >
                  {issue.viewpoint.snapshotUrl && (
                    <div className="w-full h-24 bg-muted">
                      <img
                        src={issue.viewpoint.snapshotUrl || "/placeholder.svg"}
                        alt={issue.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}
                  <div className="p-2 space-y-1.5">
                    <div className="text-xs font-medium line-clamp-1">{issue.title}</div>
                    {issue.description && (
                      <div className="text-[10px] text-muted-foreground line-clamp-2">{issue.description}</div>
                    )}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusColors[issue.status]}`}>
                        <StatusIcon className="h-2.5 w-2.5 mr-1" />
                        {issue.status.replace("_", " ")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 py-0 h-5 ${priorityColors[issue.priority]}`}
                      >
                        {issue.priority}
                      </Badge>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </ScrollArea>

      <CreateIssueModal
        open={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        viewerRef={viewerRef}
        selectedIds={selectedIds}
        currentFilter={currentFilter}
      />
    </div>
  )
}
