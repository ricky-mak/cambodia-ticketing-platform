"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Banknote,
  Building2,
  Calendar,
  LayoutDashboard,
  LayoutGrid,
  ScrollText,
  ShoppingCart,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";
import { SailMotif } from "@/components/brand/sail-motif";
import { cn } from "@/lib/utils";

const ICONS: Record<string, LucideIcon> = {
  dashboard: LayoutDashboard,
  orders: ShoppingCart,
  attendees: Users,
  events: Calendar,
  zones: LayoutGrid,
  settlement: Banknote,
  staff: UserCog,
  organizers: Building2,
  audit: ScrollText,
};

export interface NavItem {
  href: string;
  label: string;
  icon: string;
}

export interface NavGroup {
  label?: string;
  items: NavItem[];
}

export function AdminSidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

  const flat = groups.flatMap((g) => g.items);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col bg-brand-deep p-3 text-white md:flex">
        <div className="flex items-center gap-2.5 px-2 pb-4 pt-1">
          <SailMotif className="h-5 w-5 text-gold" />
          <span className="font-serif text-lg font-bold tracking-tight">
            Ticketing
          </span>
        </div>
        {groups.map((group, gi) => (
          <div key={gi} className="flex flex-col gap-0.5">
            {group.label && (
              <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/45">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? LayoutDashboard;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-white/10 font-semibold text-white shadow-[inset_3px_0_0_hsl(var(--gold))]"
                      : "text-white/70 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Icon className="h-[15px] w-[15px] shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </aside>

      {/* Mobile: brand + horizontally scrollable nav */}
      <div className="bg-brand-deep text-white md:hidden">
        <div className="flex items-center gap-2 px-4 pt-3">
          <SailMotif className="h-4 w-4 text-gold" />
          <span className="font-serif text-base font-bold">Ticketing</span>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-2 pt-2">
          {flat.map((item) => {
            const Icon = ICONS[item.icon] ?? LayoutDashboard;
            const active = isActive(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                  active
                    ? "bg-white/15 font-semibold text-white"
                    : "text-white/70",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </>
  );
}
