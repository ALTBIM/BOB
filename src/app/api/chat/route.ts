import { NextResponse } from "next/server";
import { logInteraction } from "@/lib/logger";
import { retrieveContext, RetrievedSource } from "@/lib/rag";
import { getSupabaseServerClient } from "@/lib/supabase-server";
import { getAuthUser, requireProjectAccess } from "@/lib/supabase-auth";

export const runtime = "nodejs";

const FILE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_FILE_BUCKET || "project-files";
const SIGNED_URL_TTL = 60 * 60;

const SYSTEM_PROMPT = [
  "Du er BOB, en faglig, prosjekt-isolert assistent for bygg/BIM.",
  "- Bruk kun gitt kontekst og prosjektkilder. Ingen kryss-prosjekt deling.",
  "- Hvis kilder mangler: svar at du ikke kan konkludere uten prosjektkilder.",
  "- Ingen gjetting, ingen standardtall, ingen antakelser uten kilder.",
  "- Rolle-tilpasning: vektlegg brukerens rolle, men hold n\u00f8kternt og profesjonelt.",
  "- Svarformat M\u00c5 v\u00e6re JSON med n\u00f8klene: conclusion, basis, recommendations, assumptions, draft_actions, missing_sources.",
  "- Ikke bruk markdown, ikke legg til andre felter.",
].join("\n");

const SYSTEM_PROMPT_GENERAL = [
  "Du er BOB, en faglig assistent for bygg/BIM.",
  "- Det finnes ingen prosjektkilder tilgjengelig for dette sp\u00f8rsm\u00e5let.",
  "- Du kan gi generell veiledning og stille avklarende sp\u00f8rsm\u00e5l, men IKKE gi prosjektspesifikke p\u00e5stander.",
  "- Merk tydelig at svaret er generelt og ikke basert p\u00e5 prosjektkilder.",
  "- Ikke bruk standardtall/krav som kan oppfattes som prosjektfakta.",
  "- Svarformat M\u00c5 v\u00e6re JSON med n\u00f8klene: conclusion, basis, recommendations, assumptions, draft_actions, missing_sources.",
  "- Ikke bruk markdown, ikke legg til andre felter.",
].join("\n");

type ChatMemory = { id: string; text: string };

type ChatBody = {
  message: string;
  projectId: string;
  style?: "kort" | "detaljert";
  sources?: boolean;
  memory?: ChatMemory[];
  general?: boolean;
  stream?: boolean;
};

type ChatSource = RetrievedSource & { url?: string | null };

type DraftAction = {
  title: string;
  description?: string;
  type?: string;
  payload?: Record<string, unknown>;
};

type MissingSource = {
  type: string;
  description: string;
};

type ChatEnvelope = {
  conclusion: string;
  basis: string;
  recommendations: string[];
  assumptions: string[];
  draft_actions: DraftAction[];
  missing_sources: MissingSource[];
  sources: ChatSource[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ROLE_FOCUS: Record<string, string> = {
  byggherre: "risiko, ansvar, kost, kontrakt",
  prosjektleder: "fremdrift, beslutninger, koordinering",
  bas_byggeledelse: "utf\u00f8relse, rekkef\u00f8lge, kvalitet p\u00e5 byggeplass",
  prosjekterende_ark: "l\u00f8sninger, krav, arkitektur",
  prosjekterende_rib: "konstruksjon, dimensjonering, sikkerhet",
  prosjekterende_riv: "VVS, funksjon, drift",
  prosjekterende_rie: "elektro, sikkerhet, drift",
  leverandor_logistikk: "leveranser, logistikk, tidsvinduer",
  kvalitet_hms: "HMS, avvik, kravoppfyllelse",
};

const normalizeStringList = (value: unknown): string[] => {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v)).map((v) => v.trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    return value
      .split(/\n|;|•|-/)
      .map((v) => v.trim())
      .filter(Boolean);
  }
  return [];
};

