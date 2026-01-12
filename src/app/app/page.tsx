"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";
import { User } from "@/lib/database";

export default function AppEntry() {
  const { user, ready, login } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (user && ready) {
      router.replace("/app/chat");
    }
  }, [user, ready, router]);

  if (!user && ready) {
    return <LoginForm onLogin={(u: User) => login(u)} />;
  }

  return null;
}
