import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getAdminContext } from "@/lib/admin-context";
import { listAuditLogs } from "@/services/audit.service";

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

export default async function AuditPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");

  // Platform admins see everything; organizer admins see only their own staff's
  // actions (scoped by the acting user's organizer).
  const logs = await listAuditLogs(150, ctx.scope.organizerId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Audit log</h1>
      <Card>
        <CardHeader>
          <CardTitle>Recent sensitive actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Action</th>
                  <th className="py-2 pr-4">Entity</th>
                  <th className="py-2 pr-4">By</th>
                  <th className="py-2 pr-4">When</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{l.action}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {l.entityType ?? ""}
                      {l.entityId ? ` ${l.entityId.slice(0, 8)}…` : ""}
                    </td>
                    <td className="py-2 pr-4">{l.staffName ?? "—"}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {formatTime(l.createdAt)}
                    </td>
                  </tr>
                ))}
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-muted-foreground">
                      No audit entries yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
