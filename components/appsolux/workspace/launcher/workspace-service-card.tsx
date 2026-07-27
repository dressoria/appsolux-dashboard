import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const toneClasses = {
  facturacion: {
    shell:
      "border-[#588100]/15 bg-gradient-to-br from-[#588100]/10 via-white to-[#8db600]/10 shadow-[#588100]/10 hover:border-[#588100]/30 hover:shadow-[#588100]/20",
    icon: "bg-gradient-to-br from-[#588100] to-[#8db600] text-white ring-4 ring-[#588100]/10",
    accent: "from-[#588100] via-[#8db600] to-[#8db600]",
    arrow: "group-hover:text-[#588100]",
    cta: "text-[#588100]",
    tag: "border-[#588100]/15 bg-[#588100]/8 text-[#588100]",
  },
  chats: {
    shell:
      "border-[#7f00b2]/15 bg-gradient-to-br from-[#7f00b2]/10 via-white to-[#bc4ed8]/10 shadow-[#7f00b2]/10 hover:border-[#7f00b2]/30 hover:shadow-[#7f00b2]/15",
    icon: "bg-gradient-to-br from-[#7f00b2] to-[#bc4ed8] text-white ring-4 ring-[#7f00b2]/10",
    accent: "from-[#7f00b2] via-[#bc4ed8] to-[#bc4ed8]",
    arrow: "group-hover:text-[#7f00b2]",
    cta: "text-[#7f00b2]",
    tag: "border-[#7f00b2]/15 bg-[#7f00b2]/8 text-[#7f00b2]",
  },
  mixed: {
    shell:
      "border-slate-200 bg-gradient-to-br from-[#588100]/8 via-white to-[#bc4ed8]/10 shadow-slate-200/60 hover:border-slate-300 hover:shadow-slate-300/60",
    icon: "bg-gradient-to-br from-[#588100] via-[#8db600] to-[#7f00b2] text-white ring-4 ring-[#7f00b2]/10",
    accent: "from-[#588100] via-[#8db600] to-[#7f00b2]",
    arrow: "group-hover:text-[#7f00b2]",
    cta: "text-[#7f00b2]",
    tag: "border-slate-200 bg-white/90 text-slate-600",
  },
  reports: {
    shell:
      "border-slate-800/10 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 text-white shadow-slate-950/20 hover:border-slate-800/20 hover:shadow-slate-950/25",
    icon: "bg-white/10 text-white ring-4 ring-white/10",
    accent: "from-[#8db600] via-[#588100] to-white/30",
    arrow: "group-hover:text-white",
    cta: "text-white",
    tag: "border-white/10 bg-white/10 text-slate-200",
  },
} as const;

export function WorkspaceServiceCard({
  icon: Icon,
  title,
  description,
  tags,
  badge,
  eyebrow,
  ctaLabel,
  href,
  tone,
  featured = false,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  tags: string[];
  badge?: string;
  eyebrow?: string;
  ctaLabel: string;
  href: string;
  tone: keyof typeof toneClasses;
  featured?: boolean;
  className?: string;
}) {
  const currentTone = toneClasses[tone];

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex h-full flex-col gap-6 overflow-hidden rounded-[30px] border p-8 shadow-xl backdrop-blur-sm transition-all duration-300 hover:-translate-y-1.5",
        currentTone.shell,
        featured && "lg:p-10",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r opacity-70 transition-opacity duration-300 group-hover:opacity-100",
          currentTone.accent
        )}
      />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.7),transparent_38%)] opacity-70" />

      <div className="flex items-start justify-between gap-4">
        <div className={cn("rounded-[22px] p-3.5", currentTone.icon)}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-2">
          {badge ? (
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold",
                tone === "reports"
                  ? "border-white/10 bg-white/10 text-slate-100"
                  : "border-white/70 bg-white/80 text-slate-700"
              )}
            >
              {badge}
            </span>
          ) : null}
          <ArrowRight
            className={cn(
              "mt-1 h-4 w-4 text-slate-300 transition-all duration-300 group-hover:translate-x-0.5",
              currentTone.arrow
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        {eyebrow ? (
          <p className={cn("text-xs font-semibold uppercase tracking-[0.2em]", tone === "reports" ? "text-slate-300" : "text-slate-500")}>
            {eyebrow}
          </p>
        ) : null}
        <h3 className={cn("text-xl font-black", tone === "reports" ? "text-white" : "text-slate-950")}>
          {title}
        </h3>
        <p className={cn("text-sm leading-6", tone === "reports" ? "text-slate-300" : "text-slate-600")}>
          {description}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span
            key={tag}
            className={cn(
              "inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium",
              currentTone.tag
            )}
          >
            {tag}
          </span>
        ))}
      </div>

      <div className={cn("mt-auto flex items-center justify-between gap-4", tone === "reports" ? "text-white" : "text-slate-700")}>
        <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", currentTone.cta)}>
          {ctaLabel}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
        </span>
        {featured ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-white/70 bg-white/85 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            <Sparkles className="h-3 w-3" />
            Recomendado
          </span>
        ) : null}
      </div>
    </Link>
  );
}
