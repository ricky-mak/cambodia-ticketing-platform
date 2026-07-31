"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

interface TicketDisplay {
  ticketNumber: string;
  attendeeName: string;
  zoneName: string;
  seatLabel: string;
  checkedInAt: string | null;
}
interface Result {
  outcome: string;
  ticket?: TicketDisplay;
  token: string;
}

type Feedback = "ok" | "warn" | "error";

function vibrate(kind: Feedback) {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  navigator.vibrate(
    kind === "ok" ? 80 : kind === "warn" ? [60, 40, 60] : [120, 60, 120],
  );
}

let audioCtx: AudioContext | null = null;
function beep(kind: Feedback) {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext })
        .webkitAudioContext;
    audioCtx = audioCtx ?? new Ctx();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.frequency.value = kind === "ok" ? 880 : kind === "warn" ? 520 : 220;
    gain.gain.value = 0.08;
    osc.start();
    setTimeout(() => osc.stop(), kind === "ok" ? 120 : 220);
  } catch {
    // audio not available; ignore
  }
}

function feedback(kind: Feedback) {
  beep(kind);
  vibrate(kind);
}

function outcomeStyle(outcome: string): {
  bg: string;
  title: string;
  kind: Feedback;
} {
  switch (outcome) {
    case "VALID":
      return { bg: "bg-green-600", title: "Valid ticket", kind: "ok" };
    case "CHECKED_IN":
      return { bg: "bg-green-600", title: "Checked in ✓", kind: "ok" };
    case "ALREADY_CHECKED_IN":
      return {
        bg: "bg-orange-500",
        title: "Already checked in",
        kind: "warn",
      };
    case "TICKET_NOT_FOUND":
      return { bg: "bg-red-600", title: "Ticket not found", kind: "error" };
    case "INVALID_SIGNATURE":
      return { bg: "bg-red-600", title: "Invalid QR code", kind: "error" };
    case "WRONG_EVENT":
      return { bg: "bg-red-600", title: "Wrong event", kind: "error" };
    case "CANCELLED":
      return { bg: "bg-red-600", title: "Ticket cancelled", kind: "error" };
    case "REFUNDED":
      return { bg: "bg-red-600", title: "Ticket refunded", kind: "error" };
    case "VOID":
      return { bg: "bg-red-600", title: "Ticket void", kind: "error" };
    default:
      return { bg: "bg-red-600", title: "Error", kind: "error" };
  }
}

