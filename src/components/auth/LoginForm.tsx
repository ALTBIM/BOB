"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Mail, Lock } from "lucide-react";
import { db, type User } from "@/lib/database";

interface LoginFormProps {
  onLogin: (user: User) => void;
}

export default function LoginForm({ onLogin }: LoginFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    const email = loginData.email.trim().toLowerCase();
    const password = loginData.password.trim();

    if (!email || !password) {
      setError("E-post og passord kan ikke være tomme.");
      setIsLoading(false);
      return;
    }

    try {
      const user = await db.authenticateUser(email, password);

      if (!user) {
        setError("Ugyldig pålogging. Kontroller e-post og passord og prøv igjen.");
        setIsLoading(false);
        return;
      }

      onLogin(user);
      setLoginData({ email: "", password: "" });
    } catch (err) {
      console.error("Login failed", err);
      setError("Noe gikk galt under pålogging. Prøv igjen senere.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Building2 className="h-10 w-10 text-blue-600" />
            <h1 className="text-3xl font-bold text-slate-900">BOB</h1>
          </div>
          <p className="text-slate-600">
            BIM Operations & Building Management
          </p>
        </div>

        <Tabs defaultValue="login" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="login">Sign In</TabsTrigger>
          </TabsList>

          <TabsContent value="login">
            <Card>
              <CardHeader>
                <CardTitle>Welcome back</CardTitle>
                <CardDescription>
                  Sign in with your administrator account to manage BOB
                  innstillinger og tilgang.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="email"
                        type="email"
                        placeholder="your@email.com"
                        className="pl-10"
                        value={loginData.email}
                        onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <Input
                        id="password"
                        type="password"
                        placeholder="Enter your password"
                        className="pl-10"
                        value={loginData.password}
                        onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={isLoading}>
                    {isLoading ? "Signing in..." : "Sign In"}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Admin-pålogging: admin@bob.no / bobadmin
                  </p>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
