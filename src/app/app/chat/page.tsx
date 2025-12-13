"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, Search, Send, Plus, Trash2, BookOpen, Shield, History, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { v4 as uuid } from "uuid";
import { useSession } from "@/lib/session";

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
}

interface MemoryItem {
  id: string;
  text: string;
  createdAt: string;
}

interface RetrievedSource {
  id: string;
  projectId: string;
  title: string;
  reference: string;
  discipline: string;
  zone?: string;
  snippet: string;
  score: number;
}

function nowTime() {
  return new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
        "Konklusjon: Jeg lager en sjekkliste for mottakskontroll av vinduer. Grunnlag: prosjektrolle entreprenør, krav: TEK17 paragraf 13-4, interne krav (QA-04), siste logistikkplan. Anbefalinger: bekreft leverandør og type før jeg genererer sjekkliste.",
      timestamp: "12:04",
    },
  ],
};

export default function ChatPage() {
  const [projectId, setProjectId] = useState("demo-project");
  const [conversations, setConversations] = useState<Conversation[]>(defaultConversations);
  const [messagesByConversation, setMessagesByConversation] = useState<Record<string, ChatMessage[]>>(defaultMessages);
  const [activeConversationId, setActiveConversationId] = useState("1");
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [styleMode, setStyleMode] = useState<"kort" | "detaljert">("kort");
  const [withSources, setWithSources] = useState(true);
  const [memoryItems, setMemoryItems] = useState<MemoryItem[]>([]);
  const [newMemoryText, setNewMemoryText] = useState("");
  const [sourcesByConversation, setSourcesByConversation] = useState<Record<string, RetrievedSource[]>>({});
  const { user } = useSession();

  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const conv = loadFromStorage<Conversation[]>(`bob_conversations_${projectId}`, defaultConversations);
    const msgs = loadFromStorage<Record<string, ChatMessage[]>>(`bob_messages_${projectId}`, defaultMessages);
    const mem = loadFromStorage<MemoryItem[]>(`bob_memory_${projectId}`, []);
    setConversations(conv.length ? conv : defaultConversations);
    setMessagesByConversation(msgs);
    setActiveConversationId(conv[0]?.id || "1");
    setMemoryItems(mem);
  }, [projectId]);

  useEffect(() => {
    saveToStorage(`bob_conversations_${projectId}`, conversations);
  }, [conversations, projectId]);

  useEffect(() => {
    saveToStorage(`bob_messages_${projectId}`, messagesByConversation);
  }, [messagesByConversation, projectId]);

  useEffect(() => {
    saveToStorage(`bob_memory_${projectId}`, memoryItems);
  }, [memoryItems, projectId]);

  const messages = messagesByConversation[activeConversationId] || [];
  const activeSources = sourcesByConversation[activeConversationId] || [];

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");

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
        { id: botMsgId, author: "bob", content: "", timestamp: nowTime() },
      ],
    }));

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          projectId,
          style: styleMode,
          sources: withSources,
          memory: memoryItems,
          role: user?.role ?? "ukjent",
          userId: user?.id ?? "anonymous",
        }),
      });

      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !response.body || !contentType.includes("text/event-stream")) {
        const errorText = await response.text();
        throw new Error(
          `Chat API feilet (${response.status}). ${errorText?.length ? `Server sa: ${errorText}` : "Ingen respons fra server."}`
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let aggregated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (part.startsWith("data: ")) {
            const chunk = part.replace("data: ", "").trim();
            if (chunk.startsWith("SOURCES::")) {
              const json = chunk.replace("SOURCES::", "");
              try {
                const parsed = JSON.parse(json) as RetrievedSource[];
                setSourcesByConversation((prev) => ({
                  ...prev,
                  [activeConversationId]: parsed,
                }));
              } catch {
                // ignore malformed metadata
              }
              continue;
            }
            aggregated = aggregated ? `${aggregated}\n${chunk}` : chunk;
            setMessagesByConversation((prev) => ({
              ...prev,
              [activeConversationId]: (prev[activeConversationId] || []).map((m) =>
                m.id === botMsgId ? { ...m, content: aggregated, timestamp: nowTime() } : m
              ),
            }));
          }
        }
      }
    } catch (err: any) {
      setMessagesByConversation((prev) => ({
        ...prev,
        [activeConversationId]: (prev[activeConversationId] || []).map((m) =>
          m.id === botMsgId
            ? {
                ...m,
                content: `Kunne ikke hente svar nå. ${err?.message || "Ukjent feil."}`,
                timestamp: nowTime(),
              }
            : m
        ),
      }));
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
    <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr_320px] gap-4 min-h-[80vh]">
      {/* Sidebar */}
      <aside className="border border-border rounded-xl bg-card p-3 flex flex-col">
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
            <Input placeholder="Søk i samtaler..." className="pl-9 text-sm bg-background" />
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-auto space-y-1">
          {conversations.map((c) => {
            const active = c.id === activeConversationId;
            return (
              <div key={c.id} className="flex gap-1 items-center">
                <button
                  onClick={() => setActiveConversationId(c.id)}
                  className={`flex-1 text-left px-3 py-2 rounded-lg border transition-colors ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border hover:border-muted-foreground/50 bg-background"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium truncate">{c.title}</span>
                    <span className="text-xs opacity-70">{c.updatedAt}</span>
                  </div>
                  <p className={`text-xs mt-1 ${active ? "text-primary-foreground/80" : "text-muted-foreground"} `}>
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

      {/* Chat */}
      <section className="border border-border rounded-xl bg-card flex flex-col">
        <header className="border-b border-border p-4 flex flex-wrap gap-3 items-center justify-between">
          <div className="flex items-center gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Prosjekt</p>
              <div className="flex items-center gap-2">
                <Input
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value || "demo-project")}
                  className="w-48 bg-background"
                />
                <Badge variant="secondary">Chatmodus</Badge>
              </div>
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
              <Button
                size="sm"
                variant={withSources ? "default" : "outline"}
                onClick={() => setWithSources((v) => !v)}
              >
                {withSources ? "Med kilder" : "Uten kilder"}
              </Button>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Info className="h-4 w-4" />
            <span>BOB svarer med Konklusjon / Basis / Anbefalinger / Forutsetninger</span>
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] border-b border-border">
          <div className="flex-1 overflow-auto p-4 space-y-3 bg-muted">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`max-w-3xl rounded-lg px-4 py-3 border ${
                  m.author === "user"
                    ? "bg-card border-border ml-auto shadow-sm"
                    : "bg-muted/70 border-border text-foreground"
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">
                    {m.author === "user" ? "Du" : "BOB"}
                  </span>
                  <span className="text-xs text-muted-foreground">{m.timestamp}</span>
                </div>
                <p className="text-sm leading-relaxed whitespace-pre-line">{m.content}</p>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          <div className="border-l border-border bg-card/80 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-sm font-semibold">Kilder</p>
                <p className="text-xs text-muted-foreground">Prosjektisolert</p>
              </div>
              <Badge variant="outline" className="ml-auto text-[10px]">
                {activeSources.length} funnet
              </Badge>
            </div>
            {activeSources.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Ingen kilder mottatt ennå. Legg til dokumenter/IFC eller kontroller prosjekt-ID.
              </p>
            ) : (
              <div className="space-y-2">
                {activeSources.map((s, idx) => (
                  <div key={s.id} className="rounded border border-border bg-card/90 p-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px]">
                          Kilde {idx + 1}
                        </Badge>
                        <span className="text-xs font-semibold text-foreground">{s.title}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{s.discipline}</span>
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">{s.reference}</div>
                    <div className="text-xs text-foreground mt-1">{s.snippet}</div>
                    {s.zone && <div className="text-[10px] text-muted-foreground mt-1">Sone: {s.zone}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1">Score: {s.score.toFixed(2)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="border-t border-border p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Skriv til BOB..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  if (!isSending) handleSend();
                }
              }}
            />
            <Button type="button" disabled={!input.trim() || isSending} onClick={handleSend}>
              <Send className="h-4 w-4 mr-2" />
              {isSending ? "Sender..." : "Send"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            BOB foreslår neste steg og bruker prosjektets kontekst. Kilder vises når dokumenter er koblet på.
          </p>
        </footer>
      </section>

      {/* Memory panel */}
      <aside className="border border-border rounded-xl bg-card p-3 flex flex-col">
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
            <span>Prosjektisolert • Ingen deling mellom prosjekter</span>
          </div>
          <div className="text-[11px] text-muted-foreground">
            Rolle: {user?.role || "ukjent"} • Bruker: {user?.name || "ukjent"}
          </div>
        </div>
      </aside>
    </div>
  );
}
