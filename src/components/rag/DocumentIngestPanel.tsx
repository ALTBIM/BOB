"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Upload } from "lucide-react";

type Props = {
  projectId: string;
};

export function DocumentIngestPanel({ projectId }: Props) {
  const [title, setTitle] = useState("");
  const [discipline, setDiscipline] = useState("generelt");
  const [reference, setReference] = useState("");
  const [text, setText] = useState("");
  const [banner, setBanner] = useState<{ type: "info" | "error"; text: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = async (file: File) => {
    // Kun tekstfiler inntil vi har PDF-parsing
    if (!file.type.includes("text") && !file.name.toLowerCase().endsWith(".txt")) {
      setBanner({ type: "error", text: "Bare tekstfiler støttes her nå. PDF-parsing kommer senere." });
      return;
    }
    const content = await file.text();
    setText(content);
    if (!title) setTitle(file.name.replace(/\.[^/.]+$/, ""));
    if (!reference) setReference(file.name);
    setBanner({ type: "info", text: "Tekst hentet fra fil. Du kan redigere før lagring." });
  };

  const handleSubmit = async () => {
    if (!title.trim() || !reference.trim() || !text.trim()) {
      setBanner({ type: "error", text: "Tittel, referanse og tekst må fylles ut." });
      return;
    }
    setIsUploading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/rag/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          title: title.trim(),
          discipline,
          reference: reference.trim(),
          text,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Ukjent feil");
      }
      setBanner({ type: "info", text: "Dokument lagret i prosjektets RAG-kilder." });
      setText("");
      setTitle("");
      setReference("");
    } catch (err: any) {
      setBanner({ type: "error", text: `Kunne ikke lagre: ${err?.message || "ukjent feil"}` });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Legg til prosjektkilder</CardTitle>
        <CardDescription>Last opp tekstbaserte dokumenter til RAG (prosjektisolert).</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {banner && (
          <Alert variant={banner.type === "error" ? "destructive" : "default"}>
            <AlertDescription>{banner.text}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-col gap-2">
          <Input
            type="file"
            accept=".txt,.md,.csv"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <p className="text-xs text-muted-foreground">
            PDF-parsing kommer senere; last opp tekstfiler nå. Prosjekt: {projectId}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tittel</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Dokumenttittel" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Disiplin</label>
            <Select value={discipline} onValueChange={setDiscipline}>
              <SelectTrigger>
                <SelectValue placeholder="Velg disiplin" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="generelt">Generelt</SelectItem>
                <SelectItem value="ark">ARK</SelectItem>
                <SelectItem value="rib">RIB</SelectItem>
                <SelectItem value="riv">RIV</SelectItem>
                <SelectItem value="rie">RIE</SelectItem>
                <SelectItem value="logistikk">Logistikk</SelectItem>
                <SelectItem value="krav">Krav</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Referanse</label>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="f.eks. TEK17 kap 11" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Prosjekt</label>
            <Input value={projectId} disabled />
          </div>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">Tekstinnhold</label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={8}
            placeholder="Lim inn tekst fra dokumentet..."
          />
        </div>
        <Button onClick={handleSubmit} disabled={isUploading}>
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
          Lagre til prosjekt
        </Button>
      </CardContent>
    </Card>
  );
}
