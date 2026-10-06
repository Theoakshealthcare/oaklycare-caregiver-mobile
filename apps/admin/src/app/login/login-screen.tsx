"use client";

import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";

import { useAuth } from "@/components/auth-provider";
import { LoginFlow } from "@/components/login-flow";
import { safeNext } from "@/lib/redirect";

export function LoginScreen() {
  const router = useRouter();
  const params = useSearchParams();
  const { status } = useAuth();
  const next = safeNext(params.get("next"));

  React.useEffect(() => {
    if (status === "authenticated") router.replace(next);
  }, [status, next, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <LoginFlow onSignedIn={() => router.replace(next)} />
    </main>
  );
}
