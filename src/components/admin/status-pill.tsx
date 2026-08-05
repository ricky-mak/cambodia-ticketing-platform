import { cn } from "@/lib/utils";

type Tone = "success" | "gold" | "rose" | "muted" | "destructive";

// Map order / ticket / payment statuses to a tone.
const TONES: Record<string, Tone> = {
  PAID: "success",
  SUCCESS: "success",
  VALID: "success",
  CHECKED_IN: "success",
  PENDING: "gold",
  PAYMENT_PROCESSING: "gold",
  REFUNDED: "rose",
  PARTIALLY_REFUNDED: "rose",
  CANCELLED: "muted",
  EXPIRED: "muted",
  VOID: "muted",
  PAYMENT_FAILED: "destructive",
  FAILED: "destructive",
};

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success/10 text-success ring-success/20",
  gold: "bg-gold/15 text-gold-foreground ring-gold/30",
  rose: "bg-rose/10 text-rose ring-rose/20",
  muted: "bg-muted text-muted-foreground ring-border",
  destructive: "bg-destructive/10 text-destructive ring-destructive/20",
};

function label(status: string): string {
  return status.replace(/_/g, " ").toLowerCase();
}

export function StatusPill({ status }: { status: string }) {
  const tone = TONES[status] ?? "muted";
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset",
        TONE_CLASSES[tone],
      )}
    >
      {label(status)}
    </span>
  );
}
