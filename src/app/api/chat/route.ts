import { NextResponse } from "next/server";
import { logInteraction } from "@/lib/logger";
import { retrieveContext, RetrievedSource } from "@/lib/rag";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectMembership } from "@/lib/supabase-auth";

export const runtime = "nodejs";

const SYSTEM_PROMPT = [
  "Du er BOB, en faglig, prosjekt-isolert assistent for bygg/BIM.",
  "- Bruk kun gitt kontekst og prosjektkilder. Ingen kryss-prosjekt deling.",
  "- Struktur (alltid): 1) Konklusjon 2) Basis / Kilder 3) Anbefalinger 4) Forutsetninger & antakelser.",
  "- V\u00e6r faktabasert og presis. Ingen gjetting eller tall uten kilde.",
  "- Hvis ingen kilder finnes, si eksplisitt at kilder mangler og foresl\u00e5 hvilke dokumenter/IFC/standarder som trengs.",
  "- Rolle-tilpasning: tilpass vinkling etter brukerrolle, men hold n\u00f8kternt og profesjonelt.",
  "- Tone: Kort, profesjonell, n\u00f8ytral. Ikke sm\u00e5prat.",
].join("\n");

type ChatMemory = { id: string; text: string };

type ChatBody = {
  message: string;
  projectId: string;
  style?: "kort" | "detaljert";
  sources?: boolean;
  memory?: ChatMemory[];
};

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
  const memoryText = memory?.length ? memory.map((m) => `- ${m.text}`).join("\n") : "Ingen ekstra prosjektkontekst oppgitt.";
  const styleText = style === "detaljert" ? "Detaljert, men konsis." : "Kortfattet.";
  const sourceText = withSources ? "Ta med kilde-IDer i del 2." : "Hvis kilder finnes, referer kort uten \u00e5 liste alt.";

  return [
    `Prosjekt-ID: ${projectId}`,
    `Brukerrolle: ${role || "ukjent"}`,
    `Svarstil: ${styleText}`,
    `Kildepolicy: ${sourceText}`,
    "Tilgjengelige kilder/utdrag:",
    contextText,
    "Prosjektminne:",
    memoryText,
    "Brukersp\u00f8rsm\u00e5l:",
    message,
    "",
    "Gi svaret med fire overskrifter som beskrevet i systemprompten.",
  ].join("\n");
}

async function ensureThread(supabase: ReturnType<typeof getSupabaseServerClient>, projectId: string, userId: string) {
  if (!supabase) return null;
  const { data: existing } = await supabase
    .from("chat_threads")
    .select("id")
    .eq("project_id", projectId)
    .eq("created_by", userId)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created } = await supabase
    .from("chat_threads")
    .insert({ project_id: projectId, created_by: userId, title: "BOB Chat" })
    .select("id")
    .single();
  return created?.id || null;
}

