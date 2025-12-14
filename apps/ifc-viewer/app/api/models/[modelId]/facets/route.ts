import { NextResponse } from "next/server"

// Example API route handler for facets
export async function GET(request: Request, { params }: { params: { modelId: string } }) {
  const { searchParams } = new URL(request.url)
  const version = searchParams.get("version")

  // Mock facets data - replace with actual database query
  const facets = {
    ifcTypes: [
      { key: "IFCWALL", count: 4 },
      { key: "IFCSLAB", count: 1 },
      { key: "IFCWINDOW", count: 4 },
      { key: "IFCCOLUMN", count: 4 },
      { key: "IFCROOF", count: 1 },
      { key: "IFCFOOTING", count: 1 },
    ],
    storeys: [{ id: "1", name: "Ground Floor", count: 15 }],
    spaces: [],
    zones: [],
    materials: [
      { key: "Concrete", count: 5 },
      { key: "Steel", count: 4 },
      { key: "Glass", count: 4 },
      { key: "Wood", count: 1 },
      { key: "Timber", count: 1 },
    ],
    classifications: [],
    psets: [
      {
        pset: "BaseQuantities",
        props: [
          { name: "Volume", valueType: "string" as const },
          { name: "Area", valueType: "string" as const },
          { name: "Height", valueType: "string" as const },
        ],
      },
    ],
  }

  return NextResponse.json(facets)
}
