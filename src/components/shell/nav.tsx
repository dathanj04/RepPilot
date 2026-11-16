"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Building2,
  CreditCard,
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
  billing: CreditCard,
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

export type NavItem = { href: string; label: string; icon: keyof typeof ICONS; disabledReason?: string };

export function SideNav({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main navigation" className="flex flex-1 flex-col gap-1 px-3 pb-6">
      <p className="px-3 pb-3 text-[10px] font-semibold tracking-wide text-slate-400">Workspace</p>
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-disabled={Boolean(item.disabledReason)}
            title={item.disabledReason}
            onClick={event => { if (item.disabledReason) event.preventDefault(); }}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b5f4dd]",
              item.disabledReason ? "cursor-not-allowed text-slate-500 opacity-50" : active ? "bg-[#b5f4dd] text-[#10263E] shadow-sm" : "text-slate-300 hover:bg-white/5 hover:text-white",
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
  const [expanded, setExpanded] = useState(false);
  return (
    <nav aria-label="Mobile navigation" className={cn("fixed left-0 top-1/2 z-40 max-h-[70dvh] -translate-y-1/2 overflow-y-auto rounded-r-2xl border border-l-0 border-white/10 bg-[#0c2035] p-1.5 text-white shadow-lg md:hidden", expanded ? "w-44" : "w-14")}>
      <button type="button" aria-label={expanded ? "Minimize navigation" : "Expand navigation"} aria-expanded={expanded} aria-controls="mobile-side-links" onClick={() => setExpanded(value => !value)} className="flex h-11 w-full items-center gap-3 rounded-xl px-2 hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#b5f4dd]">
        {expanded ? <PanelLeftClose className="size-5 shrink-0" /> : <PanelLeftOpen className="size-5 shrink-0" />}
        {expanded ? <span className="text-xs font-medium">Minimize</span> : null}
      </button>
      <ul id="mobile-side-links" className="space-y-1">
        {items.map(item => {
          const Icon = ICONS[item.icon];
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <li key={item.href}><Link href={item.href} aria-label={pathname === "/map" && item.href === "/accounts" ? "Saved accounts" : item.label} title={pathname === "/map" && item.href === "/accounts" ? "Saved accounts" : item.label} aria-current={active ? "page" : undefined} onClick={event => {
              setExpanded(false);
              if (pathname === "/map" && item.href === "/accounts") {
                event.preventDefault();
                window.dispatchEvent(new Event("reppilot:toggle-saved-accounts"));
              }
            }} className={cn("relative flex h-11 items-center gap-3 rounded-xl px-2 text-sm font-medium focus-visible:outline-2 focus-visible:outline-[#b5f4dd]", active ? "bg-[#b5f4dd] text-[#10263E]" : "text-slate-300 hover:bg-white/10")}>
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {expanded ? <span>{item.label}</span> : null}
            {item.href === "/more" && unread > 0 ? <span className="absolute right-0 top-0 rounded-full bg-[#D94B4B] px-1 text-[10px] text-white">{unread}</span> : null}
          </Link></li>;
        })}
      </ul>
    </nav>
  );
}
