import Image from "next/image";

/** One shared mark for navigation, public pages, and authentication. */
export function BrandMark({ className = "size-10" }: { className?: string }) {
  return <Image src="/brand/reppilot-mark-v1.png" alt="" width={40} height={40} className={`shrink-0 rounded-xl ${className}`} />;
}

export function BrandLogo() {
  return <span className="inline-flex items-center gap-2.5 font-semibold tracking-tight"><BrandMark className="size-9" /><span>RepPilot</span></span>;
}
