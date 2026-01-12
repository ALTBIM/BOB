"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus } from "lucide-react";
import { useSession } from "@/lib/session";
import type { ProjectRole } from "@/lib/database";

type AccessLevel = "read" | "write" | "admin";

type MemberRow = {
  userId: string;
  email: string;
  role: ProjectRole;
  accessLevel: AccessLevel;
  addedAt?: string;
};

const ROLE_OPTIONS: { value: ProjectRole; label: string }[] = [
  { value: "byggherre", label: "Byggherre" },
  { value: "prosjektleder", label: "Prosjektleder" },
  { value: "bas_byggeledelse", label: "BAS / Byggeledelse" },
  { value: "prosjekterende_ark", label: "Prosjekterende (ARK)" },
  { value: "prosjekterende_rib", label: "Prosjekterende (RIB)" },
  { value: "prosjekterende_riv", label: "Prosjekterende (RIV)" },
  { value: "prosjekterende_rie", label: "Prosjekterende (RIE)" },
  { value: "leverandor_logistikk", label: "Leverand\u00f8r / Logistikk" },
  { value: "kvalitet_hms", label: "Kvalitet / HMS" },
];

const ACCESS_OPTIONS: { value: AccessLevel; label: string }[] = [
  { value: "read", label: "Les" },
  { value: "write", label: "Skriv" },
  { value: "admin", label: "Admin" },
];

export default function ProjectMembersPanel({ projectId }: { projectId: string }) {
  const { accessToken } = useSession();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("byggherre");
  const [accessLevel, setAccessLevel] = useState<AccessLevel>("read");
  const [saving, setSaving] = useState(false);

  const loadMembers = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/project-members?projectId=${encodeURIComponent(projectId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke hente medlemmer.");
      }
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err: any) {
      setError(err?.message || "Kunne ikke hente medlemmer.");
      setMembers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, accessToken]);

  const handleAddMember = async () => {
    if (!email.trim()) {
      setError("E-post er p\u00e5krevd.");
      return;
    }
    if (!accessToken) {
      setError("Mangler p\u00e5logging.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/project-members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId, email: email.trim(), role, accessLevel }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke legge til medlem.");
      }
      setEmail("");
      await loadMembers();
    } catch (err: any) {
      setError(err?.message || "Kunne ikke legge til medlem.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMember = async (userId: string, nextRole: ProjectRole, nextAccess: AccessLevel) => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/admin/project-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId, userId, role: nextRole, accessLevel: nextAccess }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke oppdatere medlem.");
      }
      setMembers((prev) =>
        prev.map((m) => (m.userId === userId ? { ...m, role: nextRole, accessLevel: nextAccess } : m))
      );
    } catch (err: any) {
      setError(err?.message || "Kunne ikke oppdatere medlem.");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!accessToken) return;
    const confirmed = window.confirm("Fjern medlem fra prosjektet?");
    if (!confirmed) return;
    try {
      const res = await fetch("/api/admin/project-members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId, userId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke fjerne medlem.");
      }
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
    } catch (err: any) {
      setError(err?.message || "Kunne ikke fjerne medlem.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Prosjektmedlemmer</CardTitle>
            <CardDescription>Legg til, endre og fjern tilgang.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadMembers} disabled={loading}>
            Oppdater
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_auto] items-end">
          <div>
            <label className="text-sm font-medium">E-post</label>
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@firma.no" />
          </div>
          <div>
            <label className="text-sm font-medium">Rolle</label>
            <Select value={role} onValueChange={(value) => setRole(value as ProjectRole)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium">Tilgang</label>
            <Select value={accessLevel} onValueChange={(value) => setAccessLevel(value as AccessLevel)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCESS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddMember} disabled={saving}>
            <UserPlus className="mr-2 h-4 w-4" />
            Legg til
          </Button>
        </div>

        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Laster medlemmer...</p>}
          {!loading && members.length === 0 && (
            <p className="text-sm text-muted-foreground">Ingen medlemmer registrert enn\u00e5.</p>
          )}
          {members.map((member) => (
            <div
              key={member.userId}
              className="flex flex-col gap-3 rounded-md border border-border/70 p-3 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="font-medium">{member.email || member.userId}</div>
                {member.addedAt && (
                  <div className="text-xs text-muted-foreground">
                    Lagt til {new Date(member.addedAt).toLocaleString("nb-NO")}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-2 items-center">
                <Select
                  value={member.role}
                  onValueChange={(value) => handleUpdateMember(member.userId, value as ProjectRole, member.accessLevel)}
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROLE_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={member.accessLevel}
                  onValueChange={(value) => handleUpdateMember(member.userId, member.role, value as AccessLevel)}
                >
                  <SelectTrigger className="w-[120px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Badge variant="outline">{member.accessLevel}</Badge>
                <Button variant="ghost" size="sm" onClick={() => handleRemove(member.userId)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
