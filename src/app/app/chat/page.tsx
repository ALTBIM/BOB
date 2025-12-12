"use client";

import { useMemo, useState } from "react";
import { MessageCircle, Search, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Conversation = {
  id: string;
  title: string;
  updatedAt: string;
};

type ChatMessage = {
  id: string;
  author: "user" | "bob";
  content: string;
  timestamp: string;
};

const demoConversations: Conversation[] = [
  { id: "1", title: "Kravkontroll – TEK17", updatedAt: "12:03" },
  { id: "2", title: "Mengder for 3.etg", updatedAt: "11:40" },
  { id: "3", title: "Sjekk logistikkplan", updatedAt: "08:15" },
];

const demoMessages: ChatMessage[] = [
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
      "Konklusjon: Jeg lager en sjekkliste for mottakskontroll av vinduer. Grunnlag: prosjektrolle entreprenør, krav: TEK17 §13-4, interne krav (QA-04), siste logistikkplan. Anbefalinger: bekreft leverandør og type før jeg genererer sjekkliste.",
    timestamp: "12:04",
  },
  {
    id: "m3",
    author: "bob",
    content:
      "Forslag til neste steg: 1) Bekreft vindustype/leverandør. 2) Jeg genererer sjekkliste med kilder. 3) Opprett avvikslogg hvis noe mangler.",
    timestamp: "12:04",
  },
];

export default function ChatPage() {
  const [activeConversationId, setActiveConversationId] = useState("1");
  const [input, setInput] = useState("");

  const messages = useMemo(() => demoMessages, []);
  const conversations = useMemo(() => demoConversations, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 min-h-[80vh]">
      <aside className="border border-slate-200 rounded-xl bg-white p-3 flex flex-col">
        <div className="flex items-center gap-2 px-2 py-1">
          <MessageCircle className="h-5 w-5 text-slate-600" />
          <div>
            <p className="text-sm font-semibold text-slate-900">Samtaler</p>
            <p className="text-xs text-slate-500">Per prosjekt</p>
          </div>
        </div>

        <div className="mt-3">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Søk i samtaler..."
              className="pl-9 text-sm"
            />
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-auto space-y-1">
          {conversations.map((c) => {
            const active = c.id === activeConversationId;
            return (
              <button
                key={c.id}
                onClick={() => setActiveConversationId(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg border ${
                  active ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium truncate">{c.title}</span>
                  <span className="text-xs opacity-70">{c.updatedAt}</span>
                </div>
                <p className={`text-xs mt-1 ${active ? "text-slate-200" : "text-slate-500"} `}>
                  Historikk og kilder
                </p>
              </button>
            );
          })}
        </div>

        <Button className="mt-3 w-full" variant="outline">
          Ny samtale
        </Button>
      </aside>

      <section className="border border-slate-200 rounded-xl bg-white flex flex-col">
        <header className="border-b border-slate-200 p-4 flex flex-wrap gap-3 items-center justify-between">
          <div>
            <p className="text-sm text-slate-500">Prosjekt</p>
            <p className="text-base font-semibold text-slate-900">Demoprosjekt A</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Chatmodus</Badge>
            <Badge>Kort</Badge>
            <Badge variant="outline">Med kilder</Badge>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-4 space-y-3 bg-slate-50">
          {messages.map((m) => (
            <div
              key={m.id}
              className={`max-w-3xl rounded-lg px-4 py-3 ${
                m.author === "user"
                  ? "bg-white border border-slate-200 ml-auto shadow-sm"
                  : "bg-slate-900 text-white"
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs uppercase tracking-wide opacity-70">
                  {m.author === "user" ? "Du" : "BOB"}
                </span>
                <span className="text-xs opacity-60">{m.timestamp}</span>
              </div>
              <p className="text-sm leading-relaxed">{m.content}</p>
            </div>
          ))}
        </div>

        <footer className="border-t border-slate-200 p-4">
          <div className="flex items-center gap-2">
            <Input
              placeholder="Skriv til BOB..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
            />
            <Button type="button" disabled={!input.trim()}>
              <Send className="h-4 w-4 mr-2" />
              Send
            </Button>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            BOB foreslår neste steg og bruker prosjektets kontekst. Kilder vises når dokumenter er koblet på.
          </p>
        </footer>
      </section>
    </div>
  );
}
