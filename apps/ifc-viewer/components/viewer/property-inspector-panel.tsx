"use client"

import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { useViewerStore } from "@/lib/store/viewer-store"
import { useEffect } from "react"
import { viewerApi } from "@/lib/api/viewer-api"
import { useParams } from "next/navigation"

interface PropertyInspectorPanelProps {
  showQuantitiesOnly?: boolean
}

export function PropertyInspectorPanel({ showQuantitiesOnly = false }: PropertyInspectorPanelProps) {
  const params = useParams()
  const modelId = params.modelId as string
  const { selectedIds, selectedProperties, setSelectedProperties } = useViewerStore()

  useEffect(() => {
    if (selectedIds.length === 0) {
      setSelectedProperties([])
      return
    }

    const loadProperties = async () => {
      try {
        const response = await viewerApi.getProperties(modelId, 3, selectedIds)
        setSelectedProperties(response.items)
      } catch (err) {
        console.error("Failed to load properties:", err)
      }
    }

    loadProperties()
  }, [selectedIds, modelId, setSelectedProperties])

  if (selectedIds.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground text-center">
          Select an element to view {showQuantitiesOnly ? "quantities" : "properties"}
        </p>
      </div>
    )
  }

  if (selectedProperties.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  const property = selectedProperties[0]

  if (showQuantitiesOnly) {
    return (
      <ScrollArea className="h-full">
        <div className="p-4 space-y-4">
          <div>
            <h3 className="font-semibold text-sm mb-2">Quantities</h3>
            {property.quantities && (
              <div className="space-y-1.5">
                {Object.entries(property.quantities).map(([key, value]) => (
                  <div key={key} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{key}</span>
                    <span className="font-mono">{value.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>
    )
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-4 space-y-4">
        <div>
          <h3 className="font-semibold text-sm mb-2">Basic Properties</h3>
          <div className="space-y-1.5">
            <PropertyRow label="Name" value={property.name} />
            <PropertyRow label="Type" value={property.ifcType} />
            {property.tag && <PropertyRow label="Tag" value={property.tag} />}
            {property.storey && <PropertyRow label="Storey" value={property.storey} />}
            {property.space && <PropertyRow label="Space" value={property.space} />}
            <PropertyRow label="Global ID" value={property.globalId} mono />
          </div>
        </div>

        {property.materials && property.materials.length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold text-sm mb-2">Materials</h3>
              <div className="space-y-1">
                {property.materials.map((material, idx) => (
                  <div key={idx} className="text-xs">
                    {material}
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {property.psets && Object.keys(property.psets).length > 0 && (
          <>
            <Separator />
            <div>
              <h3 className="font-semibold text-sm mb-2">Property Sets</h3>
              {Object.entries(property.psets).map(([psetName, props]) => (
                <div key={psetName} className="mb-3">
                  <h4 className="text-xs font-medium text-muted-foreground mb-1.5">{psetName}</h4>
                  <div className="space-y-1.5 pl-2">
                    {Object.entries(props).map(([propName, propValue]) => (
                      <PropertyRow key={propName} label={propName} value={String(propValue)} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </ScrollArea>
  )
}

function PropertyRow({
  label,
  value,
  mono = false,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex justify-between gap-4 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-right break-all", mono && "font-mono text-[10px]")}>{value}</span>
    </div>
  )
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(" ")
}
