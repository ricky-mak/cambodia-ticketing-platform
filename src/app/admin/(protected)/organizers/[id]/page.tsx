import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getPlatformAdmin } from "@/lib/api-auth";
import {
  getOrganizerById,
  listEventsForOrganizer,
  listStaffForOrganizer,
} from "@/services/organizer.service";
import { OrganizerActions } from "@/components/admin/organizer-actions";

export const dynamic = "force-dynamic";

export default async function OrganizerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const staff = await getPlatformAdmin();
  if (!staff) redirect("/admin/dashboard");

  const { id } = await params;
  const organizer = await getOrganizerById(id);
  if (!organizer) notFound();

  const [events, orgStaff] = await Promise.all([
    listEventsForOrganizer(id),
    listStaffForOrganizer(id),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/admin/organizers"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← All organizers
        </Link>
        <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight">
          {organizer.name}
        </h1>
        <p className="text-muted-foreground">{organizer.slug}</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Details</CardTitle>
        </CardHeader>
        <CardContent>
          <OrganizerActions
            organizerId={organizer.id}
            name={organizer.name}
            contactEmail={organizer.contactEmail}
            payoutNotes={organizer.payoutNotes}
            status={organizer.status}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Events ({events.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {events.length === 0 ? (
              <p className="text-muted-foreground">No events yet.</p>
            ) : (
              events.map((e) => (
                <div key={e.id} className="flex justify-between">
                  <span>{e.name}</span>
                  <span className="text-muted-foreground">{e.status}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Staff ({orgStaff.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {orgStaff.length === 0 ? (
              <p className="text-muted-foreground">No staff yet.</p>
            ) : (
              orgStaff.map((s) => (
                <div key={s.id} className="flex justify-between">
                  <span>
                    {s.name}
                    <span className="text-muted-foreground"> · {s.email}</span>
                  </span>
                  <span className="text-muted-foreground">
                    {s.role}
                    {s.status !== "ACTIVE" ? ` · ${s.status}` : ""}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
