"use client";

import { useEffect } from "react";
import { useAuth } from "@/providers/AuthProvider";
import { useRouter } from "next/navigation";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { authData, initialized } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If user is logged in → redirect away, but only after auth provider finishes init
    if (!initialized) return;
    if (authData?.access_token) {
      router.replace("/dashboard");
    }
  }, [authData, router]);

  return <>{children}</>;
}
