"use client";

import { useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Search,
  Send,
  Plus,
  Trash2,
  BookOpen,
  Shield,
  History,
  Info,
  AlertCircle,
  Paperclip,
  FileSearch,
  Sparkles,
  Check,
  ChevronDown,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { v4 as uuid } from "uuid";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";
import LoginForm from "@/components/auth/LoginForm";

interface Conversation {
  id: string;
  title: string;
  updatedAt: string;
}

interface ChatMessage {
  id: string;
  author: "user" | "bob";
  content: string;
  timestamp: string;
  response?: ChatResponse;
}

interface MemoryItem {
  id: string;
  text: string;
  createdAt: string;
}

interface ChatSource {
  id: string;
  projectId: string;
  title: string;
  reference: string;
  discipline: string;
  zone?: string;
  snippet: string;
  score: number;
  url?: string | null;
}

interface DraftAction {
  title: string;
  description?: string;
  type?: string;
  payload?: Record<string, unknown>;
}

interface MissingSource {
  type: string;
  description: string;
}

interface ChatResponse {
  conclusion: string;
  basis: string;
  recommendations: string[];
  assumptions: string[];
  draft_actions: DraftAction[];
  missing_sources: MissingSource[];
  sources: ChatSource[];
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function normalizeList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === "string") return value.split(/\n|;|â€¢|-/).map((v) => v.trim()).filter(Boolean);
  return [];
}

function loadFromStorage<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore
  }
}

type StreamDonePayload = {
  ok?: boolean;
  response?: ChatResponse;
  error?: string;
};

async function readEventStream(
  response: Response,
  handlers: {
    onDelta: (text: string) => void;
    onDone: (payload: StreamDonePayload) => void;
    onError: (message: string) => void;
  }
) {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Ingen stream-respons fra server.");
  }
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx = buffer.indexOf("\n\n");
    while (idx !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const lines = chunk.split("\n");
      let event = "message";
      const dataLines: string[] = [];
      for (const line of lines) {
        if (line.startsWith("event:")) {
          event = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          dataLines.push(line.slice(5).trim());
        }
      }
      if (!dataLines.length) {
        idx = buffer.indexOf("\n\n");
        continue;
      }
      const raw = dataLines.join("");
      let payload: any = raw;
      try {
        payload = JSON.parse(raw);
      } catch {
        // ignore
      }
      if (event === "delta") {
        handlers.onDelta(String(payload?.text || ""));
      } else if (event === "done") {
        handlers.onDone(payload || {});
      } else if (event === "error") {
        handlers.onError(String(payload?.error || "Ukjent feil."));
      }
      idx = buffer.indexOf("\n\n");
    }
  }
}

const defaultConversations: Conversation[] = [{ id: "1", title: "Kravkontroll - TEK17", updatedAt: "12:03" }];

const defaultMessages: Record<string, ChatMessage[]> = {
  "1": [
    {
      id: "m1",
      author: "user",
      content: "Lag en sjekkliste for mottakskontroll av vinduer.",
      timestamp: "12:03",
    },
    {
      id: "m2",
      author: "bob",
      content:
        "Konklusjon: Jeg lager en sjekkliste for mottakskontroll av vinduer. Grunnlag: prosjektrolle entrepren\u00f8r, krav: TEK17 paragraf 13-4, interne krav (QA-04), siste logistikkplan. Anbefalinger: bekreft leverand\u00f8r og type f\u00f8r jeg genererer sjekkliste.",
      timestamp: "12:04",
    },
  ],
};

