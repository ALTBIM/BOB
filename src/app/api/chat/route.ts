import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message: string = body?.message ?? "";
  const projectId: string = body?.projectId ?? "";

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      function queue(line: string) {
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      }

      queue(`BOB: Konklusjon for prosjekt ${projectId || "ukjent"}`);
      queue("Grunnlag: demodata uten filer. Anbefalinger: legg til prosjektfiler og krav for bedre svar.");

      let i = 0;
      const interval = setInterval(() => {
        i += 1;
        if (i === 1) queue("Neste steg: 1) Legg til IFC/PDF. 2) Velg prosjekt i toppen. 3) Kjør ny forespørsel.");
        if (i === 2) queue("Status: klar.\n");
        if (i >= 2) {
          clearInterval(interval);
          controller.close();
        }
      }, 400);
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      Connection: "keep-alive",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
