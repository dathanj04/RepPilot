"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
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
  const pathname=usePathname();
  const items: NavItem[]=[
    {href:"/map",label:"Map",icon:"map"},
    {href:"/accounts",label:"Accounts",icon:"accounts"},
    {href:"/route",label:"Routes",icon:"route"},
    {href:"/calendar",label:"Calendar",icon:"calendar"},
    {href:"/more",label:"Settings",icon:"settings"},
  ];
  return <nav aria-label="Mobile navigation" className="mobile-primary-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-2 pt-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"><ul className="grid grid-cols-5">{items.map(item=>{
    const Icon=ICONS[item.icon],active=pathname===item.href||pathname.startsWith(item.href+"/");
    return <li key={item.href}><Link href={item.href} aria-current={active?"page":undefined} className={cn("relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-[10px] font-medium",active?"text-[#087f5b] bg-emerald-50":"text-slate-500")}><Icon className="size-5" aria-hidden="true"/>{item.label}{item.href==="/more"&&unread>0?<span className="absolute right-2 top-0 rounded-full bg-red-600 px-1 text-white">{unread}</span>:null}</Link></li>;
  })}</ul></nav>;
}
