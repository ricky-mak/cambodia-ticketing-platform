"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export function ReservationCountdown({ expiresAt }: { expiresAt: string }) {
  const router = useRouter();
  const target = useMemo(() => new Date(expiresAt).getTime(), [expiresAt]);
  // Start as null so the server and first client render match (no Date.now()
  // during render → no hydration mismatch). The real value is set on mount.
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    const tick = () => {
      const next = target - Date.now();
      setRemaining(next);
      if (next <= 0) {
        clearInterval(timer);
        router.refresh();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target, router]);

  if (remaining === null) {
    return <span className="font-semibold tabular-nums">--:--</span>;
  }
  if (remaining <= 0) {
    return <span className="font-semibold text-destructive">expired</span>;
  }

  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return (
    <span className="font-semibold tabular-nums">
      {minutes}:{seconds.toString().padStart(2, "0")}
    </span>
  );
}
