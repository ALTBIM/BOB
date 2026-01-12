"use client";

import { useState } from "react";
import { Building2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useSession } from "@/lib/session";

export default function LoginForm() {
  const { signInWithPassword, signInWithMagicLink } = useSession();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loginData, setLoginData] = useState({ email: "", password: "" });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    setMagicLinkSent(false);

    const email = loginData.email.trim().toLowerCase();
    const password = loginData.password.trim();

    if (!email || !password) {
      setError("E-post og passord kan ikke v\u00e6re tomme.");
      setIsLoading(false);
      return;
    }

    try {
      const result = await signInWithPassword(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      setLoginData({ email: "", password: "" });
    } catch (err) {
      console.error("Login failed", err);
      setError("Noe gikk galt under p\u00e5logging. Pr\u00f8v igjen senere.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleMagicLink = async () => {
    const email = loginData.email.trim().toLowerCase();
    if (!email) {
      setError("Skriv inn e-post for \u00e5 motta magisk lenke.");
      return;
    }
    setIsLoading(true);
    setError(null);
    setMagicLinkSent(false);
    try {
      const result = await signInWithMagicLink(email);
      if (result.error) {
        setError(result.error);
        return;
      }
      setMagicLinkSent(true);
    } catch (err) {
      console.error("Magic link failed", err);
      setError("Kunne ikke sende lenke. Pr\u00f8v igjen senere.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Building2 className="h-10 w-10 text-primary" />
            <h1 className="text-3xl font-bold text-foreground">BOB</h1>
          </div>
          <p className="text-muted-foreground">BIM Operations &amp; Building Management</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Logg inn</CardTitle>
            <CardDescription>Bruk e-post og passord, eller send en magisk lenke.</CardDescription>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
            {magicLinkSent && <p className="text-sm text-emerald-600 mb-2">Magisk lenke er sendt til e-post.</p>}
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-post</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="din@epost.no"
                    className="pl-10"
                    value={loginData.email}
                    onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Passord</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Ditt passord"
                    className="pl-10"
                    value={loginData.password}
                    onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Logger inn..." : "Logg inn"}
              </Button>
              <Button type="button" variant="outline" className="w-full" onClick={handleMagicLink} disabled={isLoading}>
                Send magisk lenke
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                Mangler tilgang? Kontakt prosjektadministrator.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
