import { NextResponse } from "next/server"

// Example API route handler for element properties
export async function POST(request: Request, { params }: { params: { modelId: string } }) {
  const body = await request.json()
  const { version, elementIds } = body

  // Mock properties data - replace with actual database query
  const mockProperties = {
    items: elementIds.slice(0, 1).map((id: string) => ({
      elementId: id,
      globalId: "3hK2mN5yD8v9B1nL4xP7tR",
      ifcType: "IfcWall",
      name: "Wall-123",
      tag: "A-201",
      storey: "Level 02",
      space: "Room 2.01",
      materials: ["Concrete", "Gypsum Board"],
      quantities: {
        Length: 3.2,
        Area: 8.1,
        Volume: 0.4,
      },
      psets: {
        Pset_WallCommon: {
          FireRating: "EI60",
          LoadBearing: true,
          Reference: "W-001",
        },
      },
    })),
  }

  return NextResponse.json(mockProperties)
}
