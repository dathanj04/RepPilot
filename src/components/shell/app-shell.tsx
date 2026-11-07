import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canManageOrg, canViewTeam } from "@/lib/permissions";
import { logoutAction } from "@/lib/actions";
import { BottomNav, SideNav, type NavItem } from "./nav";

export async function AppShell({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await requireAppUser();
  const unread = await prisma.notification.count({
    where: { userId: user.id, organizationId: user.organizationId, readAt: null },
  });
  const items: NavItem[] = [
    { href: "/today", label: "Dashboard", icon: "today" },
    { href: "/map", label: "My Territory", icon: "map" },
    { href: "/accounts", label: "Accounts", icon: "accounts" },
    { href: "/route", label: "Route Planner", icon: "route" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/meetings", label: "Meeting Requests", icon: "meetings" },
    { href: "/lunches", label: "Lunch & Learns", icon: "lunches" },
    { href: "/tasks", label: "Activities", icon: "tasks" },
    { href: "/reports", label: "Reports", icon: "spending" },
    { href: "/settings", label: "Settings", icon: "settings" },
  ];
  if (canViewTeam(user.roleKey)) items.push({ href: "/manager", label: "Team", icon: "admin" });
  if (canManageOrg(user.roleKey) || user.roleKey === "COMPLIANCE_ADMIN") {
    items.push({ href: "/admin", label: "Admin", icon: "admin" });
  }
  items.push({ href: "/more", label: "More", icon: "more" });

  return (
    <div className="h-dvh overflow-hidden bg-[#F5F7FA] text-[#14243A]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col bg-[#10263E] text-white md:flex">
        <Link href="/today" className="px-5 pt-6 pb-2">
          <p className="text-lg font-semibold tracking-tight">RepPilot AI</p>
          <p className="text-xs text-white/60">Less admin. More territory.</p>
        </Link>
        <SideNav items={items} />
        <form action={logoutAction} className="p-3">
          <button className="h-10 w-full rounded-xl text-left px-3 text-sm text-white/70 hover:bg-white/10" type="submit">
            Sign out
          </button>
        </form>
      </aside>
      <div className="flex h-dvh flex-col md:pl-64">
        <header className="z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
          <div>
            <p className="text-sm font-semibold text-[#10263E]">{user.organizationName}</p>
            <p className="text-xs text-[#66758B]">{user.name}</p>
          </div>
          <Link href="/notifications" className="relative rounded-full bg-[#F5F7FA] px-3 py-1.5 text-xs font-medium">
            Alerts
            {unread > 0 ? <span className="ml-2 rounded-full bg-[#D94B4B] px-1.5 text-white">{unread}</span> : null}
          </Link>
        </header>
        {user.isDemo ? (
          <p className="bg-[#10263E] px-4 py-2 text-center text-xs text-white">
            Demonstration organization. Offices, lunches, and spending are fictional.
          </p>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">{children}</div>
      </div>
      <BottomNav unread={unread} />
    </div>
  );
}
