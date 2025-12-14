import { NextResponse } from "next/server"
import type { FilterGroup } from "@/lib/types/viewer"

function evaluateFilter(expression: FilterGroup): string[] {
  // Demo building element IDs: 1-15
  // 1: Foundation (IFCFOOTING)
  // 2-5: Walls (IFCWALL)
  // 6: Floor (IFCSLAB)
  // 7-10: Windows (IFCWINDOW)
  // 11-14: Columns (IFCCOLUMN)
  // 15: Roof (IFCROOF)

  const allElements = Array.from({ length: 15 }, (_, i) => (i + 1).toString())

  // Simple filter evaluation - in production this would be a proper query engine
  if (!expression.rules || expression.rules.length === 0) {
    return allElements
  }

  let results = new Set<string>()

  expression.rules.forEach((rule) => {
    if ("property" in rule) {
      // Simple rule evaluation
      const { property, operator, value } = rule

      let matchingIds: string[] = []

      if (property === "type" || property === "ifcType") {
        const typeMap: Record<string, string[]> = {
          IFCWALL: ["2", "3", "4", "5"],
          IFCSLAB: ["6"],
          IFCWINDOW: ["7", "8", "9", "10"],
          IFCCOLUMN: ["11", "12", "13", "14"],
          IFCROOF: ["15"],
          IFCFOOTING: ["1"],
        }

        if (operator === "equals" && typeof value === "string") {
          matchingIds = typeMap[value.toUpperCase()] || []
        } else if (operator === "in" && Array.isArray(value)) {
          value.forEach((v) => {
            matchingIds.push(...(typeMap[v.toUpperCase()] || []))
          })
        }
      } else if (property === "Material") {
        const materialMap: Record<string, string[]> = {
          Concrete: ["1", "2", "3", "4", "5"],
          Steel: ["11", "12", "13", "14"],
          Glass: ["7", "8", "9", "10"],
          Wood: ["6"],
          Timber: ["15"],
        }

        if (operator === "equals" && typeof value === "string") {
          matchingIds = materialMap[value] || []
        }
      } else {
        // Default: return all for unknown properties
        matchingIds = allElements
      }

      if (expression.operator === "AND") {
        if (results.size === 0) {
          results = new Set(matchingIds)
        } else {
          results = new Set([...results].filter((id) => matchingIds.includes(id)))
        }
      } else {
        matchingIds.forEach((id) => results.add(id))
      }
    }
  })

  return Array.from(results)
}

export async function POST(request: Request, { params }: { params: { modelId: string } }) {
  const body = await request.json()
  const { version, expression, return: returnType, limit } = body

  const elementIds = evaluateFilter(expression)

  // Count by type
  const typeCount: Record<string, number> = {
    IFCWALL: 0,
    IFCSLAB: 0,
    IFCWINDOW: 0,
    IFCCOLUMN: 0,
    IFCROOF: 0,
    IFCFOOTING: 0,
  }

  elementIds.forEach((id) => {
    const numId = Number.parseInt(id)
    if (numId === 1) typeCount["IFCFOOTING"]++
    else if (numId >= 2 && numId <= 5) typeCount["IFCWALL"]++
    else if (numId === 6) typeCount["IFCSLAB"]++
    else if (numId >= 7 && numId <= 10) typeCount["IFCWINDOW"]++
    else if (numId >= 11 && numId <= 14) typeCount["IFCCOLUMN"]++
    else if (numId === 15) typeCount["IFCROOF"]++
  })

  const mockResults = {
    resultCount: elementIds.length,
    elementIds: elementIds,
    stats: {
      byType: Object.entries(typeCount)
        .filter(([_, count]) => count > 0)
        .map(([key, count]) => ({ key, count })),
      byStorey: [{ key: "Ground Floor", count: elementIds.length }],
    },
  }

  return NextResponse.json(mockResults)
}
