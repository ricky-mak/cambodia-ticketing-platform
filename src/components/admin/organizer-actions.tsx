"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  organizerId: string;
  name: string;
  contactEmail: string | null;
  payoutNotes: string | null;
  status: string;
}

export function OrganizerActions({
  organizerId,
  name,
  contactEmail,
  payoutNotes,
  status,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState({
    name,
    contactEmail: contactEmail ?? "",
    payoutNotes: payoutNotes ?? "",
  });

  async function patch(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/organizers/${organizerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      setError("Update failed.");
      return;
    }
    setMessage(ok);
    router.refresh();
  }

  const suspended = status === "SUSPENDED";

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Organizer name</Label>
          <Input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Contact email</Label>
          <Input
            type="email"
            value={form.contactEmail}
            onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Payout notes</Label>
          <Input
            value={form.payoutNotes}
            onChange={(e) => setForm({ ...form, payoutNotes: e.target.value })}
          />
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          disabled={busy}
          onClick={() =>
            patch(
              {
                name: form.name,
                contactEmail: form.contactEmail,
                payoutNotes: form.payoutNotes,
              },
              "Saved.",
            )
          }
        >
          Save changes
        </Button>
        <Button
          variant={suspended ? "success" : "destructive"}
          disabled={busy}
          onClick={() =>
            patch(
              { status: suspended ? "ACTIVE" : "SUSPENDED" },
              suspended ? "Organizer re-activated." : "Organizer suspended.",
            )
          }
        >
          {suspended ? "Re-activate organizer" : "Suspend organizer"}
        </Button>
      </div>
      {!suspended && (
        <p className="text-xs text-muted-foreground">
          Suspending blocks this organizer&apos;s staff from signing in.
        </p>
      )}
    </div>
  );
}
