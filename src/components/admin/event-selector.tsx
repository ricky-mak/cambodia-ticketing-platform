"use client";

import { useRouter } from "next/navigation";
import { ACTIVE_EVENT_COOKIE } from "@/lib/admin-context";

interface Props {
  events: { id: string; name: string }[];
  activeEventId: string | null;
}

/**
 * Header control that picks the event the admin is working on. Writes the
 * choice to a non-sensitive cookie (the server re-validates scope) and refreshes
 * so server components pick up the new active event.
 */
export function EventSelector({ events, activeEventId }: Props) {
  const router = useRouter();

  if (events.length === 0) return null;

  function onChange(id: string) {
    document.cookie = `${ACTIVE_EVENT_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">Event</span>
      <select
        value={activeEventId ?? ""}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 max-w-[220px] rounded-md border border-input bg-background px-2 text-sm"
      >
        {events.map((e) => (
          <option key={e.id} value={e.id}>
            {e.name}
          </option>
        ))}
      </select>
    </label>
  );
}
