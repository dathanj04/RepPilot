import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTaskAction, toggleTaskAction } from "@/lib/actions";
import { formatDay } from "@/lib/format";
import { PageFrame } from "@/components/ui/page";

export const instant = false;
export const metadata = { title: "Tasks" };

export default async function TasksPage({ searchParams }: { searchParams: Promise<{ notice?: string }> }) {
  await connection();
  const { notice } = await searchParams;
  const user = await requireAppUser();
  const [tasks, accounts] = await Promise.all([
    prisma.followUpTask.findMany({
      where: { organizationId: user.organizationId, ownerId: user.id },
      include: { account: true },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
    }),
    prisma.account.findMany({
      where: { organizationId: user.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  const open = tasks.filter((task) => task.status === "OPEN");
  const done = tasks.filter((task) => task.status === "DONE");

  return (
    <PageFrame title="Tasks" subtitle="Follow-ups stay short. Add an office, a date, and a priority, then mark them done from the field.">
      {notice ? <p className="mb-4 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      <div className="grid gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <form action={createTaskAction} className="grid h-fit gap-2 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
          <h2 className="font-semibold text-[#10263E]">New follow-up</h2>
          <input name="title" required placeholder="What needs to happen?" className="h-12 rounded-xl border border-slate-200 px-3" />
          <select name="accountId" className="h-12 rounded-xl border border-slate-200 px-3">
            <option value="">No office</option>
            {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
          <input name="dueDate" type="date" aria-label="Due date" className="h-12 rounded-xl border border-slate-200 px-3" />
          <select name="priority" aria-label="Priority" className="h-12 rounded-xl border border-slate-200 px-3">
            <option value="NORMAL">Normal priority</option>
            <option value="HIGH">High priority</option>
          </select>
          <button className="h-12 rounded-xl bg-[#10263E] font-medium text-white" type="submit">Add task</button>
        </form>
        <div className="space-y-4">
          {open.length === 0 ? <p className="rounded-2xl bg-white p-4 text-sm text-[#66758B] ring-1 ring-slate-200">No open follow-ups.</p> : null}
          <ul className="space-y-2">
            {open.map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
                <div>
                  <p className="font-medium text-[#10263E]">{task.title}</p>
                  <p className="text-sm text-[#66758B]">
                    {task.account ? <Link className="font-medium text-[#10263E]" href={`/accounts/${task.account.id}`}>{task.account.name}</Link> : "No office"}
                    {task.dueDate ? ` · due ${formatDay(task.dueDate, user.timezone)}` : " · No date"}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${task.priority === "HIGH" ? "bg-[#D94B4B] text-white" : "bg-[#F5F7FA] text-[#66758B]"}`}>{task.priority === "HIGH" ? "High" : "Normal"}</span>
                  <form action={toggleTaskAction}>
                    <input type="hidden" name="id" value={task.id} />
                    <button className="h-10 rounded-xl bg-[#19B78A] px-3 text-sm font-semibold text-[#06281f]" type="submit">Done</button>
                  </form>
                </div>
              </li>
            ))}
          </ul>
          {done.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold text-[#10263E]">Completed</h2>
              <ul className="mt-2 space-y-2">
                {done.slice(0, 8).map((task) => (
                  <li key={task.id} className="flex items-center justify-between rounded-xl bg-white p-3 text-sm text-[#66758B] ring-1 ring-slate-200">
                    <span className="line-through">{task.title}</span>
                    <form action={toggleTaskAction}>
                      <input type="hidden" name="id" value={task.id} />
                      <button className="h-9 rounded-xl px-3 font-medium text-[#10263E] ring-1 ring-slate-200" type="submit">Reopen</button>
                    </form>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      </div>
    </PageFrame>
  );
}
