"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function OrderActions({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(
    action: "cancel" | "refund" | "resend",
    confirmText?: string,
  ) {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(action);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/${action}`, {
        method: "POST",
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        setMessage(
          action === "resend" ? "Confirmation email sent." : "Done.",
        );
        router.refresh();
      } else {
        setMessage(data.reason ? `Failed: ${data.reason}` : "Action failed.");
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === "PENDING" && (
        <Button
          variant="outline"
          size="sm"
          disabled={busy !== null}
          onClick={() => run("cancel", "Cancel this unpaid order and release its seats?")}
        >
          {busy === "cancel" ? "…" : "Cancel order"}
        </Button>
      )}
      {status === "PAID" && (
        <Button
          variant="destructive"
          size="sm"
          disabled={busy !== null}
          onClick={() =>
            run(
              "refund",
              "Mark this order refunded? Tickets will be voided and seats released. Refund the money manually in ABA.",
            )
          }
        >
          {busy === "refund" ? "…" : "Refund (record only)"}
        </Button>
      )}
      <Button
        variant="outline"
        size="sm"
        disabled={busy !== null}
        onClick={() => run("resend")}
      >
        {busy === "resend" ? "…" : "Resend email"}
      </Button>
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
    </div>
  );
}
