"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Trash2, UserPlus, Users } from "lucide-react";
import { useSession } from "@/lib/session";

type TeamMember = {
  userId: string;
  email: string;
  roleInTeam?: string | null;
  addedAt?: string;
};

type TeamRow = {
  id: string;
  name: string;
  createdAt?: string;
  members: TeamMember[];
};

export default function ProjectTeamsPanel({ projectId }: { projectId: string }) {
  const { accessToken } = useSession();
  const [teams, setTeams] = useState<TeamRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newTeamName, setNewTeamName] = useState("");
  const [creating, setCreating] = useState(false);
  const [memberEmailByTeam, setMemberEmailByTeam] = useState<Record<string, string>>({});

  const loadTeams = async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/teams?projectId=${encodeURIComponent(projectId)}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke hente team.");
      }
      const data = await res.json();
      setTeams(data.teams || []);
    } catch (err: any) {
      setError(err?.message || "Kunne ikke hente team.");
      setTeams([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!projectId) return;
    loadTeams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, accessToken]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) {
      setError("Teamnavn er p\u00e5krevd.");
      return;
    }
    if (!accessToken) {
      setError("Mangler p\u00e5logging.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/teams", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId, name: newTeamName.trim() }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke opprette team.");
      }
      setNewTeamName("");
      await loadTeams();
    } catch (err: any) {
      setError(err?.message || "Kunne ikke opprette team.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteTeam = async (teamId: string) => {
    if (!accessToken) return;
    const confirmed = window.confirm("Slett teamet?");
    if (!confirmed) return;
    try {
      const res = await fetch("/api/admin/teams", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ projectId, teamId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke slette team.");
      }
      setTeams((prev) => prev.filter((t) => t.id !== teamId));
    } catch (err: any) {
      setError(err?.message || "Kunne ikke slette team.");
    }
  };

  const handleAddMember = async (teamId: string) => {
    if (!accessToken) return;
    const email = (memberEmailByTeam[teamId] || "").trim();
    if (!email) {
      setError("E-post er p\u00e5krevd.");
      return;
    }
    setError(null);
    try {
      const res = await fetch("/api/admin/team-members", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ teamId, email }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke legge til medlem.");
      }
      setMemberEmailByTeam((prev) => ({ ...prev, [teamId]: "" }));
      await loadTeams();
    } catch (err: any) {
      setError(err?.message || "Kunne ikke legge til medlem.");
    }
  };

  const handleRemoveMember = async (teamId: string, userId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch("/api/admin/team-members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ teamId, userId }),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Kunne ikke fjerne medlem.");
      }
      setTeams((prev) =>
        prev.map((team) =>
          team.id === teamId
            ? { ...team, members: team.members.filter((m) => m.userId !== userId) }
            : team
        )
      );
    } catch (err: any) {
      setError(err?.message || "Kunne ikke fjerne medlem.");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Team</CardTitle>
            <CardDescription>Opprett team og legg til medlemmer.</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={loadTeams} disabled={loading}>
            Oppdater
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex flex-wrap gap-2">
          <Input
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            placeholder="Nytt teamnavn"
            className="min-w-[220px]"
          />
          <Button onClick={handleCreateTeam} disabled={creating}>
            <Users className="mr-2 h-4 w-4" />
            {creating ? "Oppretter..." : "Opprett team"}
          </Button>
        </div>

        {loading && <p className="text-sm text-muted-foreground">Laster team...</p>}
        {!loading && teams.length === 0 && (
          <p className="text-sm text-muted-foreground">Ingen team opprettet enn\u00e5.</p>
        )}

        <div className="space-y-4">
          {teams.map((team) => (
            <div key={team.id} className="rounded-md border border-border/70 p-3 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{team.members.length} medlemmer</Badge>
                  <span className="text-sm font-medium">{team.name}</span>
                </div>
                <Button variant="ghost" size="sm" onClick={() => handleDeleteTeam(team.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Input
                  value={memberEmailByTeam[team.id] || ""}
                  onChange={(e) => setMemberEmailByTeam((prev) => ({ ...prev, [team.id]: e.target.value }))}
                  placeholder="Legg til medlem (e-post)"
                  className="min-w-[220px]"
                />
                <Button variant="outline" size="sm" onClick={() => handleAddMember(team.id)}>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Legg til
                </Button>
              </div>

              <div className="space-y-2">
                {team.members.length === 0 && (
                  <p className="text-xs text-muted-foreground">Ingen medlemmer lagt til i teamet.</p>
                )}
                {team.members.map((member) => (
                  <div
                    key={member.userId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-border/60 px-3 py-2"
                  >
                    <div className="text-sm">{member.email || member.userId}</div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveMember(team.id, member.userId)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
