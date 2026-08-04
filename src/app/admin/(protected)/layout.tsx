import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/session";
import { canAccessAdmin, isPlatformAdmin } from "@/lib/authz";
import { LogoutButton } from "@/components/logout-button";

const NAV = [
  { href: "/admin/dashboard", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/attendees", label: "Attendees" },
  { href: "/admin/event", label: "Event" },
  { href: "/admin/zones", label: "Zones" },
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
  const staff = await getCurrentStaff();

  // Real authorization check (middleware only checks cookie presence).
  if (!staff || !canAccessAdmin(staff.role)) {
    redirect("/admin/login");
  }

  const nav = isPlatformAdmin(staff) ? [...NAV, ...PLATFORM_NAV] : NAV;

  return (
    <div className="min-h-screen bg-muted/20">
      <header className="flex items-center justify-between border-b bg-background px-6 py-3">
        <div className="flex items-center gap-6">
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
