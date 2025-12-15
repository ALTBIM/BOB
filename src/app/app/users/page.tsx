"use client";

import LoginForm from "@/components/auth/LoginForm";
import UserManagement from "@/components/auth/UserManagement";
import { useSession } from "@/lib/session";
import { User } from "@/lib/database";

export default function UsersPage() {
  const { user, ready, login } = useSession();

  if (!user && ready) {
    return <LoginForm onLogin={(u: User) => login(u)} />;
  }

  return (
    <div className="space-y-4">
      <UserManagement />
    </div>
  );
}
