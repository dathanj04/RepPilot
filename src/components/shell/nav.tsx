"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  CalendarCheck,
  CalendarDays,
  ClipboardList,
  LayoutDashboard,
  Map,
  MoreHorizontal,
  Route,
  Settings,
  Shield,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { cn } from "cn";

const ICONS = {
  today: LayoutDashboard,
  map: Map,
  accounts: Building2,
  calendar: CalendarDays,
  meetings: CalendarCheck,
  more: MoreHorizontal,
  tasks: ClipboardList,
  lunches: UtensilsCrossed,
  spending: Wallet,
  admin: Shield,
  route: Route,
  settings: Settings,
};

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium",
              active ? "bg-[#19B78A] text-[#06281f]" : "text-white/80 hover:bg-white/10",
            )}
          >
            <Icon className="size-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav({ unread }: { unread: number }) {
  const pathname = usePathname();
  const items: NavItem[] = [
    { href: "/map", label: "Map", icon: "map" },
    { href: "/accounts", label: "Accounts", icon: "accounts" },
    { href: "/today", label: "Today", icon: "today" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/more", label: "More", icon: "more" },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || (item.href !== "/today" && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={cn(
                  "flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-[#10263E]" : "text-[#66758B]",
                )}
              >
                <span className="relative">
                  <Icon className={cn("size-5", item.href === "/today" && "size-6")} />
                  {item.href === "/more" && unread > 0 ? (
                    <span className="absolute -top-1 -right-2 grid min-w-4 place-items-center rounded-full bg-[#D94B4B] px-1 text-[10px] text-white">
                      {unread}
                    </span>
                  ) : null}
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
