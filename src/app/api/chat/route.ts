import { NextResponse } from "next/server";
import { logInteraction } from "@/lib/logger";
import { retrieveContext, RetrievedSource } from "@/lib/rag";

// Bruk node runtime for a unngaa edge-advarsel om statisk generering
export const runtime = "nodejs";

const systemPrompt = `
Du er BOB, en faglig, prosjekt-isolert assistent for bygg/BIM.
- Bruk kun gitt kontekst og prosjektkilder. Ingen kryss-prosjekt deling.
- Struktur (alltid): 1) Konklusjon 2) Basis / Kilder 3) Anbefalinger 4) Forutsetninger & antakelser.
- Vær faktabasert og presis. Ingen gjetting eller tall uten kilde. Marker tydelig hvis data mangler.
- Hvis ingen kilder finnes, si eksplisitt at kilder mangler og foreslå hvilke dokumenter/IFC/standarder som trengs.
- Rolle-tilpasning: tilpass vinkling etter brukerrolle, men hold nøkternt og profesjonelt.
- Tone: Kort, profesjonell, neutral. Ikke småprat.`;

type ChatMemory = { id: string; text: string };

function buildUserPrompt(params: {
  message: string;
  projectId: string;
  role: string;
  style: string;
  withSources: boolean;
  memory: ChatMemory[];
  contextText: string;
}) {
  const { message, projectId, role, style, withSources, memory, contextText } = params;

  const memoryText = memory?.length
    ? memory.map((m) => `- ${m.text}`).join("\n")
    : "Ingen ekstra prosjektkontekst oppgitt.";

  const styleText = style === "detaljert" ? "Detaljert, men konsis." : "Kortfattet.";
  const sourceText = withSources
    ? "Ta med kilde-IDer i del 2."
    : "Hvis kilder finnes, referer kort uten å liste alt.";

  return `
Prosjekt-ID: ${projectId}
Brukerrolle: ${role || "ukjent"}
Svarstil: ${styleText}
Kildepolicy: ${sourceText}
Tilgjengelige kilder/utdrag:
${contextText}
Prosjektminne:
${memoryText}
Brukersporsmal:
${message}

Gi svaret med fire overskrifter som beskrevet i systemprompten.`;
}

function streamSyntheticAnswer(
  answer: string,
  meta: { projectId: string; prompt: string; role: string; sources: RetrievedSource[]; userId: string }
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      answer.split("\n").forEach((line) => {
        if (line.trim().length === 0) return;
        controller.enqueue(encoder.encode(`data: ${line}\n\n`));
      });
      controller.close();
    },
  });

  logInteraction({
    projectId: meta.projectId,
    userId: meta.userId,
    role: meta.role,
    prompt: meta.prompt,
    retrievedSources: meta.sources,
    answer,
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

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const message: string = body?.message ?? "";
  const projectId: string = body?.projectId ?? "ukjent-prosjekt";
  const style: string = body?.style ?? "kort";
  const withSources: boolean = Boolean(body?.sources ?? true);
  const memory: ChatMemory[] = body?.memory ?? [];
  const role: string = body?.role ?? "ukjent";
  const userId: string = body?.userId ?? "anonymous";

  if (!message.trim()) {
    return NextResponse.json({ error: "Melding mangler." }, { status: 400 });
  }

  const { sources: retrievedSources, contextText } = retrieveContext(projectId, message, {
    includeGeneralFallback: true,
  });

  const userPrompt = buildUserPrompt({
    message,
    projectId,
    role,
    style,
    withSources,
    memory,
    contextText,
  });

  const apiKey = process.env.OPENAI_API_KEY;

  // Fallback når API-nøkkel mangler
  if (!apiKey) {
    const synthetic = [
      "Konklusjon: Kan ikke kontakte modellen (mangler OPENAI_API_KEY). Viser foreløpig vurdering basert på lokale kilder.",
      `Basis / Kilder: ${
        retrievedSources.length
          ? retrievedSources.map((s, i) => `[Kilde ${i + 1}] ${s.title} (${s.reference})`).join("; ")
          : "Ingen kilder funnet i prosjektet."
      }`,
      "Anbefalinger: Oppgi API-nøkkel eller legg til prosjektkilder (IFC/PDF/krav) for RAG-svar.",
      "Forutsetninger & antakelser: Ingen modellrespons. Kun statisk regelverk/brukerinput lest.",
    ].join("\n");

    return streamSyntheticAnswer(synthetic, { projectId, prompt: message, role, sources: retrievedSources, userId });
  }

  const openAiPayload = {
    model: "gpt-4o-mini",
    stream: true,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  };

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
    const synthetic = [
      "Konklusjon: Klarte ikke å nå OpenAI-endepunktet.",
      `Basis / Kilder: ${
        retrievedSources.length
          ? retrievedSources.map((s, i) => `[Kilde ${i + 1}] ${s.title} (${s.reference})`).join("; ")
          : "Ingen kilder funnet i prosjektet."
      }`,
      `Anbefalinger: Sjekk nettverk og API-nøkkel. Feil: ${err?.message ?? "ukjent"}`,
      "Forutsetninger & antakelser: Ingen modellrespons.",
    ].join("\n");
    return streamSyntheticAnswer(synthetic, { projectId, prompt: message, role, sources: retrievedSources, userId });
  }

  if (!response.ok || !response.body) {
    const text = await response.text();
    const synthetic = [
      `Konklusjon: Modellkall feilet (${response.status}).`,
      `Basis / Kilder: ${
        retrievedSources.length
          ? retrievedSources.map((s, i) => `[Kilde ${i + 1}] ${s.title} (${s.reference})`).join("; ")
          : "Ingen kilder funnet i prosjektet."
      }`,
      `Anbefalinger: Sjekk API-nøkkel/kvote. Respons: ${text || "ingen detaljer."}`,
      "Forutsetninger & antakelser: Ingen modellrespons.",
    ].join("\n");
    return streamSyntheticAnswer(synthetic, { projectId, prompt: message, role, sources: retrievedSources, userId });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullAnswer = "";

  const stream = new ReadableStream({
    async start(controller) {
      // Send kildemetadata først slik at klient kan vise dem uavhengig av modellrespons
      try {
        controller.enqueue(
          encoder.encode(`data: SOURCES::${JSON.stringify(retrievedSources)}\n\n`)
        );
      } catch {
        // hvis serialisering feiler, ignorer og fortsett
      }

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
                fullAnswer += delta;
                controller.enqueue(encoder.encode(`data: ${delta}\n\n`));
              }
            } catch {
              // Ignorer parse-feil
            }
          }
        }
      } catch (err) {
        const fallback = `data: [Feil] Kunne ikke streame svar: ${
          err instanceof Error ? err.message : "ukjent"
        }\n\n`;
        controller.enqueue(encoder.encode(fallback));
      } finally {
        controller.close();
        logInteraction({
          projectId,
          userId,
          role,
          prompt: message,
          retrievedSources,
          answer: fullAnswer,
        });
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
