import { NextResponse } from "next/server";
import { getRagStatus, listDocuments } from "@/lib/rag";

export const runtime = "nodejs";

export async function GET() {
  try {
    const status = await getRagStatus();
    const docs = await listDocuments();
    return NextResponse.json({
      ok: true,
      backend: status.backend,
      dbReady: status.dbReady,
      docCount: docs.length,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Health check feilet" },
      { status: 500 }
    );
  }
}
