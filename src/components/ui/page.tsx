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
    <div className="mobile-page mx-auto w-full max-w-7xl px-5 py-6 md:px-8 md:py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-[-0.025em] text-[#10263E] md:text-[28px]">{title}</h1>
          {subtitle ? <p className="mt-2 max-w-2xl text-sm leading-6 text-[#66758B]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-4 md:p-5">
      <p className="text-xs font-medium tracking-wide text-[#66758B]">{label}</p>
      <p className="mt-3 text-3xl md:text-[28px] font-semibold tracking-tight text-[#10263E] tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-xs text-[#66758B]">{hint}</p> : null}
    </div>
  );
}
