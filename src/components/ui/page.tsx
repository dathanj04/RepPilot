import type { ReactNode } from "react";

export function PageFrame({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-5 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#10263E] md:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 max-w-2xl text-sm leading-6 text-[#66758B]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200">
      <p className="text-2xl font-semibold tracking-tight text-[#10263E]">{value}</p>
      <p className="mt-1 text-sm font-medium text-[#14243A]">{label}</p>
      {hint ? <p className="mt-1 text-xs text-[#66758B]">{hint}</p> : null}
    </div>
  );
}
