"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function LogoutButton({
  redirectTo = "/admin/login",
}: {
  redirectTo?: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function onLogout() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <Button variant="outline" size="sm" onClick={onLogout} disabled={pending}>
      {pending ? "Signing out…" : "Sign out"}
    </Button>
  );
}
