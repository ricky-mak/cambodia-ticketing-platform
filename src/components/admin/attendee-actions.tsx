"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function AttendeeActions({
  ticketId,
  status,
}: {
  ticketId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  async function call(url: string, key: string, confirmText?: string) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(key);
    try {
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticketId }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap justify-end gap-1">
      {status === "CHECKED_IN" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            call("/api/tickets/undo-check-in", "undo", "Undo this check-in?")
          }
        >
          {busy === "undo" ? "…" : "Undo"}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => call(`/api/admin/tickets/${ticketId}/resend`, "resend")}
      >
        {busy === "resend" ? "…" : "Resend"}
      </Button>
      {(status === "VALID" || status === "CHECKED_IN") && (
        <Button
          variant="destructive"
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            call(
              `/api/admin/tickets/${ticketId}/void`,
              "void",
              "Void this ticket and release its seat?",
            )
          }
        >
          {busy === "void" ? "…" : "Void"}
        </Button>
      )}
    </div>
  );
}
