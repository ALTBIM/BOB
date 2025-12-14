"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, XCircle, AlertTriangle, HelpCircle } from "lucide-react"
import { useViewerStore } from "@/lib/store/viewer-store"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import type { RuleResultSummary } from "@/lib/types/rules"
import { nanoid } from "nanoid"
import type { FilterGroup } from "@/lib/types/viewer"

const statusIcons = {
  PASS: CheckCircle2,
  FAIL: XCircle,
  MISSING: AlertTriangle,
  NOT_CHECKED: HelpCircle,
}

const statusColors = {
  PASS: "bg-green-500/10 text-green-600 border-green-500/20",
  FAIL: "bg-red-500/10 text-red-600 border-red-500/20",
  MISSING: "bg-yellow-500/10 text-yellow-600 border-yellow-500/20",
  NOT_CHECKED: "bg-gray-500/10 text-gray-600 border-gray-500/20",
}

export function RuleChecksPanel() {
  const params = useParams()
  const modelId = params.modelId as string
  const { rules, setRules, activeRuleId, setActiveRuleId, setCurrentFilter, setColorMode } = useViewerStore()
  const [ruleSummaries, setRuleSummaries] = useState<Record<string, RuleResultSummary>>({})

  useEffect(() => {
    const loadRules = async () => {
      try {
        const rulesData = await viewerApi.getRules(modelId, 3)
        setRules(rulesData)

        // Load summaries for each rule
        const summaries: Record<string, RuleResultSummary> = {}
        for (const rule of rulesData) {
          try {
            const summary = await viewerApi.getRuleSummary(modelId, rule.id, 3)
            summaries[rule.id] = summary
          } catch (err) {
            console.error(`Failed to load summary for rule ${rule.id}:`, err)
          }
        }
        setRuleSummaries(summaries)
      } catch (err) {
        console.error("Failed to load rules:", err)
      }
    }

    loadRules()
  }, [modelId, setRules])

  const handleApplyRuleFilter = (ruleId: string, status: "FAIL" | "MISSING" | "PASS") => {
    const filterExpression: FilterGroup = {
      id: nanoid(),
      type: "group",
      op: "AND",
      children: [
        {
          id: nanoid(),
          type: "rule",
          field: { kind: "ruleStatus", ruleId },
          op: "IN",
          value: [status],
        },
      ],
    }

    setCurrentFilter(filterExpression)
    setActiveRuleId(ruleId)
  }

  const handleColorByRule = (ruleId: string) => {
    setColorMode("byRuleStatus")
    setActiveRuleId(ruleId)
  }

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b">
        <div className="text-xs font-semibold">Rule Checks</div>
        <div className="text-[10px] text-muted-foreground mt-1">Quality validation rules</div>
      </div>

      <ScrollArea className="flex-1">
        {rules.length === 0 ? (
          <div className="p-4 text-center">
            <p className="text-xs text-muted-foreground">No rule checks configured for this model.</p>
          </div>
        ) : (
          <div className="p-2 space-y-2">
            {rules.map((rule) => {
              const summary = ruleSummaries[rule.id]
              const isActive = activeRuleId === rule.id

              return (
                <div
                  key={rule.id}
                  className={`border rounded-md p-3 space-y-2 ${isActive ? "border-primary bg-accent/30" : ""}`}
                >
                  <div>
                    <div className="text-xs font-medium">{rule.name}</div>
                    {rule.description && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">{rule.description}</div>
                    )}
                  </div>

                  {summary && (
                    <div className="grid grid-cols-2 gap-1.5">
                      {Object.entries(summary.counts).map(([status, count]) => {
                        if (count === 0) return null
                        const Icon = statusIcons[status as keyof typeof statusIcons]
                        return (
                          <Badge
                            key={status}
                            variant="outline"
                            className={`text-[10px] px-2 py-1 justify-between ${statusColors[status as keyof typeof statusColors]}`}
                          >
                            <div className="flex items-center gap-1">
                              <Icon className="h-2.5 w-2.5" />
                              <span>{status}</span>
                            </div>
                            <span className="font-semibold">{count}</span>
                          </Badge>
                        )
                      })}
                    </div>
                  )}

                  <div className="flex gap-1.5">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[10px] bg-transparent"
                      onClick={() => handleApplyRuleFilter(rule.id, "FAIL")}
                    >
                      Show Failures
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 h-7 text-[10px] bg-transparent"
                      onClick={() => handleColorByRule(rule.id)}
                    >
                      Color By Status
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
