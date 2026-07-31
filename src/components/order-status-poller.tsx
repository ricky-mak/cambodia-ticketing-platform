"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Mounted only while an order is PENDING. Periodically asks the server to
 * re-check payment status with the gateway; when it changes (e.g. PAID), it
 * refreshes the page so the confirmed state renders. Gives up after a couple
 * of minutes to avoid endless polling.
 */
export function OrderStatusPoller({ token }: { token: string }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    let attempts = 0;

    const timer = setInterval(async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/orders/${token}/refresh-status`, {
          method: "POST",
        });
        const data = (await res.json().catch(() => ({}))) as {
          status?: string;
        };
        if (active && data.status && data.status !== "PENDING") {
          clearInterval(timer);
          router.refresh();
        }
      } catch {
        // transient; keep polling
      }
      if (attempts >= 30) clearInterval(timer);
    }, 4000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [token, router]);

  return null;
}
