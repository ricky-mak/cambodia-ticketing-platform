"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface ZoneFormValues {
  name: string;
  description: string;
  priceMajor: number;
  currency: string;
  maxPerOrder: number;
  rows: number;
  seatsPerRow: number;
  displayOrder: number;
}

export function CreateZoneForm({
  eventId,
  currency,
}: {
  eventId: string;
  currency: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<ZoneFormValues>({
    defaultValues: {
      name: "",
      description: "",
      priceMajor: 0,
      currency,
      maxPerOrder: 10,
      rows: 1,
      seatsPerRow: 1,
      displayOrder: 0,
    },
  });

  const rows = Number(watch("rows")) || 0;
  const seatsPerRow = Number(watch("seatsPerRow")) || 0;
  const total = rows * seatsPerRow;

  async function onSubmit(values: ZoneFormValues) {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/zones", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId, ...values }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Failed to create zone");
      return;
    }
    setMessage(`Created "${values.name}" with ${data.totalSeats} seats.`);
    reset();
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label>Zone name</Label>
          <Input {...register("name", { required: true })} placeholder="VIP" />
        </div>
        <div className="space-y-1.5">
          <Label>Price ({currency})</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register("priceMajor", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Rows</Label>
          <Input
            type="number"
            min="1"
            {...register("rows", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Seats per row</Label>
          <Input
            type="number"
            min="1"
            {...register("seatsPerRow", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Max seats per order</Label>
          <Input
            type="number"
            min="1"
            {...register("maxPerOrder", { valueAsNumber: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Display order</Label>
          <Input
            type="number"
            {...register("displayOrder", { valueAsNumber: true })}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Description (optional)</Label>
        <Textarea rows={2} {...register("description")} />
      </div>

      <p className="text-sm text-muted-foreground">
        Will generate <span className="font-semibold">{total.toLocaleString()}</span>{" "}
        seats (rows A, B, C… × seats 1…{seatsPerRow || 0}).
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-green-600">{message}</p>}

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating…" : "Create zone"}
      </Button>
    </form>
  );
}
