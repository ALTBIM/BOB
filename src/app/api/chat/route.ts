import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message: string = body?.message ?? "";
  const projectId: string = body?.projectId ?? "";

  const reply =
    message?.length > 0
      ? `Konklusjon: Jeg tar forespørselen inn i prosjektet (${projectId || "ukjent"}). Grunnlag: demodata uten filer. Anbefalinger: legg til prosjektfiler og krav for bedre svar.`
      : "Ingen melding mottatt.";

  return NextResponse.json({ reply });
}
