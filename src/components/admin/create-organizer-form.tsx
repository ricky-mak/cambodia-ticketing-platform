"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Values {
  name: string;
  slug: string;
  contactEmail: string;
  payoutNotes: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

const REASONS: Record<string, string> = {
  slug_taken: "That slug is already used.",
  email_taken: "That admin email is already used.",
  invalid_slug: "Slug must be lowercase letters, numbers and hyphens.",
  password_too_short: "Admin password must be at least 12 characters.",
};

export function CreateOrganizerForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>();

  async function onSubmit(values: Values) {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/organizers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setError(REASONS[data.reason] ?? "Could not create organizer.");
      return;
    }
    setMessage("Organizer created.");
    reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Organizer name</Label>
          <Input {...register("name", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Slug</Label>
          <Input placeholder="e.g. acme-events" {...register("slug", { required: true })} />
        </div>
        <div className="space-y-1.5">
          <Label>Contact email (optional)</Label>
          <Input type="email" {...register("contactEmail")} />
        </div>
        <div className="space-y-1.5">
          <Label>Payout notes (optional)</Label>
          <Input placeholder="Bank / account for manual payout" {...register("payoutNotes")} />
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 p-3">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          First organizer admin
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Name</Label>
            <Input {...register("adminName", { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Email</Label>
            <Input type="email" {...register("adminEmail", { required: true })} />
          </div>
          <div className="space-y-1.5">
            <Label>Password (min 12)</Label>
            <Input type="text" {...register("adminPassword", { required: true })} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create organizer"}
      </Button>
    </form>
  );
}
