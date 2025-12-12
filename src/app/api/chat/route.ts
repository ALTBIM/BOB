import { NextResponse } from "next/server";

// Bruk node runtime for a unngaa edge-advarsel om statisk generering
export const runtime = "nodejs";

const systemPrompt = `
Du er BOB, en faglig assistent for bygg og anlegg.
Svar kort og praktisk. Struktur: Konklusjon forst, deretter grunnlag/kilder/antakelser og konkrete anbefalinger.
Nar kilder mangler, si hva du antar og hva du trenger (f.eks. IFC/PDF/krav).
Ikke hallusiner: merk antakelser tydelig. Tone: profesjonell, presis, losningsorientert.
`;

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message: string = body?.message ?? "";
  const projectId: string = body?.projectId ?? "";
  const style: string = body?.style ?? "kort";
  const sources: boolean = Boolean(body?.sources);
  const memory: { id: string; text: string }[] = body?.memory ?? [];

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY mangler. Sett den i miljoevariabler." },
      { status: 500 }
    );
  }

  if (!message.trim()) {
    return NextResponse.json({ error: "Melding mangler." }, { status: 400 });
  }

  const memoryText = memory.length
    ? `Prosjektkontekst:\n${memory.map((m) => `- ${m.text}`).join("\n")}`
    : "Ingen prosjektkontekst oppgitt.";

  const modeText =
    style === "detaljert"
      ? "Svar detaljert med metode/forutsetninger."
      : "Svar kortfattet.";

  const sourcesText = sources ? "Hvis mulig: foreslaa kilder/utdrag som trengs." : "Ikke etterspor kilder.";

  const userPrompt = `
Prosjekt: ${projectId || "ukjent"}
${memoryText}
Modus: ${modeText} ${sourcesText}
Bruker sier: ${message}
Gi konklusjon forst, deretter grunnlag/antakelser og anbefalinger.`;

  const openAiPayload = {
    model: "gpt-4o-mini",
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(openAiPayload),
    });
  } catch (err: any) {
    return NextResponse.json({ error: `OpenAI-foresporsel feilet: ${err?.message || err}` }, { status: 500 });
  }

  if (!response.ok || !response.body) {
    const text = await response.text();
    return NextResponse.json(
      { error: "OpenAI svarte ikke OK", status: response.status, body: text },
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  const stream = new ReadableStream({
    async start(controller) {
      const reader = response!.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data:")) continue;
            const data = trimmed.replace("data:", "").trim();
            if (data === "[DONE]") {
              controller.close();
              return;
            }
            try {
              const json = JSON.parse(data);
              const delta: string = json?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                controller.enqueue(encoder.encode(`data: ${delta}\n\n`));
              }
            } catch (err) {
              // ignorer parse-feil
            }
          }
        }
      } catch (err) {
        controller.enqueue(encoder.encode(`data: [Feil] Kunne ikke streame svar.\n\n`));
      } finally {
        controller.close();
      }
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
