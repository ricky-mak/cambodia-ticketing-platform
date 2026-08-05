import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminContext } from "@/lib/admin-context";
import { LogoutButton } from "@/components/logout-button";
import { EventSelector } from "@/components/admin/event-selector";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/attendees", label: "Attendees" },
  { href: "/admin/events", label: "Events" },
  { href: "/admin/zones", label: "Zones" },
  { href: "/admin/settlement", label: "Settlement" },
  { href: "/admin/staff", label: "Staff" },
  { href: "/admin/audit", label: "Audit" },
];

// Platform-admin-only entries.
const PLATFORM_NAV = [{ href: "/admin/organizers", label: "Organizers" }];

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
  const nav = scope.isPlatform ? [...NAV, ...PLATFORM_NAV] : NAV;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-background px-6 py-3">
        <div className="flex flex-wrap items-center gap-6">
          <div className="font-semibold">Event Ticketing — Admin</div>
          <nav className="flex items-center gap-4 text-sm">
            {nav.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="text-muted-foreground hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <EventSelector
            events={events}
            activeEventId={activeEvent?.id ?? null}
          />
          <span className="text-muted-foreground">
            {staff.name} · {staff.role}
          </span>
          <LogoutButton />
        </div>
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
