import Link from "next/link";
import { connection } from "next/server";
import { requireAppUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createTaskAction, toggleTaskAction } from "@/lib/actions";
import { formatDay } from "@/lib/format";

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
    <div className="mx-auto max-w-3xl space-y-4 px-4 py-5">
      <h1 className="text-2xl font-semibold">Follow-ups</h1>
      {notice ? <p className="rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">{notice}</p> : null}
      <form action={createTaskAction} className="grid gap-2 rounded-2xl bg-white p-4 ring-1 ring-slate-200">
        <input name="title" required placeholder="What needs to happen?" className="h-12 rounded-xl border px-3" />
        <select name="accountId" className="h-12 rounded-xl border px-3">
          <option value="">No office</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <input name="dueDate" type="date" className="h-12 rounded-xl border px-3" />
          <select name="priority" className="h-12 rounded-xl border px-3">
            <option value="NORMAL">Normal</option>
            <option value="HIGH">High</option>
          </select>
        </div>
        <button className="h-12 rounded-xl bg-[#10263E] font-medium text-white" type="submit">Add task</button>
      </form>
      {open.length === 0 ? <p className="text-sm text-[#66758B]">No open follow-ups.</p> : null}
      <ul className="space-y-2">
        {open.map((task) => (
          <li key={task.id} className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
            <p className="font-medium">{task.title}</p>
            <p className="text-sm text-[#66758B]">
              {task.account ? <Link className="underline" href={`/accounts/${task.account.id}`}>{task.account.name}</Link> : "No office"}
              {task.dueDate ? ` · ${formatDay(task.dueDate, user.timezone)}` : " · No date"}
              {task.priority === "HIGH" ? " · High" : ""}
            </p>
            <form action={toggleTaskAction} className="mt-2">
              <input type="hidden" name="id" value={task.id} />
              <button className="text-sm font-medium text-[#10263E] underline" type="submit">Mark done</button>
            </form>
          </li>
        ))}
      </ul>
      {done.length > 0 ? (
        <section>
          <h2 className="text-sm font-semibold">Completed</h2>
          <ul className="mt-2 space-y-2">
            {done.slice(0, 8).map((task) => (
              <li key={task.id} className="rounded-xl bg-white p-3 text-sm text-[#66758B] ring-1 ring-slate-200">
                {task.title}
                <form action={toggleTaskAction} className="inline">
                  <input type="hidden" name="id" value={task.id} />
                  <button className="ml-2 underline" type="submit">Reopen</button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
