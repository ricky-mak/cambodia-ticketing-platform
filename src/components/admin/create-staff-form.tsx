"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Values {
  name: string;
  email: string;
  password: string;
  role: string;
}

export function CreateStaffForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<Values>({ defaultValues: { role: "CHECK_IN_STAFF" } });

  async function onSubmit(values: Values) {
    setError(null);
    setMessage(null);
    const res = await fetch("/api/admin/staff", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      setError(
        data.reason === "email_taken"
          ? "That email is already used."
          : data.reason === "password_too_short"
            ? "Password must be at least 12 characters."
            : "Could not create staff.",
      );
      return;
    }
    setMessage("Staff account created.");
    reset({ name: "", email: "", password: "", role: "CHECK_IN_STAFF" });
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label>Name</Label>
        <Input {...register("name", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input type="email" {...register("email", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Password (min 12)</Label>
        <Input type="text" {...register("password", { required: true })} />
      </div>
      <div className="space-y-1.5">
        <Label>Role</Label>
        <select
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          {...register("role")}
        >
          <option value="CHECK_IN_STAFF">Check-in staff</option>
          <option value="MANAGER">Manager</option>
          <option value="ADMIN">Admin</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        {error && <p className="mb-2 text-sm text-destructive">{error}</p>}
        {message && <p className="mb-2 text-sm text-green-600">{message}</p>}
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Creating…" : "Create staff"}
        </Button>
      </div>
    </form>
  );
}
