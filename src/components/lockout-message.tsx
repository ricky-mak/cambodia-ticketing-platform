"use client";

import { useEffect, useState } from "react";

/**
 * Shows a live countdown until a locked-out login can be retried. Calls
 * onExpire when the timer reaches zero so the caller can clear the message.
 * Only rendered after a client-side login attempt, so there's no SSR/hydration
 * concern with the time value.
 */
export function LockoutMessage({
  lockedUntil,
  onExpire,
}: {
  lockedUntil: string;
  onExpire: () => void;
}) {
  const target = new Date(lockedUntil).getTime();
  const [remainingMs, setRemainingMs] = useState(() => target - Date.now());

  useEffect(() => {
    const tick = () => {
      const next = target - Date.now();
      setRemainingMs(next);
      if (next <= 0) {
        clearInterval(timer);
        onExpire();
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [target, onExpire]);

  const totalSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return (
    <p className="text-sm text-destructive">
      Account temporarily locked after too many failed attempts. Try again in{" "}
      <span className="font-semibold tabular-nums">
        {minutes}:{seconds.toString().padStart(2, "0")}
      </span>
      .
    </p>
  );
}
