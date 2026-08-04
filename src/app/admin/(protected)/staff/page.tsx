import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateStaffForm } from "@/components/admin/create-staff-form";
import { StaffActions } from "@/components/admin/staff-actions";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-context";
import { listStaff } from "@/services/staff.service";
import { StaffRole } from "@/types/enums";

export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const ctx = await getAdminContext();
  if (!ctx) redirect("/admin/login");
  if (ctx.staff.role !== StaffRole.ADMIN) {
    return (
      <p className="text-muted-foreground">
        Staff management is available to admins only.
      </p>
    );
  }

  const staff = await listStaff(ctx.scope.organizerId);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <h1 className="text-2xl font-bold tracking-tight">Staff</h1>

      <Card>
        <CardHeader>
          <CardTitle>Accounts</CardTitle>
          <CardDescription>
            Roles: Admin (full), Manager (orders/attendees), Check-in staff
            (scanner only).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Manage</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => (
                  <tr key={s.id} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{s.name}</td>
                    <td className="py-2 pr-4">{s.email}</td>
                    <td className="py-2 pr-4">{s.status}</td>
                    <td className="py-2 pr-4">
                      <StaffActions id={s.id} role={s.role} status={s.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Add staff</CardTitle>
        </CardHeader>
        <CardContent>
          <CreateStaffForm />
        </CardContent>
      </Card>
    </div>
  );
}
