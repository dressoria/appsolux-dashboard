import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

export function WorkspaceServiceCard({
  icon: Icon,
  title,
  description,
  detail,
  href,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  detail?: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group relative flex flex-col gap-6 overflow-hidden rounded-[28px] border border-slate-100 bg-white/90 p-8 shadow-sm backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5 hover:border-blue-200 hover:shadow-2xl hover:shadow-blue-100/60"
    >
      {/* Top accent line — appears on hover */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-[#004080] to-[#007BFF] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

      <div className="flex items-start justify-between gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-900/10 to-blue-500/10 p-3.5 ring-1 ring-blue-900/10">
          <Icon className="h-6 w-6 text-[#004080]" />
        </div>
        <ArrowRight className="mt-1 h-4 w-4 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5 group-hover:text-[#007BFF]" />
      </div>

      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        <p className="text-sm leading-6 text-slate-500">{description}</p>
        {detail && (
          <p className="text-xs text-slate-400">{detail}</p>
        )}
      </div>
    </Link>
  );
}
