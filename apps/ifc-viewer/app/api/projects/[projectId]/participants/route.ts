import { NextResponse } from "next/server"
import type { ProjectParticipants } from "@/lib/types/participant"

export async function GET(request: Request, { params }: { params: { projectId: string } }) {
  try {
    // Stub implementation - return sample participants
    const participants: ProjectParticipants = {
      companies: [
        { id: "c1", name: "Veidekke", logoUrl: undefined },
        { id: "c2", name: "Multiconsult", logoUrl: undefined },
        { id: "c3", name: "SWECO", logoUrl: undefined },
      ],
      roles: [
        { id: "r1", name: "BIM Coordinator", description: "Responsible for BIM coordination" },
        { id: "r2", name: "Project Manager", description: "Manages the project" },
        { id: "r3", name: "Architect", description: "Lead architect" },
        { id: "r4", name: "Structural Engineer", description: "Structural design" },
        { id: "r5", name: "MEP Engineer", description: "MEP systems" },
      ],
      users: [
        { id: "u1", name: "Ola Nordmann", email: "ola@veidekke.no", companyId: "c1", roles: ["r1", "r2"] },
        { id: "u2", name: "Kari Hansen", email: "kari@veidekke.no", companyId: "c1", roles: ["r3"] },
        { id: "u3", name: "Per Olsen", email: "per@multiconsult.no", companyId: "c2", roles: ["r4"] },
        { id: "u4", name: "Lise Andersen", email: "lise@sweco.no", companyId: "c3", roles: ["r5"] },
      ],
    }

    return NextResponse.json(participants)
  } catch (error) {
    console.error("Get participants error:", error)
    return NextResponse.json({ error: "Failed to fetch participants" }, { status: 500 })
  }
}
