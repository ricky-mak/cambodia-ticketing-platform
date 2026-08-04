import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPlatformAdmin } from "@/lib/api-auth";
import { listOrganizersWithStats } from "@/services/organizer.service";
import { CreateOrganizerForm } from "@/components/admin/create-organizer-form";

export const dynamic = "force-dynamic";

export default async function OrganizersPage() {
  const staff = await getPlatformAdmin();
  if (!staff) redirect("/admin/dashboard");

  const organizers = await listOrganizersWithStats();

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <h1 className="font-serif text-2xl font-bold tracking-tight">
          Organizers
        </h1>
        <p className="text-muted-foreground">
          Every organization hosting events on the platform.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {organizers.length} organizer{organizers.length === 1 ? "" : "s"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {organizers.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No organizers yet. Create one below.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">Name</th>
                    <th className="pb-2 pr-4 font-medium">Slug</th>
                    <th className="pb-2 pr-4 font-medium">Status</th>
                    <th className="pb-2 pr-4 font-medium">Events</th>
                    <th className="pb-2 pr-4 font-medium">Paid orders</th>
                    <th className="pb-2" />
                  </tr>
                </thead>
                <tbody>
                  {organizers.map((o) => (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium">{o.name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {o.slug}
                      </td>
                      <td className="py-2.5 pr-4">
                        {o.status === "ACTIVE" ? (
                          <span className="rounded-full bg-success/10 px-2 py-0.5 text-xs font-semibold text-success ring-1 ring-inset ring-success/20">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive ring-1 ring-inset ring-destructive/20">
                            Suspended
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4">{o.eventCount}</td>
                      <td className="py-2.5 pr-4">{o.paidOrders}</td>
                      <td className="py-2.5 text-right">
                        <Link
                          href={`/admin/organizers/${o.id}`}
                          className="font-medium text-brand hover:underline"
                        >
                          Manage →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Create organizer</CardTitle>
          <CardDescription>
            Sets up the organization and its first admin account (invite-only).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CreateOrganizerForm />
        </CardContent>
      </Card>
    </div>
  );
}
