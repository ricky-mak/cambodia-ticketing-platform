"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

const TRANSITIONS: { label: string; status: string }[] = [
  { label: "Publish", status: "PUBLISHED" },
  { label: "Close sales", status: "SALES_CLOSED" },
  { label: "Back to draft", status: "DRAFT" },
];

export function EventStatusControl({
  eventId,
  status,
}: {
  eventId: string;
  status: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(next: string) {
    setPending(next);
    setError(null);
    const res = await fetch("/api/admin/event/status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: eventId, status: next }),
    });
    setPending(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to change status");
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <span className="text-sm">
        Status: <span className="font-semibold">{status}</span>
      </span>
      <div className="flex gap-2">
        {TRANSITIONS.filter((t) => t.status !== status).map((t) => (
          <Button
            key={t.status}
            variant={t.status === "PUBLISHED" ? "default" : "outline"}
            size="sm"
            disabled={pending !== null}
            onClick={() => setStatus(t.status)}
          >
            {pending === t.status ? "…" : t.label}
          </Button>
        ))}
      </div>
      {error && <span className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
