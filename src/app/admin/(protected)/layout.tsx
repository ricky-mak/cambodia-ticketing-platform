import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-context";
import { LogoutButton } from "@/components/logout-button";
import { EventSelector } from "@/components/admin/event-selector";
import {
  AdminSidebar,
  type NavGroup,
} from "@/components/admin/admin-sidebar";

const MAIN_ITEMS = [
  { href: "/admin/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/admin/orders", label: "Orders", icon: "orders" },
  { href: "/admin/attendees", label: "Attendees", icon: "attendees" },
  { href: "/admin/events", label: "Events", icon: "events" },
  { href: "/admin/zones", label: "Zones", icon: "zones" },
  { href: "/admin/settlement", label: "Settlement", icon: "settlement" },
  { href: "/admin/staff", label: "Staff", icon: "staff" },
  { href: "/admin/audit", label: "Audit", icon: "audit" },
];

// Platform-admin-only.
const PLATFORM_ITEMS = [
  { href: "/admin/organizers", label: "Organizers", icon: "organizers" },
];

export const dynamic = "force-dynamic";

export default async function AdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ctx = await getAdminContext();

  // Real authorization check (middleware only checks cookie presence).
  if (!ctx) {
    redirect("/admin/login");
  }

  const { staff, scope, events, activeEvent } = ctx;
  const groups: NavGroup[] = [{ items: MAIN_ITEMS }];
  if (scope.isPlatform) {
    groups.push({ label: "Platform", items: PLATFORM_ITEMS });
  }

  return (
    <div className="min-h-screen bg-muted/20 md:flex">
      <AdminSidebar groups={groups} />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-end gap-4 border-b bg-background px-4 py-3 sm:px-6">
          <EventSelector events={events} activeEventId={activeEvent?.id ?? null} />
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {staff.name} · {staff.role}
          </span>
          <LogoutButton />
        </header>
        <main className="p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
