"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { ChevronRight, Building, Layers, Box } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"

interface TreeNode {
  id: string
  name: string
  type: "building" | "storey" | "space" | "element"
  count?: number
  children?: TreeNode[]
}

const mockTree: TreeNode = {
  id: "building-1",
  name: "Office Building",
  type: "building",
  children: [
    {
      id: "storey-1",
      name: "Level 01",
      type: "storey",
      count: 542,
      children: [
        { id: "space-1", name: "Room 1.01", type: "space", count: 32 },
        { id: "space-2", name: "Room 1.02", type: "space", count: 28 },
        { id: "space-3", name: "Corridor 1.03", type: "space", count: 45 },
      ],
    },
    {
      id: "storey-2",
      name: "Level 02",
      type: "storey",
      count: 518,
      children: [
        { id: "space-4", name: "Room 2.01", type: "space", count: 30 },
        { id: "space-5", name: "Room 2.02", type: "space", count: 26 },
      ],
    },
  ],
}

interface TreeItemProps {
  node: TreeNode
  depth: number
}

function TreeItem({ node, depth }: TreeItemProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2)

  const Icon = node.type === "building" ? Building : node.type === "storey" ? Layers : node.type === "space" ? Box : Box

  return (
    <div>
      <button
        className={cn(
          "w-full flex items-center gap-1.5 px-2 py-1.5 text-xs hover:bg-accent/50 transition-colors",
          "text-left",
        )}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        {node.children && node.children.length > 0 && (
          <ChevronRight
            className={cn("h-3 w-3 transition-transform text-muted-foreground", isExpanded && "rotate-90")}
          />
        )}
        {(!node.children || node.children.length === 0) && <div className="w-3" />}
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="flex-1 font-medium">{node.name}</span>
        {node.count !== undefined && <span className="text-muted-foreground">({node.count})</span>}
      </button>

      {isExpanded && node.children && (
        <div>
          {node.children.map((child) => (
            <TreeItem key={child.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

export function SpatialTreePanel() {
  return (
    <ScrollArea className="h-full">
      <div className="p-2">
        <TreeItem node={mockTree} depth={0} />
      </div>
    </ScrollArea>
  )
}
