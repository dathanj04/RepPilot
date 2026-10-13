export function PublicShell({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto min-h-dvh max-w-lg px-4 py-8">
      <p className="text-sm font-semibold tracking-tight text-[#10263E]">RepPilot AI</p>
      <p className="mt-6 text-xs font-medium uppercase tracking-wide text-[#66758B]">{eyebrow}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">{title}</h1>
      <div className="mt-5">{children}</div>
    </main>
  );
}
