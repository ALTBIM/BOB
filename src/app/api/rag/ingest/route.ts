import { NextResponse } from "next/server";
import { upsertDocument, SourceDocument } from "@/lib/rag";

export const runtime = "nodejs";

type IngestBody = {
  projectId: string;
  title: string;
  discipline: string;
  reference: string;
  zone?: string;
  text: string;
  id?: string;
  userId?: string;
  role?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<IngestBody>;
  const { projectId, title, discipline, reference, text } = body;

  if (!projectId || !title || !discipline || !reference || !text) {
    return NextResponse.json(
      { error: "projectId, title, discipline, reference og text er påkrevd" },
      { status: 400 }
    );
  }

  const trimmedProject = projectId.trim();
  if (!trimmedProject) {
    return NextResponse.json({ error: "Ugyldig projectId" }, { status: 400 });
  }

  const doc: SourceDocument = {
    id: body.id || `doc-${Date.now()}`,
    projectId: trimmedProject,
    title,
    discipline,
    reference,
    zone: body.zone,
    text,
  };

  try {
    await upsertDocument(doc);
    return NextResponse.json({
      ok: true,
      doc,
      meta: {
        userId: body.userId || "ukjent",
        role: body.role || "ukjent",
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Kunne ikke lagre dokument" }, { status: 500 });
  }
}
