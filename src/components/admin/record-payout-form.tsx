"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Values {
  currency: string;
  amountMajor: number;
  note: string;
}

export function RecordPayoutForm({
  organizerId,
  currencies,
}: {
  organizerId: string;
  currencies: string[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({
    defaultValues: { currency: currencies[0] ?? "USD" },
  });

  async function onSubmit(values: Values) {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/payouts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        organizerId,
        currency: values.currency,
        amountMajor: Number(values.amountMajor),
        note: values.note,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setError(
        data.reason === "invalid_amount"
          ? "Enter a positive amount."
          : "Could not record payout.",
      );
      return;
    }
    setMessage("Payout recorded.");
    reset({ currency: values.currency, amountMajor: undefined, note: "" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label>Currency</Label>
          {currencies.length > 0 ? (
            <select
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              {...register("currency")}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          ) : (
            <Input maxLength={3} placeholder="USD" {...register("currency")} />
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Amount</Label>
          <Input
            type="number"
            step="0.01"
            min="0"
            {...register("amountMajor", { valueAsNumber: true, required: true })}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Note (optional)</Label>
          <Input placeholder="e.g. bank ref" {...register("note")} />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      {message && <p className="text-sm text-success">{message}</p>}
      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Recording…" : "Record payout"}
      </Button>
    </form>
  );
}
