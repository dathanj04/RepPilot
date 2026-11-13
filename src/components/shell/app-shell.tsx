import Link from "next/link";
import { Bell, Compass, LogOut, Plus } from "lucide-react";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageOrg, canViewTeam } from "@/lib/permissions";
import { logoutAction } from "@/lib/actions";
import { BottomNav, SideNav, type NavItem } from "./nav";

export async function AppShell({ children, allowExpiredTrial = false }: { children: React.ReactNode; allowExpiredTrial?: boolean }) {
  await connection();
  const user = await requireAppUser({ allowExpiredTrial });
  const unread = user.trialDaysLeft === 0 ? 0 : await prisma.notification.count({
    where: { userId: user.id, organizationId: user.organizationId, readAt: null },
  });
  const items: NavItem[] = [
    { href: "/today", label: "Today", icon: "today" },
    { href: "/map", label: "Territory", icon: "map" },
    { href: "/accounts", label: "Accounts", icon: "accounts" },
    { href: "/route", label: "Route Planner", icon: "route" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/meetings", label: "Meeting Requests", icon: "meetings" },
    { href: "/lunches", label: "Lunch & Learns", icon: "lunches" },
    { href: "/tasks", label: "Activities", icon: "tasks" },
    { href: "/reports", label: "Reports", icon: "spending" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ];
  items.splice(items.findIndex((item) => item.href === "/settings"), 0, { href: "/billing", label: "Billing", icon: "billing" });
  if (canViewTeam(user.roleKey)) items.push({ href: "/manager", label: "Team", icon: "admin" });
  if (canManageOrg(user.roleKey) || user.roleKey === "COMPLIANCE_ADMIN") {
    items.push({ href: "/admin", label: "Admin", icon: "admin" });
  }
  items.push({ href: "/more", label: "More", icon: "more" });

  return (
    <div className="h-dvh overflow-hidden bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col overflow-y-auto border-r border-white/5 bg-[#0c2035] text-white md:flex">
        <Link href="/today" className="flex items-center gap-3 px-6 py-7">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#b5f4dd] text-[#10263E]"><Compass className="size-6" aria-hidden="true" /></span>
          <span><span className="block text-xl font-semibold tracking-tight">RepPilot</span><span className="mt-0.5 block text-[11px] text-slate-400">Territory management</span></span>
        </Link>
        <SideNav items={items} />
        <form action={logoutAction} className="border-t border-white/10 p-3">
          <button className="flex h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm text-slate-300 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-[#b5f4dd]" type="submit">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
        </form>
      </aside>
      <div className="flex h-dvh flex-col md:pl-64">
        <header className="app-mobile-header z-30 flex h-20 shrink-0 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl md:px-8">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#10263E] truncate">{user.organizationName}</p>
            <p className="text-xs text-[#66758B] truncate">{user.name}</p>
          </div>
          <div className="flex items-center gap-3">
          <Link href="/accounts/new" className="hidden h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium transition-colors hover:bg-slate-50 sm:inline-flex"><Plus className="size-4" aria-hidden="true" /> Add practice</Link>
          <Link href="/notifications" className="relative flex min-h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium hover:bg-slate-50">
            <Bell className="size-4" aria-hidden="true" /> Alerts
            {unread > 0 ? <span className="ml-2 rounded-full bg-[#D94B4B] px-1.5 text-white">{unread}</span> : null}
          </Link>
          </div>
        </header>
        {user.trialDaysLeft !== null && user.trialEndsAt ? <div role="status" className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-100 bg-emerald-50 px-5 py-2.5 text-xs text-emerald-950 md:px-8"><span><strong>{user.trialDaysLeft} {user.trialDaysLeft === 1 ? "day" : "days"} left</strong> in your free trial · Ends {new Date(user.trialEndsAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })} (UTC)</span><Link className="font-semibold underline underline-offset-2" href="/billing">Billing & trial</Link></div> : null}
        {user.isDemo ? (
          <p className="border-b border-emerald-100 bg-emerald-50 px-4 py-2 text-center text-xs text-emerald-900">
            Demonstration organization. Offices, lunches, and spending are fictional.
          </p>
        ) : null}
        <div className="mobile-workspace min-h-0 flex-1 overflow-y-auto pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0">{children}</div>
      </div>
      <BottomNav unread={unread} />
    </div>
  );
}
