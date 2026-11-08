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
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3 pb-6">
      <p className="px-3 pb-3 text-[10px] font-semibold tracking-[0.18em] text-slate-400">WORKSPACE</p>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b5f4dd]",
              active ? "bg-[#b5f4dd] text-[#10263E] shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white",
            )}
          >
            <Icon className="size-[18px]" aria-hidden="true" />
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
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || (item.href !== "/today" && pathname.startsWith(`${item.href}/`));
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-20 flex-col items-center justify-center gap-1 text-[11px] font-medium",
                  active ? "text-[#10263E]" : "text-[#66758B]",
                )}
              >
                <span className={cn("relative rounded-xl px-4 py-1.5", active && "bg-emerald-50")}>
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
