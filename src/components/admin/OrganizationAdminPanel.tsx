"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/session";
import { useActiveProject } from "@/lib/active-project";

export type OrgRole = "member" | "org_admin";

type OrgMember = {
  userId: string;
  email: string;
  orgRole: OrgRole;
  addedAt?: string;
};

const ORG_ROLE_OPTIONS: { value: OrgRole; label: string }[] = [
  { value: "member", label: "Medlem" },
  { value: "org_admin", label: "Org-admin" },
];

export default function OrganizationAdminPanel() {
  const { accessToken } = useSession();
  const { organizations, orgMemberships, isPlatformAdmin } = useActiveProject();
  const [selectedOrgId, setSelectedOrgId] = useState("");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");

  const orgOptions = useMemo(() => {
    if (isPlatformAdmin) return organizations;
    const adminOrgIds = new Set(orgMemberships.filter((m) => m.orgRole === "org_admin").map((m) => m.orgId));
    return organizations.filter((org) => adminOrgIds.has(org.id));
  }, [isPlatformAdmin, organizations, orgMemberships]);

  useEffect(() => {
    if (!selectedOrgId && orgOptions.length > 0) {
      setSelectedOrgId(orgOptions[0].id);
    }
  }, [selectedOrgId, orgOptions]);

  const loadMembers = async (orgId: string) => {
    if (!accessToken || !orgId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/organization-members?orgId=${encodeURIComponent(orgId)}`, {
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
    if (!selectedOrgId) return;
    loadMembers(selectedOrgId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrgId, accessToken]);

  const handleAddMember = async () => {
    if (!email.trim()) {
      setError("E-post er p\u00e5krevd.");
      return;
    }
    if (!accessToken || !selectedOrgId) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/organization-members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ orgId: selectedOrgId, email: email.trim(), orgRole: role }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke legge til medlem.");
      }
      setEmail("");
      await loadMembers(selectedOrgId);
    } catch (err: any) {
      setError(err?.message || "Kunne ikke legge til medlem.");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMember = async (userId: string, nextRole: OrgRole) => {
    if (!accessToken || !selectedOrgId) return;
    try {
      const res = await fetch("/api/admin/organization-members", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ orgId: selectedOrgId, userId, orgRole: nextRole }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke oppdatere medlem.");
      }
      setMembers((prev) => prev.map((m) => (m.userId === userId ? { ...m, orgRole: nextRole } : m)));
    } catch (err: any) {
      setError(err?.message || "Kunne ikke oppdatere medlem.");
    }
  };

  const handleRemove = async (userId: string) => {
    if (!accessToken || !selectedOrgId) return;
    const confirmed = window.confirm("Fjern medlem fra organisasjonen?");
    if (!confirmed) return;
    try {
      const res = await fetch("/api/admin/organization-members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ orgId: selectedOrgId, userId }),
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
        <CardTitle>Organization Admin</CardTitle>
        <CardDescription>Administrer brukere og roller per organisasjon.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {orgOptions.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Du har ingen organisasjoner som kan administreres. Kontakt en plattformadmin.
          </p>
        )}

        {orgOptions.length > 0 && (
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr]">
            <div className="space-y-2">
              <label className="text-sm font-medium">Organisasjon</label>
              <Select value={selectedOrgId} onValueChange={setSelectedOrgId}>
                <SelectTrigger>
                  <SelectValue placeholder="Velg organisasjon" />
                </SelectTrigger>
                <SelectContent>
                  {orgOptions.map((org) => (
                    <SelectItem key={org.id} value={org.id}>
                      {org.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button variant="outline" onClick={() => loadMembers(selectedOrgId)} disabled={loading}>
                Oppdater
              </Button>
            </div>
          </div>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        {selectedOrgId && (
          <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_auto] items-end">
            <div>
              <label className="text-sm font-medium">E-post</label>
              <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="navn@firma.no" />
            </div>
            <div>
              <label className="text-sm font-medium">Rolle</label>
              <Select value={role} onValueChange={(value) => setRole(value as OrgRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ORG_ROLE_OPTIONS.map((opt) => (
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
        )}

        {selectedOrgId && (
          <div className="space-y-2">
            {loading && <p className="text-sm text-muted-foreground">Laster medlemmer...</p>}
            {!loading && members.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Ingen medlemmer registrert enn{"\u00e5"}.
              </p>
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
                <div className="flex flex-wrap items-center gap-2">
                  <Select
                    value={member.orgRole}
                    onValueChange={(value) => handleUpdateMember(member.userId, value as OrgRole)}
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORG_ROLE_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Badge variant="outline">{member.orgRole}</Badge>
                  <Button variant="ghost" size="sm" onClick={() => handleRemove(member.userId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
