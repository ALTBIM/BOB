"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Trash2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSession } from "@/lib/session";

type AdminRow = {
  userId: string;
  email: string;
  createdAt?: string;
};

type OrgRow = {
  id: string;
  name: string;
  created_at?: string | null;
  created_by?: string | null;
};

export default function PlatformAdminPanel() {
  const { accessToken, user } = useSession();
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [organizations, setOrganizations] = useState<OrgRow[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState("");
  const [orgName, setOrgName] = useState("");
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [savingOrg, setSavingOrg] = useState(false);

  const formattedAdmins = useMemo(() => admins.filter((a) => a.email || a.userId), [admins]);

  const loadAdmins = async () => {
    if (!accessToken) return;
    setLoadingAdmins(true);
    try {
      const res = await fetch("/api/admin/platform-admins", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke hente admin-brukere.");
      }
      const data = await res.json();
      setAdmins(data.admins || []);
    } catch (err: any) {
      setError(err?.message || "Kunne ikke hente admin-brukere.");
    } finally {
      setLoadingAdmins(false);
    }
  };

  const loadOrganizations = async () => {
    if (!accessToken) return;
    setLoadingOrgs(true);
    try {
      const res = await fetch("/api/admin/organizations", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke hente organisasjoner.");
      }
      const data = await res.json();
      setOrganizations(data.organizations || []);
    } catch (err: any) {
      setError(err?.message || "Kunne ikke hente organisasjoner.");
    } finally {
      setLoadingOrgs(false);
    }
  };

  useEffect(() => {
    setError(null);
    loadAdmins();
    loadOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleAddAdmin = async () => {
    if (!adminEmail.trim()) {
      setError("E-post er p\u00e5krevd.");
      return;
    }
    if (!accessToken) return;
    setSavingAdmin(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/platform-admins", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ email: adminEmail.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke legge til admin.");
      }
      setAdminEmail("");
      await loadAdmins();
    } catch (err: any) {
      setError(err?.message || "Kunne ikke legge til admin.");
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleRemoveAdmin = async (userId: string) => {
    if (!accessToken) return;
    if (user?.id === userId) return;
    const confirmed = window.confirm("Fjern plattformadmin?");
    if (!confirmed) return;
    try {
      const res = await fetch("/api/admin/platform-admins", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke fjerne admin.");
      }
      setAdmins((prev) => prev.filter((admin) => admin.userId !== userId));
    } catch (err: any) {
      setError(err?.message || "Kunne ikke fjerne admin.");
    }
  };

  const handleCreateOrg = async () => {
    if (!orgName.trim()) {
      setError("Organisasjonsnavn er p\u00e5krevd.");
      return;
    }
    if (!accessToken) return;
    setSavingOrg(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: orgName.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke opprette organisasjon.");
      }
      setOrgName("");
      await loadOrganizations();
    } catch (err: any) {
      setError(err?.message || "Kunne ikke opprette organisasjon.");
    } finally {
      setSavingOrg(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Admin</CardTitle>
        <CardDescription>Administrer superadmin og organisasjoner.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Plattform-admins</div>
              <Button variant="outline" size="sm" onClick={loadAdmins} disabled={loadingAdmins}>
                Oppdater
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-[1.5fr_auto]">
              <Input
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                placeholder="navn@firma.no"
              />
              <Button onClick={handleAddAdmin} disabled={savingAdmin}>
                <UserPlus className="mr-2 h-4 w-4" />
                Legg til
              </Button>
            </div>

            <div className="space-y-2">
              {loadingAdmins && <p className="text-sm text-muted-foreground">Laster...</p>}
              {!loadingAdmins && formattedAdmins.length === 0 && (
                <p className="text-sm text-muted-foreground">Ingen plattform-admins funnet.</p>
              )}
              {formattedAdmins.map((admin) => (
                <div
                  key={admin.userId}
                  className="flex items-center justify-between rounded-md border border-border/70 p-3"
                >
                  <div>
                    <div className="text-sm font-medium">{admin.email || admin.userId}</div>
                    {admin.createdAt && (
                      <div className="text-xs text-muted-foreground">
                        Lagt til {new Date(admin.createdAt).toLocaleString("nb-NO")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {user?.id === admin.userId && <Badge variant="secondary">Deg</Badge>}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRemoveAdmin(admin.userId)}
                      disabled={user?.id === admin.userId}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">Organisasjoner</div>
              <Button variant="outline" size="sm" onClick={loadOrganizations} disabled={loadingOrgs}>
                Oppdater
              </Button>
            </div>
            <div className="grid gap-2 md:grid-cols-[1.5fr_auto]">
              <Input value={orgName} onChange={(e) => setOrgName(e.target.value)} placeholder="Firmanavn" />
              <Button onClick={handleCreateOrg} disabled={savingOrg}>
                <Building2 className="mr-2 h-4 w-4" />
                Opprett
              </Button>
            </div>

            <div className="space-y-2">
              {loadingOrgs && <p className="text-sm text-muted-foreground">Laster...</p>}
              {!loadingOrgs && organizations.length === 0 && (
                <p className="text-sm text-muted-foreground">Ingen organisasjoner registrert.</p>
              )}
              {organizations.map((org) => (
                <div key={org.id} className="flex items-center justify-between rounded-md border border-border/70 p-3">
                  <div>
                    <div className="text-sm font-medium">{org.name}</div>
                    {org.created_at && (
                      <div className="text-xs text-muted-foreground">
                        Opprettet {new Date(org.created_at).toLocaleDateString("nb-NO")}
                      </div>
                    )}
                  </div>
                  <Badge variant="outline">Org</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