async function logToDb(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  threadId: string | null,
  projectId: string,
  userId: string,
  role: "user" | "assistant",
  content: string,
  sources: RetrievedSource[] = []
) {
  if (!supabase || !threadId) return;
  try {
    await supabase.from("chat_messages_v2").insert({
      thread_id: threadId,
      project_id: projectId,
      user_id: userId,
      role,
      content,
      sources: sources.length ? sources : [],
    });
  } catch (err) {
    console.warn("Kunne ikke logge chat-melding", err);
  }
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
  const body = (await request.json().catch(() => ({}))) as Partial<ChatBody>;
  const message = body?.message ?? "";
  const projectId = body?.projectId ?? "";
  const style = body?.style ?? "kort";
  const withSources = Boolean(body?.sources ?? true);
  const memory = body?.memory ?? [];

  if (!message.trim()) {
    return NextResponse.json({ error: "Melding mangler." }, { status: 400 });
  }

  if (!projectId) {
    return NextResponse.json({ error: "Prosjekt-ID mangler." }, { status: 400 });
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase ikke konfigurert." }, { status: 500 });
  }

  const { user, error: authError } = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: authError || "Ikke autentisert." }, { status: 401 });
  }

  const membership = await requireProjectMembership(supabase, projectId, user.id);
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  const role = membership.membership?.role || "byggherre";
  const threadId = await ensureThread(supabase, projectId, user.id);
  await logToDb(supabase, threadId, projectId, user.id, "user", message);

  const { sources: retrievedSources, contextText } = await retrieveContext(projectId, message, {
    includeGeneralFallback: false,
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
  const chatModel = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

  if (!apiKey) {
    const synthetic = [
      "Konklusjon: Kan ikke kontakte modellen (mangler OPENAI_API_KEY). Viser forel\u00f8pig vurdering basert p\u00e5 lokale kilder.",
      `Basis / Kilder: ${
        retrievedSources.length
          ? retrievedSources.map((s, i) => `[Kilde ${i + 1}] ${s.title} (${s.reference})`).join("; ")
          : "Ingen kilder funnet i prosjektet."
      }`,
      "Anbefalinger: Oppgi API-n\u00f8kkel eller legg til prosjektkilder (IFC/PDF/krav) for RAG-svar.",
      "Forutsetninger & antakelser: Ingen modellrespons. Kun statisk regelverk/brukerinput lest.",
    ].join("\n");

    await logToDb(supabase, threadId, projectId, user.id, "assistant", synthetic, retrievedSources);
    return streamSyntheticAnswer(synthetic, { projectId, prompt: message, role, sources: retrievedSources, userId: user.id });
  }

  const openAiPayload = {
    model: chatModel,
    stream: true,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
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
      "Konklusjon: Klarte ikke \u00e5 n\u00e5 OpenAI-endepunktet.",
      `Basis / Kilder: ${
        retrievedSources.length
          ? retrievedSources.map((s, i) => `[Kilde ${i + 1}] ${s.title} (${s.reference})`).join("; ")
          : "Ingen kilder funnet i prosjektet."
      }`,
      `Anbefalinger: Sjekk nettverk og API-n\u00f8kkel. Feil: ${err?.message ?? "ukjent"}`,
      "Forutsetninger & antakelser: Ingen modellrespons.",
    ].join("\n");
    await logToDb(supabase, threadId, projectId, user.id, "assistant", synthetic, retrievedSources);
    return streamSyntheticAnswer(synthetic, { projectId, prompt: message, role, sources: retrievedSources, userId: user.id });
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
      `Anbefalinger: Sjekk API-n\u00f8kkel/kvote. Respons: ${text || "ingen detaljer."}`,
      "Forutsetninger & antakelser: Ingen modellrespons.",
    ].join("\n");
    await logToDb(supabase, threadId, projectId, user.id, "assistant", synthetic, retrievedSources);
    return streamSyntheticAnswer(synthetic, { projectId, prompt: message, role, sources: retrievedSources, userId: user.id });
  }

  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let fullAnswer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        controller.enqueue(encoder.encode(`data: SOURCES::${JSON.stringify(retrievedSources)}\n\n`));
      } catch {
        // ignore
      }

      const reader = response!.body!.getReader();
      let buffer = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.startsWith("data:")) continue;
            const chunk = part.replace("data:", "").trim();
            if (!chunk) continue;
            fullAnswer += (fullAnswer ? "\n" : "") + chunk;
            controller.enqueue(encoder.encode(`data: ${chunk}\n\n`));
          }
        }
      } catch (err) {
        console.error("Stream error:", err);
      } finally {
        controller.close();
        await logToDb(supabase, threadId, projectId, user.id, "assistant", fullAnswer || "", retrievedSources);
        logInteraction({
          projectId,
          userId: user.id,
          role,
          prompt: message,
          retrievedSources,
          answer: fullAnswer || "Ingen svar mottatt fra modell.",
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
