import { NextResponse } from "next/server";
import { getRagStatus, listDocuments } from "@/lib/rag";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const projectId = url.searchParams.get("projectId") || "";

  if (!projectId) {
    return NextResponse.json({ ok: false, error: "projectId mangler" }, { status: 400 });
  }

  try {
    const status = await getRagStatus();
    const docs = await listDocuments(projectId);
    return NextResponse.json({
      ok: true,
      backend: status.backend,
      dbReady: status.dbReady,
      docCount: docs.length,
      projectId,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Health check feilet" },
      { status: 500 }
    );
  }
}
