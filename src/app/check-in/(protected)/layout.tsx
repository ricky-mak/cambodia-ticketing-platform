import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentStaff } from "@/lib/session";
import { canAccessCheckIn } from "@/lib/authz";
import { LogoutButton } from "@/components/logout-button";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/check-in/scan", label: "Scan" },
  { href: "/check-in/search", label: "Search" },
  { href: "/check-in/history", label: "History" },
];

export default async function CheckInProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const staff = await getCurrentStaff();
  if (!staff || !canAccessCheckIn(staff.role)) {
    redirect("/check-in/login");
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col">
      <header className="flex items-center justify-between border-b bg-background px-4 py-3">
        <nav className="flex items-center gap-4 text-sm font-medium">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <LogoutButton redirectTo="/check-in/login" />
      </header>
      <div className="flex-1 p-4">{children}</div>
    </div>
  );
}
