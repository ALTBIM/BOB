import { NextResponse } from "next/server"

// Example API route handler for rules
export async function GET(request: Request, { params }: { params: { modelId: string } }) {
  const { searchParams } = new URL(request.url)
  const version = searchParams.get("version")

  // Mock rules - replace with actual rule definitions
  const rules = [
    {
      id: "rule_fire_rating",
      name: "Fire Rating Check",
      description: "Ensure all walls have fire rating specified",
    },
    {
      id: "rule_space_assignment",
      name: "Space Assignment",
      description: "All elements must be assigned to a space",
    },
    {
      id: "rule_material_check",
      name: "Material Specification",
      description: "All elements must have materials defined",
    },
  ]

  return NextResponse.json(rules)
}
