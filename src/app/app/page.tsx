"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import LoginForm from "@/components/auth/LoginForm";
import { useSession } from "@/lib/session";

export default function AppEntry() {
  const { user, ready } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (user && ready) {
      router.replace("/app/chat");
    }
  }, [user, ready, router]);

  if (!user && ready) {
    return <LoginForm />;
  }

  return null;
}
