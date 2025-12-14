"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Send } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"

interface IssueCommentsPanelProps {
  issueId: string
}

export function IssueCommentsPanel({ issueId }: IssueCommentsPanelProps) {
  const params = useParams()
  const projectId = params.projectId as string
  const { issueComments, setIssueComments, addIssueComment } = useViewerStore()
  const [newComment, setNewComment] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const comments = issueComments[issueId] || []

  useEffect(() => {
    const loadComments = async () => {
      try {
        const data = await viewerApi.getIssueComments(projectId, issueId)
        setIssueComments(issueId, data)
      } catch (error) {
        console.error("Failed to load comments:", error)
      }
    }

    loadComments()
  }, [projectId, issueId, setIssueComments])

  const handleSubmit = async () => {
    if (!newComment.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const comment = await viewerApi.addIssueComment(projectId, issueId, newComment.trim())
      addIssueComment(issueId, comment)
      setNewComment("")
    } catch (error) {
      console.error("Failed to add comment:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1 p-3">
        {comments.length === 0 ? (
          <div className="text-center py-8 text-xs text-muted-foreground">
            No comments yet. Be the first to comment!
          </div>
        ) : (
          <div className="space-y-3">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarFallback className="text-[10px]">
                    {comment.author.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-xs font-semibold">{comment.author.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed">{comment.text}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      <div className="p-3 border-t space-y-2">
        <Textarea
          placeholder="Add a comment... Use @ to mention"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          rows={3}
          className="text-xs resize-none"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit()
            }
          }}
        />
        <Button
          size="sm"
          className="w-full h-8 text-xs"
          onClick={handleSubmit}
          disabled={!newComment.trim() || isSubmitting}
        >
          <Send className="h-3.5 w-3.5 mr-1.5" />
          {isSubmitting ? "Sending..." : "Send Comment"}
        </Button>
      </div>
    </div>
  )
}