const normalizeDraftActions = (value: unknown): DraftAction[] => {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;
      const obj = item as Record<string, unknown>;
      const title = String(obj.title || obj.name || "").trim();
      if (!title) return null;
      const description = obj.description ? String(obj.description) : undefined;
      const type = obj.type ? String(obj.type) : undefined;
      const payload = obj.payload && typeof obj.payload === "object" ? (obj.payload as Record<string, unknown>) : undefined;
      return { title, description, type, payload };
    })
    .filter(Boolean) as DraftAction[];
};

const normalizeMissingSources = (value: unknown, fallback: MissingSource[]): MissingSource[] => {
  if (!value) return fallback;
  if (Array.isArray(value)) {
    const mapped = value
      .map((item) => {
        if (typeof item === "string") {
          return { type: "ukjent", description: item };
        }
        if (item && typeof item === "object") {
          const obj = item as Record<string, unknown>;
          const type = String(obj.type || "ukjent");
          const description = String(obj.description || obj.title || "");
          if (!description) return null;
          return { type, description };
        }
        return null;
      })
      .filter(Boolean) as MissingSource[];
    return mapped.length ? mapped : fallback;
  }
  return fallback;
};

const ensureNoSourceBasis = (basis: string) => {
  const normalized = basis.trim();
  if (!normalized) return "Ingen kilder funnet i prosjektet. Svaret er generell veiledning.";
  const lowered = normalized.toLowerCase();
  if (lowered.includes("ingen kilder")) return normalized;
  return `Ingen kilder funnet i prosjektet. ${normalized}`;
};

const extractJson = (text: string): Record<string, unknown> | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }
    return null;
  }
};

