"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const ROLES = ["ADMIN", "MANAGER", "CHECK_IN_STAFF"];

export function StaffActions({
  id,
  role,
  status,
}: {
  id: string;
  role: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try {
      await fetch(`/api/admin/staff/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const pw = window.prompt("New password (min 12 characters):");
    if (!pw) return;
    if (pw.length < 12) {
      window.alert("Password must be at least 12 characters.");
      return;
    }
    await post({ password: pw });
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <select
        defaultValue={role}
        disabled={busy}
        onChange={(e) => post({ role: e.target.value })}
        className="h-8 rounded-md border border-input bg-background px-2 text-xs"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      <Button
        variant="outline"
        size="sm"
        disabled={busy}
        onClick={() =>
          post({ status: status === "ACTIVE" ? "DISABLED" : "ACTIVE" })
        }
      >
        {status === "ACTIVE" ? "Disable" : "Enable"}
      </Button>
      <Button variant="outline" size="sm" disabled={busy} onClick={resetPassword}>
        Reset password
      </Button>
    </div>
  );
}
