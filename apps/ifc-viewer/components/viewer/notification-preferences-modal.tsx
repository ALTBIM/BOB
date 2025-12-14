"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useParams } from "next/navigation"
import { useState, useEffect } from "react"
import { viewerApi } from "@/lib/api/viewer-api"
import type { NotificationPreferences, NotificationType, NotificationFrequency } from "@/lib/types/notification"

interface NotificationPreferencesModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const notificationTypeLabels: Record<NotificationType, string> = {
  ISSUE_ASSIGNED: "Issue assigned to you",
  ISSUE_STATUS_CHANGED: "Issue status changed",
  COMMENT_ADDED: "Comment added to issue",
  COMMENT_MENTION: "You are mentioned in comment",
  BCF_IMPORT_COMPLETED: "BCF import completed",
  BCF_EXPORT_COMPLETED: "BCF export completed",
  RULE_CHECK_FAILED: "Rule check failed",
}

export function NotificationPreferencesModal({ open, onOpenChange }: NotificationPreferencesModalProps) {
  const params = useParams()
  const projectId = params.projectId as string

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null)

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const data = await viewerApi.getNotificationPreferences(projectId)
        setPreferences(data)
      } catch (error) {
        console.error("Failed to load preferences:", error)
      }
    }

    if (open) {
      loadPreferences()
    }
  }, [projectId, open])

  const handleToggle = async (type: NotificationType, enabled: boolean) => {
    if (!preferences) return

    const updated = {
      ...preferences,
      preferences: {
        ...preferences.preferences,
        [type]: { ...preferences.preferences[type], enabled },
      },
    }

    setPreferences(updated)

    try {
      await viewerApi.updateNotificationPreferences(projectId, updated)
    } catch (error) {
      console.error("Failed to update preferences:", error)
    }
  }

  const handleFrequencyChange = async (type: NotificationType, frequency: NotificationFrequency) => {
    if (!preferences) return

    const updated = {
      ...preferences,
      preferences: {
        ...preferences.preferences,
        [type]: { ...preferences.preferences[type], frequency },
      },
    }

    setPreferences(updated)

    try {
      await viewerApi.updateNotificationPreferences(projectId, updated)
    } catch (error) {
      console.error("Failed to update preferences:", error)
    }
  }

  if (!preferences) {
    return null
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Notification Preferences</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {Object.entries(notificationTypeLabels).map(([type, label]) => {
            const pref = preferences.preferences[type as NotificationType]
            return (
              <div key={type} className="flex items-center justify-between py-2 border-b">
                <div className="flex items-center gap-3 flex-1">
                  <Switch
                    checked={pref.enabled}
                    onCheckedChange={(enabled) => handleToggle(type as NotificationType, enabled)}
                  />
                  <Label className="font-normal">{label}</Label>
                </div>
                <Select
                  value={pref.frequency}
                  onValueChange={(freq) =>
                    handleFrequencyChange(type as NotificationType, freq as NotificationFrequency)
                  }
                  disabled={!pref.enabled}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="immediate">Immediate</SelectItem>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )
          })}
        </div>
      </DialogContent>
    </Dialog>
  )
}