const toSse = (event: string, data: unknown) =>
  `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

async function signSources(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  sources: RetrievedSource[]
): Promise<ChatSource[]> {
  if (!supabase || !sources.length) return sources;
  const signed: ChatSource[] = [];
  for (const source of sources) {
    let url: string | null = null;
    const path = source.sourcePath || "";
    if (path.startsWith("http")) {
      url = path;
    } else if (path) {
      const { data } = await supabase.storage.from(FILE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
      url = data?.signedUrl || null;
    }
    signed.push({ ...source, url });
  }
  return signed;
}

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
  const sourceText = withSources ? "Ta hensyn til kildene og oppgi dem i basis." : "Svar uten \u00e5 liste kilder.";
  const focus = ROLE_FOCUS[role] ? `Rollefokus: ${ROLE_FOCUS[role]}` : "Rollefokus: ukjent";

  return [
    `Prosjekt-ID: ${projectId}`,
    `Brukerrolle: ${role || "ukjent"}`,
    focus,
    `Svarstil: ${styleText}`,
    `Kildepolicy: ${sourceText}`,
    "Tilgjengelige kilder/utdrag:",
    contextText,
    "Prosjektminne:",
    memoryText,
    "Brukersp\u00f8rsm\u00e5l:",
    message,
    "",
    "Svar som JSON med feltene:",
    "{",
    '  "conclusion": string,',
    '  "basis": string,',
    '  "recommendations": string[],',
    '  "assumptions": string[],',
    '  "draft_actions": [{ "title": string, "description": string, "type": string, "payload": object }],',
    '  "missing_sources": [{ "type": string, "description": string }]',
    "}",
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
  sources: ChatSource[] = [],
  citations: ChatSource[] = [],
  usedChunkIds: string[] = []
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
      citations: citations.length ? citations : [],
      used_chunk_ids: usedChunkIds.length ? usedChunkIds : [],
    });
  } catch (err) {
    console.warn("Kunne ikke logge chat-melding", err);
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<ChatBody>;
  const message = body?.message ?? "";
  const projectId = body?.projectId ?? "";
  const style = body?.style ?? "kort";
  const withSources = Boolean(body?.sources ?? true);
  const memory = body?.memory ?? [];
  const allowGeneral = body?.general !== false;
  const wantsStream = body?.stream !== false;

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

  const membership = await requireProjectAccess(supabase, projectId, user.id, "write");
  if (!membership.ok) {
    return NextResponse.json({ error: membership.error || "Ingen tilgang." }, { status: 403 });
  }

  const role = membership.membership?.role || "byggherre";
  const threadId = await ensureThread(supabase, projectId, user.id);
  await logToDb(supabase, threadId, projectId, user.id, "user", message);

  const { sources: retrievedSources, contextText } = await retrieveContext(projectId, message);
  const signedSources = withSources ? await signSources(supabase, retrievedSources) : [];
  const usedChunkIds = retrievedSources.map((s) => s.id).filter((id) => UUID_RE.test(id));

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

  const missingSourcesFallback: MissingSource[] = retrievedSources.length
    ? []
    : [
        { type: "ifc", description: "Last opp IFC-modell for mengder/objekter/soner." },
        { type: "pdf", description: "Last opp relevante PDF-krav og beskrivelse." },
        { type: "schedule", description: "Last opp fremdriftsplan (XLSX/CSV)." },
      ];

  const hasSources = retrievedSources.length > 0;

  if (!hasSources && !allowGeneral) {
    const fallback: ChatEnvelope = {
      conclusion: "Kan ikke gi et faglig svar uten prosjektkilder.",
      basis: "Ingen kilder funnet i prosjektet.",
      recommendations: [
        "Last opp relevante prosjektfiler (IFC, PDF-krav, beskrivelser, fremdriftsplan).",
        "Knytt dokumentene til riktig prosjekt og pr\u00f8v p\u00e5 nytt.",
      ],
      assumptions: ["Ingen kilder tilgjengelig for dette prosjektet."],
      draft_actions: [],
      missing_sources: missingSourcesFallback,
      sources: signedSources,
    };

    const rawText = JSON.stringify(fallback);
    await logToDb(supabase, threadId, projectId, user.id, "assistant", rawText, signedSources, signedSources, usedChunkIds);
    logInteraction({
      projectId,
      userId: user.id,
      role,
      prompt: message,
      retrievedSources,
      answer: rawText,
    });

    if (wantsStream) {
      const stream = new ReadableStream({
        start(controller) {
          const encoder = new TextEncoder();
          controller.enqueue(encoder.encode(toSse("done", { ok: false, error: "NO_SOURCES", response: fallback })));
          controller.close();
        },
      });
      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    return NextResponse.json({ ok: false, error: "NO_SOURCES", response: fallback }, { status: 200 });
  }

  if (!apiKey) {
    const fallback: ChatEnvelope = {
      conclusion: "Kan ikke kontakte modellen (mangler OPENAI_API_KEY).",
      basis: hasSources
        ? "Svar basert p\u00e5 tilgjengelige prosjektkilder."
        : "Ingen prosjektkilder funnet. Generell veiledning er utilgjengelig uten modell.",
      recommendations: [
        "Legg inn API-n\u00f8kkel.",
        "Last opp prosjektkilder (IFC/PDF/krav) for RAG-svar.",
      ],
      assumptions: ["Ingen modellrespons tilgjengelig."],
      draft_actions: [],
      missing_sources: missingSourcesFallback,
      sources: signedSources,
    };

    const rawText = JSON.stringify(fallback);
    await logToDb(supabase, threadId, projectId, user.id, "assistant", rawText, signedSources, signedSources, usedChunkIds);
    logInteraction({
      projectId,
      userId: user.id,
      role,
      prompt: message,
      retrievedSources,
      answer: rawText,
    });

    return NextResponse.json({ ok: false, error: "MISSING_OPENAI_KEY", response: fallback }, { status: 500 });
  }

  const openAiPayload = {
    model: chatModel,
    response_format: { type: "json_object" as const },
    messages: [
      { role: "system", content: hasSources ? SYSTEM_PROMPT : SYSTEM_PROMPT_GENERAL },
      { role: "user", content: userPrompt },
    ],
  };

  if (wantsStream) {
    const streamPayload = { ...openAiPayload, stream: true };
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        let rawContent = "";
        let finished = false;

        let openAiResponse: Response;
        try {
          openAiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify(streamPayload),
          });
        } catch (err: any) {
          const fallback: ChatEnvelope = {
            conclusion: "Klarte ikke \u00e5 n\u00e5 OpenAI-endepunktet.",
            basis: retrievedSources.length ? "Svar basert p\u00e5 lokale kilder." : "Ingen kilder funnet i prosjektet.",
            recommendations: [`Sjekk nettverk og API-n\u00f8kkel. Feil: ${err?.message ?? "ukjent"}`],
            assumptions: ["Ingen modellrespons tilgjengelig."],
            draft_actions: [],
            missing_sources: missingSourcesFallback,
            sources: signedSources,
          };
          controller.enqueue(encoder.encode(toSse("done", { ok: false, error: "OPENAI_UNREACHABLE", response: fallback })));
          await logToDb(supabase, threadId, projectId, user.id, "assistant", JSON.stringify(fallback), signedSources, signedSources, usedChunkIds);
          logInteraction({
            projectId,
            userId: user.id,
            role,
            prompt: message,
            retrievedSources,
            answer: JSON.stringify(fallback),
          });
          controller.close();
          return;
        }

        if (!openAiResponse.ok || !openAiResponse.body) {
          const text = await openAiResponse.text().catch(() => "");
          const fallback: ChatEnvelope = {
            conclusion: `Modellkall feilet (${openAiResponse.status}).`,
            basis: retrievedSources.length ? "Svar basert p\u00e5 lokale kilder." : "Ingen kilder funnet i prosjektet.",
            recommendations: [`Sjekk API-n\u00f8kkel/kvote. Respons: ${text || "ingen detaljer."}`],
            assumptions: ["Ingen modellrespons tilgjengelig."],
            draft_actions: [],
            missing_sources: missingSourcesFallback,
            sources: signedSources,
          };
          controller.enqueue(encoder.encode(toSse("done", { ok: false, error: "OPENAI_FAILED", response: fallback })));
          await logToDb(supabase, threadId, projectId, user.id, "assistant", JSON.stringify(fallback), signedSources, signedSources, usedChunkIds);
          logInteraction({
            projectId,
            userId: user.id,
            role,
            prompt: message,
            retrievedSources,
            answer: JSON.stringify(fallback),
          });
          controller.close();
          return;
        }

        const reader = openAiResponse.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (!finished) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx = buffer.indexOf("\n\n");
          while (idx !== -1) {
            const chunk = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = chunk.split("\n");
            let data = "";
            for (const line of lines) {
              if (line.startsWith("data:")) {
                data += line.slice(5).trim();
              }
            }
            if (!data) {
              idx = buffer.indexOf("\n\n");
              continue;
            }
            if (data === "[DONE]") {
              finished = true;
              break;
            }
            try {
              const payload = JSON.parse(data) as any;
              const delta = payload?.choices?.[0]?.delta?.content ?? "";
              if (delta) {
                rawContent += delta;
                controller.enqueue(encoder.encode(toSse("delta", { text: delta })));
              }
            } catch {
              // ignore malformed chunks
            }
            idx = buffer.indexOf("\n\n");
          }
        }

        const parsed = extractJson(rawContent) || {};
        const envelope: ChatEnvelope = {
          conclusion: String(parsed.conclusion || parsed.summary || "").trim() || "Ingen konklusjon mottatt.",
          basis: String(parsed.basis || parsed.sources || "").trim() || "Ingen kilder oppgitt.",
          recommendations: normalizeStringList(parsed.recommendations),
          assumptions: normalizeStringList(parsed.assumptions),
          draft_actions: normalizeDraftActions(parsed.draft_actions),
          missing_sources: normalizeMissingSources(parsed.missing_sources, missingSourcesFallback),
          sources: signedSources,
        };
        if (!hasSources) {
          envelope.basis = ensureNoSourceBasis(envelope.basis);
          if (!envelope.assumptions.length) {
            envelope.assumptions = ["Svar uten prosjektkilder."];
          }
        }

        const rawText = JSON.stringify(envelope);
        controller.enqueue(encoder.encode(toSse("done", { ok: true, response: envelope })));
        await logToDb(supabase, threadId, projectId, user.id, "assistant", rawText, signedSources, signedSources, usedChunkIds);
        logInteraction({
          projectId,
          userId: user.id,
          role,
          prompt: message,
          retrievedSources,
          answer: rawText,
        });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

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
    const fallback: ChatEnvelope = {
      conclusion: "Klarte ikke \u00e5 n\u00e5 OpenAI-endepunktet.",
      basis: retrievedSources.length ? "Svar basert p\u00e5 lokale kilder." : "Ingen kilder funnet i prosjektet.",
      recommendations: [`Sjekk nettverk og API-n\u00f8kkel. Feil: ${err?.message ?? "ukjent"}`],
      assumptions: ["Ingen modellrespons tilgjengelig."],
      draft_actions: [],
      missing_sources: missingSourcesFallback,
      sources: signedSources,
    };
    const rawText = JSON.stringify(fallback);
    await logToDb(supabase, threadId, projectId, user.id, "assistant", rawText, signedSources, signedSources, usedChunkIds);
    logInteraction({
      projectId,
      userId: user.id,
      role,
      prompt: message,
      retrievedSources,
      answer: rawText,
    });
    return NextResponse.json({ ok: false, error: "OPENAI_UNREACHABLE", response: fallback }, { status: 502 });
  }

  if (!response.ok) {
    const text = await response.text();
    const fallback: ChatEnvelope = {
      conclusion: `Modellkall feilet (${response.status}).`,
      basis: retrievedSources.length ? "Svar basert p\u00e5 lokale kilder." : "Ingen kilder funnet i prosjektet.",
      recommendations: [`Sjekk API-n\u00f8kkel/kvote. Respons: ${text || "ingen detaljer."}`],
      assumptions: ["Ingen modellrespons tilgjengelig."],
      draft_actions: [],
      missing_sources: missingSourcesFallback,
      sources: signedSources,
    };
    const rawText = JSON.stringify(fallback);
    await logToDb(supabase, threadId, projectId, user.id, "assistant", rawText, signedSources, signedSources, usedChunkIds);
    logInteraction({
      projectId,
      userId: user.id,
      role,
      prompt: message,
      retrievedSources,
      answer: rawText,
    });
    return NextResponse.json({ ok: false, error: "OPENAI_FAILED", response: fallback }, { status: 502 });
  }

  const json = (await response.json().catch(() => ({}))) as any;
  const rawContent = json?.choices?.[0]?.message?.content || "";
  const parsed = extractJson(rawContent) || {};

  const envelope: ChatEnvelope = {
    conclusion: String(parsed.conclusion || parsed.summary || "").trim() || "Ingen konklusjon mottatt.",
    basis: String(parsed.basis || parsed.sources || "").trim() || "Ingen kilder oppgitt.",
    recommendations: normalizeStringList(parsed.recommendations),
    assumptions: normalizeStringList(parsed.assumptions),
    draft_actions: normalizeDraftActions(parsed.draft_actions),
    missing_sources: normalizeMissingSources(parsed.missing_sources, missingSourcesFallback),
    sources: signedSources,
  };
  if (!hasSources) {
    envelope.basis = ensureNoSourceBasis(envelope.basis);
    if (!envelope.assumptions.length) {
      envelope.assumptions = ["Svar uten prosjektkilder."];
    }
  }

  const rawText = JSON.stringify(envelope);
  await logToDb(supabase, threadId, projectId, user.id, "assistant", rawText, signedSources, signedSources, usedChunkIds);
  logInteraction({
    projectId,
    userId: user.id,
    role,
    prompt: message,
    retrievedSources,
    answer: rawText,
  });

  return NextResponse.json({ ok: true, response: envelope }, { status: 200 });
}
