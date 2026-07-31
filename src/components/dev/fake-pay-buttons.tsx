"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function FakePayButtons({
  merchantTransactionId,
  publicToken,
}: {
  merchantTransactionId: string;
  publicToken: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function simulate(status: string) {
    setPending(true);
    // Mimic PayWay's pushback shape so the same callback path runs.
    await fetch("/api/payments/payway/callback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tran_id: merchantTransactionId,
        apv: "FAKE-APV",
        status,
      }),
    });
    router.push(`/order/${publicToken}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <Button disabled={pending} onClick={() => simulate("0")}>
        {pending ? "Processing…" : "Pay now (simulate success)"}
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => router.push(`/order/${publicToken}`)}
      >
        Cancel
      </Button>
    </div>
  );
}