export function Scanner() {
  const scannerRef = useRef<{
    pause: (b?: boolean) => void;
    resume: () => void;
    stop: () => Promise<void>;
    clear: () => void;
    applyVideoConstraints: (c: MediaTrackConstraints) => Promise<void>;
  } | null>(null);
  const scanningRef = useRef(true);

  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [checking, setChecking] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  const handleToken = useCallback(async (token: string) => {
    if (!scanningRef.current) return;
    scanningRef.current = false;
    try {
      scannerRef.current?.pause(true);
    } catch {
      // ignore
    }
    try {
      const res = await fetch("/api/tickets/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();
      const next: Result = { outcome: data.outcome ?? "ERROR", ticket: data.ticket, token };
      setResult(next);
      feedback(outcomeStyle(next.outcome).kind);
    } catch {
      setResult({ outcome: "ERROR", token });
      feedback("error");
    }
  }, []);

  useEffect(() => {
    // Camera (getUserMedia) requires a secure context: HTTPS or localhost.
    // A plain http:// LAN address (e.g. 192.168.x.x) on a phone won't work.
    if (
      typeof window !== "undefined" &&
      (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia)
    ) {
      setError(
        "Camera needs a secure connection (HTTPS). On a phone, open the app via your HTTPS URL — e.g. your ngrok address — not a plain http:// LAN address like 192.168.x.x. (Desktop localhost works.)",
      );
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (cancelled) return;
        const instance = new Html5Qrcode("reader");
        scannerRef.current = instance as unknown as typeof scannerRef.current;
        await instance.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 250 } },
          (text: string) => {
            void handleToken(text);
          },
          () => {
            // per-frame decode errors are normal; ignore
          },
        );
        if (!cancelled) setReady(true);
      } catch {
        if (!cancelled) {
          setError(
            "Unable to start the camera. Grant camera permission and use HTTPS (or localhost).",
          );
        }
      }
    })();

    return () => {
      cancelled = true;
      const inst = scannerRef.current;
      if (inst) {
        inst
          .stop()
          .then(() => inst.clear())
          .catch(() => {});
        scannerRef.current = null;
      }
    };
  }, [handleToken]);

  const scanNext = useCallback(() => {
    setResult(null);
    scanningRef.current = true;
    try {
      scannerRef.current?.resume();
    } catch {
      // ignore
    }
  }, []);

  const confirmCheckIn = useCallback(async () => {
    if (!result?.token) return;
    setChecking(true);
    try {
      const res = await fetch("/api/tickets/check-in", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: result.token }),
      });
      const data = await res.json();
      const next: Result = {
        outcome: data.outcome ?? "ERROR",
        ticket: data.ticket,
        token: result.token,
      };
      setResult(next);
      feedback(outcomeStyle(next.outcome).kind);
    } catch {
      setResult({ outcome: "ERROR", token: result.token });
      feedback("error");
    } finally {
      setChecking(false);
    }
  }, [result]);

  const toggleTorch = useCallback(async () => {
    try {
      await scannerRef.current?.applyVideoConstraints({
        advanced: [{ torch: !torchOn }],
      } as unknown as MediaTrackConstraints);
      setTorchOn((v) => !v);
    } catch {
      // torch unsupported on this device
    }
  }, [torchOn]);

  const style = result ? outcomeStyle(result.outcome) : null;

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-lg border bg-black">
        <div id="reader" className="w-full" />

        {!ready && !error && (
          <p className="p-6 text-center text-sm text-white">Starting camera…</p>
        )}
        {error && <p className="p-6 text-center text-sm text-red-300">{error}</p>}

        {result && style && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-white ${style.bg}`}
          >
            <p className="text-2xl font-bold">{style.title}</p>
            {result.ticket && (
              <div className="text-center">
                <p className="text-lg font-semibold">
                  {result.ticket.attendeeName}
                </p>
                <p className="text-sm opacity-90">
                  {result.ticket.zoneName} · Seat {result.ticket.seatLabel}
                </p>
                <p className="text-xs opacity-75">
                  {result.ticket.ticketNumber}
                </p>
                {result.outcome === "ALREADY_CHECKED_IN" &&
                  result.ticket.checkedInAt && (
                    <p className="mt-1 text-xs opacity-90">
                      at{" "}
                      {new Intl.DateTimeFormat("en-US", {
                        timeStyle: "medium",
                        timeZone: "UTC",
                      }).format(new Date(result.ticket.checkedInAt))}{" "}
                      UTC
                    </p>
                  )}
              </div>
            )}

            <div className="flex w-full max-w-xs flex-col gap-2">
              {result.outcome === "VALID" ? (
                <>
                  <Button
                    className="w-full bg-white text-green-700 hover:bg-white/90"
                    onClick={confirmCheckIn}
                    disabled={checking}
                  >
                    {checking ? "Checking in…" : "Check in"}
                  </Button>
                  <Button
                    variant="outline"
                    className="w-full border-white bg-transparent text-white hover:bg-white/10"
                    onClick={scanNext}
                    disabled={checking}
                  >
                    Cancel
                  </Button>
                </>
              ) : (
                <Button
                  className="w-full bg-white text-gray-900 hover:bg-white/90"
                  onClick={scanNext}
                >
                  Scan next
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {ready && !result && (
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={toggleTorch}>
            {torchOn ? "Turn off flashlight" : "Turn on flashlight"}
          </Button>
        </div>
      )}
    </div>
  );
}
