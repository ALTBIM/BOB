"use client"

import type React from "react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertCircle, CheckCircle2, Clock, XCircle, Calendar, User, Edit2, Save, X } from "lucide-react"
import type { Issue } from "@/lib/types/issue"
import { IssueCommentsPanel } from "./issue-comments-panel"
import { IssueMarkupPanel } from "./issue-markup-panel"
import { useState } from "react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { AssigneePicker } from "./assignee-picker"
import type { IssueAssignee } from "@/lib/types/participant"
import type { IssueStatus, IssuePriority } from "@/lib/types/issue"

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

interface IssueDetailViewProps {
  issue: Issue
  viewerRef?: React.RefObject<any>
}

export function IssueDetailView({ issue, viewerRef }: IssueDetailViewProps) {
  const params = useParams()
  const projectId = params.projectId as string
  const { updateIssue } = useViewerStore()
  const [isEditing, setIsEditing] = useState(false)
  const [editedIssue, setEditedIssue] = useState({
    status: issue.status,
    priority: issue.priority,
    dueDate: issue.dueDate || "",
    assignee: issue.assignee
      ? ({
          type: "user",
          userId: issue.assignee.userId,
          displayName: issue.assignee.name,
        } as IssueAssignee)
      : null,
  })

  const StatusIcon = statusIcons[issue.status]

  const handleSave = async () => {
    try {
      await viewerApi.updateIssue(projectId, issue.id, {
        status: editedIssue.status,
        priority: editedIssue.priority,
        dueDate: editedIssue.dueDate || undefined,
        assignee: editedIssue.assignee
          ? {
              userId: editedIssue.assignee.userId || editedIssue.assignee.roleId || "",
              name: editedIssue.assignee.displayName,
            }
          : undefined,
      })
      updateIssue(issue.id, editedIssue)
      setIsEditing(false)
    } catch (error) {
      console.error("Failed to update issue:", error)
    }
  }

  return (
    <div className="flex-1 flex flex-col">
      {issue.viewpoint.snapshotUrl && (
        <div className="w-full h-48 bg-muted border-b">
          <img
            src={issue.viewpoint.snapshotUrl || "/placeholder.svg"}
            alt={issue.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      <div className="p-3 border-b space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold leading-tight">{issue.title}</h3>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 flex-shrink-0"
            onClick={() => (isEditing ? setIsEditing(false) : setIsEditing(true))}
          >
            {isEditing ? <X className="h-3.5 w-3.5" /> : <Edit2 className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {issue.description && <p className="text-xs text-muted-foreground leading-relaxed">{issue.description}</p>}

        <div className="space-y-2">
          {isEditing ? (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Status</Label>
                <Select
                  value={editedIssue.status}
                  onValueChange={(value) => setEditedIssue({ ...editedIssue, status: value as IssueStatus })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OPEN">Open</SelectItem>
                    <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                    <SelectItem value="RESOLVED">Resolved</SelectItem>
                    <SelectItem value="CLOSED">Closed</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select
                  value={editedIssue.priority}
                  onValueChange={(value) => setEditedIssue({ ...editedIssue, priority: value as IssuePriority })}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LOW">Low</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="HIGH">High</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Assignee</Label>
                <AssigneePicker
                  value={editedIssue.assignee}
                  onChange={(assignee) => setEditedIssue({ ...editedIssue, assignee })}
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs">Due Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={editedIssue.dueDate}
                  onChange={(e) => setEditedIssue({ ...editedIssue, dueDate: e.target.value })}
                />
              </div>

              <Button size="sm" className="w-full h-8 text-xs" onClick={handleSave}>
                <Save className="h-3.5 w-3.5 mr-1.5" />
                Save Changes
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 flex-wrap">
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${statusColors[issue.status]}`}>
                  <StatusIcon className="h-2.5 w-2.5 mr-1" />
                  {issue.status.replace("_", " ")}
                </Badge>
                <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 ${priorityColors[issue.priority]}`}>
                  {issue.priority}
                </Badge>
              </div>

              {issue.assignee && (
                <div className="flex items-center gap-2 text-xs">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Assigned to:</span>
                  <span className="font-medium">{issue.assignee.name}</span>
                </div>
              )}

              {issue.dueDate && (
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">Due:</span>
                  <span className="font-medium">{new Date(issue.dueDate).toLocaleDateString()}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="comments" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-2 rounded-none border-b h-10">
          <TabsTrigger value="comments" className="text-xs">
            Comments
          </TabsTrigger>
          <TabsTrigger value="markup" className="text-xs">
            Markup
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments" className="flex-1 m-0">
          <IssueCommentsPanel issueId={issue.id} />
        </TabsContent>

        <TabsContent value="markup" className="flex-1 m-0">
          <IssueMarkupPanel issueId={issue.id} snapshotUrl={issue.viewpoint.snapshotUrl} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
