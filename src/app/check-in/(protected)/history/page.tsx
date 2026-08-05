import { getCheckInStaff } from "@/lib/api-auth";
import { getRecentActivity } from "@/services/check-in.service";

export const dynamic = "force-dynamic";

function formatTime(iso: string): string {
  return (
    new Intl.DateTimeFormat("en-US", {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone: "UTC",
    }).format(new Date(iso)) + " UTC"
  );
}

export default async function CheckInHistoryPage() {
  const staff = await getCheckInStaff();
  const activity = await getRecentActivity(50, staff?.organizerId ?? null);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Recent check-ins</h1>
        <p className="text-sm text-muted-foreground">Latest 50 events.</p>
      </div>

      {activity.length === 0 ? (
        <p className="text-sm text-muted-foreground">No activity yet.</p>
      ) : (
        <div className="space-y-2">
          {activity.map((a, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded border p-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {a.attendeeName ?? "Unknown ticket"}
                  {a.seatLabel ? ` · ${a.seatLabel}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  {a.action}
                  {a.staffName ? ` · ${a.staffName}` : ""}
                </p>
              </div>
              <span className="text-xs text-muted-foreground">
                {formatTime(a.createdAt)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
