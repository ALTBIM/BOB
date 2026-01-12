"use client";

import LoginForm from "@/components/auth/LoginForm";
import UserManagement from "@/components/auth/UserManagement";
import { useSession } from "@/lib/session";

export default function UsersPage() {
  const { user, ready } = useSession();

  if (!user && ready) {
    return <LoginForm />;
  }

  return (
    <div className="space-y-4">
      <UserManagement />
    </div>
  );
}