export default function ChatPage() {
  const [conversations, setConversations] = useState<Conversation[]>(defaultConversations);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>(defaultMessages);
  const [activeConversationId, setActiveConversationId] = useState("1");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [styleMode, setStyleMode] = useState<"kort" | "detaljert">("kort");
  const [mode, setMode] = useState<"qa" | "summarize" | "actions" | "search">("qa");
  const [withSources, setWithSources] = useState(true);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [chatError, setChatError] = useState<string | null>(null);
  const { user, accessToken, ready } = useSession();
  const { activeProjectId, activeProject, activeRole, activeAccessLevel } = useActiveProject();
  const [showSourcesPanel, setShowSourcesPanel] = useState(true);

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!activeProjectId) return;
    const conv = loadFromStorage<Conversation[]>(`bob_conversations_${activeProjectId}`, defaultConversations);
    const msgs = loadFromStorage<Record<string, ChatMessage[]>>(
      `bob_messages_${activeProjectId}`,
      defaultMessages
    );
    const mem = loadFromStorage<MemoryItem[]>(`bob_memory_${activeProjectId}`, []);
    setConversations(conv.length ? conv : defaultConversations);
    setMessagesByConversation(msgs);
    setActiveConversationId(conv[0]?.id || "1");
    setMemoryItems(mem);
  }, [activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    saveToStorage(`bob_conversations_${activeProjectId}`, conversations);
  }, [conversations, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    saveToStorage(`bob_messages_${activeProjectId}`, messagesByConversation);
  }, [messagesByConversation, activeProjectId]);

  useEffect(() => {
    if (!activeProjectId) return;
    saveToStorage(`bob_memory_${activeProjectId}`, memoryItems);
  }, [memoryItems, activeProjectId]);

  const messages = messagesByConversation[activeConversationId] || [];
  const latestResponse = [...messages].reverse().find((m) => m.author === "bob" && m.response)?.response;
  const activeSources = latestResponse?.sources || [];
  const activeDrafts = latestResponse?.draft_actions || [];
  const activeMissingSources = latestResponse?.missing_sources || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-sm text-muted-foreground">Laster...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

      const quickPrompts = [
    { label: "Oppsummer dokument", text: "Oppsummer de viktigste kravene i siste dokument." },
    { label: "Finn krav", text: "Hvilke krav gjelder for brann og r\u00f8mningsveier i dette prosjektet?" },
    { label: "Lag sjekkliste", text: "Lag en sjekkliste for mottakskontroll av vinduer basert p\u00e5 prosjektkrav." },
    { label: "Finn risikoer", text: "Hvilke topp 5 risikoer ser du n\u00e5 basert p\u00e5 prosjektdata?" },
    { label: "Foresl\u00e5 m\u00f8te", text: "Foresl\u00e5 et m\u00f8te med agenda for \u00e5 l\u00f8se \u00e5pne avvik i prosjektet." },
    { label: "S\u00f8k i fremdriftsplan", text: "Finn milep\u00e6ler og oppgaver den neste m\u00e5neden." },
  ];

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    if (!activeProjectId) {
      setChatError("Velg et prosjekt f\u00f8r du sender melding.");
      return;
    }
    if (!accessToken) {
      setChatError("Mangler p\u00e5logging. Logg inn p\u00e5 nytt.");
      return;
    }
    const canWrite = activeAccessLevel === "write" || activeAccessLevel === "admin";
    if (!canWrite) {
      setChatError("Du har kun lesetilgang i dette prosjektet. Be en admin om skrive-tilgang.");
      return;
    }
    setInput("");
    setChatError(null);

    const userMsg: ChatMessage = {
      id: uuid(),
      author: "user",
      content: text,
      timestamp: nowTime(),
    };

    setMessagesByConversation((prev) => ({
      ...prev,
      [activeConversationId]: [...(prev[activeConversationId] || []), userMsg],
    }));

    setIsSending(true);
    const botMsgId = uuid();
    setMessagesByConversation((prev) => ({
      ...prev,
      [activeConversationId]: [
        ...(prev[activeConversationId] || []),
        { id: botMsgId, author: "bob", content: "BOB tenker...", timestamp: nowTime() },
      ],
    }));

    const conversationId = activeConversationId;
    const updateBotMessage = (patch: Partial<ChatMessage>) => {
      setMessagesByConversation((prev) => ({
        ...prev,
        [conversationId]: (prev[conversationId] || []).map((m) => (m.id === botMsgId ? { ...m, ...patch } : m)),
      }));
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message: text,
          projectId: activeProjectId,
          style: styleMode,
          mode,
          sources: withSources,
          memory: memoryItems,
          stream: true,
        }),
      });

      const isEventStream = response.headers.get("content-type")?.includes("text/event-stream");
      if (!isEventStream) {
        const data = (await response.json().catch(() => ({}))) as { response?: ChatResponse; error?: string };
        if (!response.ok) {
          setChatError(data?.error || `Chat API feilet (${response.status}).`);
        }
        if (!data?.response) {
          throw new Error(data?.error || "Ingen gyldig respons fra server.");
        }

        const payload = data.response;
        updateBotMessage({
          content: payload.conclusion || "Ingen konklusjon mottatt.",
          timestamp: nowTime(),
          response: {
            ...payload,
            recommendations: normalizeList(payload.recommendations),
            assumptions: normalizeList(payload.assumptions),
          },
        });
        return;
      }

      let streamedText = "";
      await readEventStream(response, {
        onDelta: (delta) => {
          if (!delta) return;
          streamedText += delta;
          updateBotMessage({ content: streamedText });
        },
        onDone: (payload) => {
          if (!payload?.response) {
            if (payload?.error) {
              setChatError(payload.error);
            }
            updateBotMessage({
              content: streamedText || "Ingen konklusjon mottatt.",
              timestamp: nowTime(),
            });
            return;
          }
          const normalized = {
            ...payload.response,
            recommendations: normalizeList(payload.response.recommendations),
            assumptions: normalizeList(payload.response.assumptions),
          };
          updateBotMessage({
            content: normalized.conclusion || "Ingen konklusjon mottatt.",
            timestamp: nowTime(),
            response: normalized,
          });
        },
        onError: (message) => {
          setChatError(message);
        },
      });
    } catch (err: any) {
      updateBotMessage({
        content: `Kunne ikke hente svar n\u00e5. ${err?.message || "Ukjent feil."}`,
        timestamp: nowTime(),
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleNewConversation = () => {
    const id = uuid();
    const title = `Samtale ${conversations.length + 1}`;
    const updatedAt = nowTime();
    const newConv: Conversation = { id, title, updatedAt };
    setConversations((prev) => [...prev, newConv]);
    setMessagesByConversation((prev) => ({ ...prev, [id]: [] }));
    setActiveConversationId(id);
  };

  const handleDeleteConversation = (id: string) => {
    setConversations((prev) => prev.filter((c) => c.id !== id));
    setMessagesByConversation((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
    if (activeConversationId === id && conversations.length > 1) {
      const next = conversations.find((c) => c.id !== id);
      if (next) setActiveConversationId(next.id);
    }
  };

  const handleAddMemory = () => {
    const text = newMemoryText.trim();
    if (!text) return;
    const item: MemoryItem = { id: uuid(), text, createdAt: new Date().toISOString() };
    setMemoryItems((prev) => [item, ...prev]);
    setNewMemoryText("");
  };

  const handleDeleteMemory = (id: string) => {
    setMemoryItems((prev) => prev.filter((m) => m.id !== id));
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_320px] gap-5 min-h-[80vh]">
      <aside className="border border-border/60 rounded-xl bg-card/80 p-3 flex flex-col">
        <div className="flex items-center gap-2 px-2 py-1">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold">Samtaler</p>
            <p className="text-xs text-muted-foreground">Per prosjekt</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="S\u00f8k i samtaler..." className="pl-9 text-sm bg-background/80" />
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-auto space-y-1.5">
          {conversations.map((c) => {
            const active = c.id === activeConversationId;
            return (
              <div key={c.id} className="flex gap-1 items-center">
                <button
                  onClick={() => setActiveConversationId(c.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg border transition-colors ${
                    active
                      ? "border-primary/70 bg-primary/10 text-foreground"
                      : "border-border/60 hover:border-border bg-background/70"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{c.title}</span>
                    <span className="text-xs opacity-70">{c.updatedAt}</span>
                  </div>
                  <p className={`text-xs mt-1 ${active ? "text-muted-foreground" : "text-muted-foreground"} `}>
                    Historikk og kilder
                  </p>
                </button>
                {conversations.length > 1 && (
                  <button
                    className="p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDeleteConversation(c.id)}
                    aria-label="Slett samtale"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <Button className="mt-3 w-full" variant="outline" onClick={handleNewConversation}>
          <Plus className="h-4 w-4 mr-2" /> Ny samtale
        </Button>
      </aside>

      <section className="border border-border/60 rounded-xl bg-card/80 flex flex-col overflow-hidden">
        <header className="border-b border-border/50 p-4 flex flex-wrap gap-3 items-center justify-between bg-background/80">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Prosjekt</p>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {activeProject ? activeProject.name : "Ingen prosjekt valgt"}
                </Badge>
                {activeRole && <Badge variant="outline">{activeRole}</Badge>}
                {activeAccessLevel && <Badge variant="outline">{activeAccessLevel}</Badge>}
              </div>
              {!activeProjectId && (
                <p className="text-xs text-muted-foreground mt-1">
                  Velg prosjekt i sidemenyen for å starte chatten.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={styleMode === "kort" ? "default" : "outline"}
                onClick={() => setStyleMode("kort")}
              >
                Kort
              </Button>
              <Button
                size="sm"
                variant={styleMode === "detaljert" ? "default" : "outline"}
                onClick={() => setStyleMode("detaljert")}
              >
                Detaljert
              </Button>
              <Button size="sm" variant={withSources ? "default" : "outline"} onClick={() => setWithSources((v) => !v)}>
                {withSources ? "Med kilder" : "Uten kilder"}
              </Button>
              <select
                className="text-sm border border-border rounded-md bg-background px-3 py-1.5"
                value={mode}
                onChange={(e) => setMode(e.target.value as any)}
              >
                <option value="qa">Q&A</option>
                <option value="summarize">Oppsummer</option>
                <option value="actions">Handlinger</option>
                <option value="search">S\u00f8k</option>
              </select>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>BOB svarer med Konklusjon / Basis / Anbefalinger / Forutsetninger</span>
          </div>
        </header>
        {chatError && (
          <div className="border-b border-border/50 bg-muted/50 px-4 py-2 text-sm text-destructive">
            {chatError}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] border-b border-border/50">
          <div className="flex-1 overflow-auto p-4 space-y-3 bg-background">
            {!activeProjectId && (
              <div className="border border-dashed border-border/70 rounded-lg p-4 bg-muted/40 text-sm text-muted-foreground flex items-center gap-3">
                <AlertCircle className="h-4 w-4 text-amber-500" />
                <div>
                  <p className="font-medium text-foreground">Velg prosjekt for å starte chatten</p>
                  <p className="text-xs text-muted-foreground">Prosjektkontekst kreves for å aktivere input.</p>
                </div>
              </div>
            )}
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-3xl rounded-lg px-4 py-3 border ${
                  m.author === "user"
                    ? "bg-card/90 border-border/60 ml-auto"
                    : "bg-muted/40 border-border/50 text-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {m.author === "user" ? "Du" : "BOB"}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.timestamp}</span>
                </div>
                {m.author === "bob" && m.response ? (
                  <div className="space-y-4 text-sm leading-relaxed">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Konklusjon</p>
                      <p className="mt-1 whitespace-pre-line">{m.response.conclusion || "Ingen konklusjon."}</p>
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Basis / Kilder</p>
                      {m.response.basis ? (
                        <p className="mt-1 whitespace-pre-line">{m.response.basis}</p>
                      ) : (
                        <div className="mt-1 text-muted-foreground text-xs">
                          Fant ingen kilder i prosjektet som stÃ¸tter dette.
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <Button size="sm" variant="outline">
                              <Paperclip className="h-3 w-3 mr-1.5" /> Last opp dokument
                            </Button>
                            <Button size="sm" variant="outline">
                              <FileSearch className="h-3 w-3 mr-1.5" /> Importer fremdriftsplan
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Anbefalinger</p>
                      {m.response.recommendations?.length ? (
                        <ul className="mt-1 list-disc pl-4 space-y-1">
                          {m.response.recommendations.map((rec, idx) => (
                            <li key={`${m.id}-rec-${idx}`}>{rec}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-muted-foreground">Ingen anbefalinger oppgitt.</p>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Forutsetninger</p>
                      {m.response.assumptions?.length ? (
                        <ul className="mt-1 list-disc pl-4 space-y-1">
                          {m.response.assumptions.map((assumption, idx) => (
                            <li key={`${m.id}-ass-${idx}`}>{assumption}</li>
                          ))}
                        </ul>
                      ) : (
                        <p className="mt-1 text-muted-foreground">Ingen forutsetninger oppgitt.</p>
                      )}
                    </div>
                    {m.response.draft_actions?.length ? (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Utkast til handlinger</p>
                        <div className="mt-2 grid grid-cols-1 gap-2">
                          {m.response.draft_actions.map((draft, idx) => (
                            <div key={`${m.id}-draft-${idx}`} className="border border-border/60 rounded-lg p-3 bg-card/80">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-sm font-medium">{draft.title}</p>
                                  {draft.description && (
                                    <p className="text-xs text-muted-foreground mt-1">{draft.description}</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 mt-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setChatError("Kladdehandlinger mÃ¥ bekreftes senere (ikke aktivert enda).")}
                                >
                                  <Check className="h-3 w-3 mr-1.5" /> Opprett
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setChatError("Redigering av kladde er ikke aktivert enda.")}
                                >
                                  <Sparkles className="h-3 w-3 mr-1.5" /> Rediger
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {m.response.missing_sources?.length ? (
                      <div>
                        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Manglende kilder</p>
                        <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1 mt-1">
                          {m.response.missing_sources.map((ms, idx) => (
                            <li key={`${m.id}-miss-${idx}`}>
                              <span className="font-medium">{ms.type}:</span> {ms.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-line">{m.content}</p>
                )}
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-l border-border/50 bg-muted/30 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Kilder & Data</p>
                <p className="text-xs text-muted-foreground">Prosjektisolert</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto px-2"
                onClick={() => setShowSourcesPanel((v) => !v)}
              >
                <ChevronDown className={`h-4 w-4 transition-transform ${showSourcesPanel ? "rotate-0" : "-rotate-90"}`} />
              </Button>
              <Badge variant="outline" className="text-[10px]">
                {activeSources.length} funnet
              </Badge>
            </div>
            {showSourcesPanel && (
              <>
                {activeSources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Ingen kilder mottatt ennÃ¥. Legg til dokumenter/IFC eller kontroller prosjekt-ID.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {activeSources.map((s, idx) => (
                      <div key={s.id} className="rounded border border-border/60 bg-card/90 p-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="text-[10px]">
                              Kilde {idx + 1}
                            </Badge>
                            <span className="text-xs font-semibold text-foreground">{s.title}</span>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{s.discipline}</span>
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-1">
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer" className="underline">
                              {s.reference}
                            </a>
                          ) : (
                            s.reference
                          )}
                        </div>
                        <div className="text-xs text-foreground mt-1">{s.snippet}</div>
                        {s.zone && <div className="text-[10px] text-muted-foreground mt-1">Sone: {s.zone}</div>}
                        <div className="text-[10px] text-muted-foreground mt-1">Score: {s.score.toFixed(2)}</div>
                      </div>
                    ))}
                  </div>
                )}

                {activeDrafts.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold">Forslag til tiltak</p>
                    {activeDrafts.map((draft, idx) => (
                      <div key={`${draft.title}-${idx}`} className="rounded border border-border/60 bg-card/90 p-2">
                        <div className="text-sm font-medium">{draft.title}</div>
                        {draft.description && <div className="text-xs text-muted-foreground mt-1">{draft.description}</div>}
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => setChatError("Kladdehandlinger er ikke aktivert ennÃ¥.")}
                        >
                          Opprett
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {activeMissingSources.length > 0 && (
                  <div className="mt-4 space-y-2">
                    <p className="text-sm font-semibold">Manglende kilder</p>
                    <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-1">
                      {activeMissingSources.map((m, idx) => (
                        <li key={`${m.type}-${idx}`}>
                          <span className="font-medium">{m.type}:</span> {m.description}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        <footer className="border-t border-border/50 p-4 bg-background/80">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Skriv til BOB..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 bg-background/90"
              disabled={!activeProjectId || !accessToken || !(activeAccessLevel === "write" || activeAccessLevel === "admin")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSending) handleSend();
                }
              }}
            />
            <Button
              type="button"
              disabled={
                !input.trim() ||
                isSending ||
                !activeProjectId ||
                !accessToken ||
                !(activeAccessLevel === "write" || activeAccessLevel === "admin")
              }
              onClick={handleSend}
            >
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Sender..." : "Send"}
            </Button>
          </div>
          {!activeProjectId && (
            <p className="text-xs text-muted-foreground mt-2">
              Velg prosjekt i sidemenyen f\u00f8r du starter chatten.
            </p>
          )}
          {activeProjectId && !(activeAccessLevel === "write" || activeAccessLevel === "admin") && (
            <p className="text-xs text-muted-foreground mt-2">
              Du har kun lesetilgang i dette prosjektet. Be en admin om skrive-tilgang for \u00e5 sende meldinger.
            </p>
          )}
          <p className="text-xs text-muted-foreground mt-2">
            BOB foresl\u00e5r neste steg og bruker prosjektets kontekst. Kilder vises n\u00e5r dokumenter er koblet p\u00e5.
          </p>
        </footer>
      </section>

      <aside className="border border-border/60 rounded-xl bg-card/80 p-3 flex flex-col">
        <div className="flex items-center gap-2 mb-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">BOB husker (prosjekt)</p>
        </div>
        <div className="space-y-2 overflow-auto flex-1">
          {memoryItems.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Ingen kontekst enda. Legg til viktige fakta, krav eller antakelser.
            </p>
          )}
          {memoryItems.map((m) => (
            <div key={m.id} className="border border-border rounded-lg p-2 text-sm flex justify-between gap-2">
              <span className="text-foreground whitespace-pre-line">{m.text}</span>
              <button
                className="text-muted-foreground hover:text-red-500"
                onClick={() => handleDeleteMemory(m.id)}
                aria-label="Slett kontekst"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <Input
            placeholder="Legg til kontekst/krav for prosjektet"
            value={newMemoryText}
            onChange={(e) => setNewMemoryText(e.target.value)}
          />
          <Button className="w-full" variant="outline" onClick={handleAddMemory} disabled={!newMemoryText.trim()}>
            Lagre kontekst
          </Button>
        </div>
        <div className="mt-4 border-t border-border pt-3 space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Shield className="h-4 w-4" />
            <span>Prosjektisolert -> Ingen deling mellom prosjekter</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Rolle: {activeRole || "ukjent"} \u2192 Tilgang: {activeAccessLevel || "ukjent"} \u2192 Bruker:{" "}
            {user?.email || "ukjent"}
          </div>
        </div>
      </aside>
    </div>
  );
}











