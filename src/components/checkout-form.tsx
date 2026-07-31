"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface CheckoutFormValues {
  quantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  agreeTerms: boolean;
}

export function CheckoutForm({
  zoneId,
  maxQuantity,
}: {
  zoneId: string;
  maxQuantity: number;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormValues>({
    defaultValues: {
      quantity: 1,
      customerName: "",
      customerEmail: "",
      customerPhone: "",
      agreeTerms: false,
    },
  });

  const quantityOptions = Array.from({ length: maxQuantity }, (_, i) => i + 1);

  async function onSubmit(values: CheckoutFormValues) {
    setError(null);
    const res = await fetch("/api/checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        zoneId,
        quantity: Number(values.quantity),
        customerName: values.customerName,
        customerEmail: values.customerEmail,
        customerPhone: values.customerPhone,
        agreeTerms: values.agreeTerms,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Could not reserve seats.");
      return;
    }

    const checkout = data.checkout as
      | { kind: "redirect"; url: string }
      | { kind: "form_post"; action: string; fields: Record<string, string> }
      | undefined;

    if (checkout?.kind === "form_post") {
      // Auto-submit a form to the payment gateway (PayWay hosted checkout).
      const form = document.createElement("form");
      form.method = "POST";
      form.action = checkout.action;
      for (const [name, value] of Object.entries(checkout.fields)) {
        const el = document.createElement("input");
        el.type = "hidden";
        el.name = name;
        el.value = value;
        form.appendChild(el);
      }
      document.body.appendChild(form);
      form.submit();
      return;
    }

    if (checkout?.kind === "redirect") {
      window.location.href = checkout.url;
      return;
    }

    // Fallback: no payment instruction, go to the order page.
    router.push(`/order/${data.publicToken}`);
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="quantity">Number of seats</Label>
        <select
          id="quantity"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          {...register("quantity", { valueAsNumber: true })}
        >
          {quantityOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerName">Full name</Label>
        <Input id="customerName" {...register("customerName", { required: true })} />
        {errors.customerName && (
          <p className="text-sm text-destructive">Name is required.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerEmail">Email</Label>
        <Input
          id="customerEmail"
          type="email"
          {...register("customerEmail", { required: true })}
        />
        {errors.customerEmail && (
          <p className="text-sm text-destructive">A valid email is required.</p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="customerPhone">Phone</Label>
        <Input id="customerPhone" {...register("customerPhone", { required: true })} />
        {errors.customerPhone && (
          <p className="text-sm text-destructive">Phone is required.</p>
        )}
      </div>

      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1" {...register("agreeTerms", { required: true })} />
        <span>I agree to the terms and conditions and refund policy.</span>
      </label>
      {errors.agreeTerms && (
        <p className="text-sm text-destructive">You must agree to continue.</p>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Reserving…" : "Reserve seats"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Seats are held for a limited time while you complete payment.
      </p>
    </form>
  );
}
