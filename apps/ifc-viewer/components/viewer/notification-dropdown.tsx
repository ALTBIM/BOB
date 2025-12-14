"use client"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Bell, Settings, AlertCircle, MessageSquare, CheckCircle2, FileDown, FileUp } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { NotificationPreferencesModal } from "./notification-preferences-modal"

const notificationIcons = {
  ISSUE_ASSIGNED: AlertCircle,
  ISSUE_STATUS_CHANGED: CheckCircle2,
  COMMENT_ADDED: MessageSquare,
  COMMENT_MENTION: MessageSquare,
  BCF_IMPORT_COMPLETED: FileUp,
  BCF_EXPORT_COMPLETED: FileDown,
  RULE_CHECK_FAILED: AlertCircle,
}

export function NotificationDropdown() {
  const params = useParams()
  const router = useRouter()
  const projectId = params.projectId as string
  const { notifications, unreadNotificationCount, setNotifications, markNotificationRead } = useViewerStore()
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false)

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const data = await viewerApi.getNotifications(projectId)
        setNotifications(data)
      } catch (error) {
        console.error("Failed to load notifications:", error)
      }
    }

    loadNotifications()
  }, [projectId, setNotifications])

  const handleNotificationClick = async (notificationId: string, issueId?: string) => {
    try {
      await viewerApi.markNotificationRead(projectId, notificationId)
      markNotificationRead(notificationId)

      if (issueId) {
        // Navigate to issue or select it
      }
    } catch (error) {
      console.error("Failed to mark notification as read:", error)
    }
  }

  const recentNotifications = notifications.slice(0, 10)

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 px-0 relative">
            <Bell className="h-4 w-4" />
            {unreadNotificationCount > 0 && (
              <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-[10px]">
                {unreadNotificationCount > 9 ? "9+" : unreadNotificationCount}
              </Badge>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-96">
          <div className="flex items-center justify-between p-3 border-b">
            <div className="font-semibold text-sm">Notifications</div>
            <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsPreferencesOpen(true)}>
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>

          {recentNotifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No notifications</div>
          ) : (
            <>
              <ScrollArea className="h-96">
                <div className="p-2 space-y-1">
                  {recentNotifications.map((notification) => {
                    const Icon = notificationIcons[notification.type]
                    return (
                      <button
                        key={notification.id}
                        className={`w-full text-left p-2 rounded-md hover:bg-accent transition-colors ${
                          !notification.read ? "bg-accent/50" : ""
                        }`}
                        onClick={() => handleNotificationClick(notification.id, notification.issueId)}
                      >
                        <div className="flex gap-2">
                          <Icon className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                          <div className="flex-1 space-y-1">
                            <div className="text-xs font-medium">{notification.title}</div>
                            <div className="text-[10px] text-muted-foreground line-clamp-2">{notification.message}</div>
                            <div className="text-[10px] text-muted-foreground">
                              {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                            </div>
                          </div>
                          {!notification.read && <div className="h-2 w-2 rounded-full bg-primary flex-shrink-0 mt-1" />}
                        </div>
                      </button>
                    )
                  })}
                </div>
              </ScrollArea>

              <DropdownMenuSeparator />

              <DropdownMenuItem
                className="cursor-pointer"
                onClick={() => router.push(`/projects/${projectId}/notifications`)}
              >
                View all notifications
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <NotificationPreferencesModal open={isPreferencesOpen} onOpenChange={setIsPreferencesOpen} />
    </>
  )
}
