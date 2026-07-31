"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export interface EventFormValues {
  id?: string;
  name: string;
  slug: string;
  currency: string;
  venueName: string;
  venueAddress: string;
  description: string;
  heroImageUrl: string;
  contactEmail: string;
  contactPhone: string;
  startsAt: string;
  endsAt: string;
  salesStartAt: string;
  salesEndAt: string;
  reservationMinutes: number;
  refundPolicy: string;
  terms: string;
}

export function EventForm({ initial }: { initial: EventFormValues }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { isSubmitting },
  } = useForm<EventFormValues>({ defaultValues: initial });

  async function onSubmit(values: EventFormValues) {
    setMessage(null);
    setError(null);
    const res = await fetch("/api/admin/event", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Save failed");
      return;
    }
    setMessage("Saved.");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {initial.id && <input type="hidden" {...register("id")} />}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Event name">
          <Input {...register("name", { required: true })} />
        </Field>
        <Field label="Slug (lowercase, hyphens)">
          <Input {...register("slug", { required: true })} placeholder="my-event-2026" />
        </Field>
        <Field label="Currency">
          <Input {...register("currency")} maxLength={3} placeholder="USD" />
        </Field>
        <Field label="Hero image URL">
          <Input {...register("heroImageUrl")} placeholder="https://…" />
        </Field>
        <Field label="Venue name">
          <Input {...register("venueName")} />
        </Field>
        <Field label="Venue address">
          <Input {...register("venueAddress")} />
        </Field>
        <Field label="Starts at (UTC)">
          <Input type="datetime-local" {...register("startsAt")} />
        </Field>
        <Field label="Ends at (UTC)">
          <Input type="datetime-local" {...register("endsAt")} />
        </Field>
        <Field label="Sales start (UTC)">
          <Input type="datetime-local" {...register("salesStartAt")} />
        </Field>
        <Field label="Sales end (UTC)">
          <Input type="datetime-local" {...register("salesEndAt")} />
        </Field>
        <Field label="Seat hold (minutes)">
          <Input
            type="number"
            min={1}
            max={240}
            {...register("reservationMinutes", { valueAsNumber: true })}
          />
        </Field>
        <Field label="Contact email">
          <Input type="email" {...register("contactEmail")} />
        </Field>
        <Field label="Contact phone">
          <Input {...register("contactPhone")} />
        </Field>
      </div>

      <Field label="Description">
        <Textarea rows={4} {...register("description")} />
      </Field>
      <Field label="Refund policy">
        <Textarea rows={3} {...register("refundPolicy")} />
      </Field>
      <Field label="Terms & conditions">
        <Textarea rows={3} {...register("terms")} />
      </Field>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving…" : initial.id ? "Save changes" : "Create event"}
      </Button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
