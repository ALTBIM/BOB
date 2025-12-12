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

  const doc: SourceDocument = {
    id: body.id || `doc-${Date.now()}`,
    projectId,
    title,
    discipline,
    reference,
    zone: body.zone,
    text,
  };

  try {
    await upsertDocument(doc);
    return NextResponse.json({ ok: true, doc });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Kunne ikke lagre dokument" }, { status: 500 });
  }
}
