import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

const toneClasses = {
  facturacion: {
    shell:
      "border-[#588100]/15 bg-white text-[#0d0f12] shadow-[0_12px_32px_rgba(88,129,0,0.08)] hover:border-[#588100] hover:bg-[#588100] hover:text-white hover:shadow-[0_16px_40px_rgba(88,129,0,0.18)]",
    icon: "bg-[#588100] text-white group-hover:bg-white/15",
    label: "text-[#588100] group-hover:text-white/80",
    cta: "text-[#588100] group-hover:text-white",
  },
  neutral: {
    shell:
      "border-slate-200 bg-white text-[#0d0f12] shadow-[0_12px_28px_rgba(15,23,42,0.06)] hover:border-[#588100] hover:bg-[#588100] hover:text-white hover:shadow-[0_16px_40px_rgba(88,129,0,0.16)]",
    icon: "bg-slate-100 text-slate-700 group-hover:bg-white/15 group-hover:text-white",
    label: "text-slate-500 group-hover:text-white/80",
    cta: "text-slate-900 group-hover:text-white",
  },
  soon: {
    shell:
      "border-slate-200 bg-slate-50/80 text-[#0d0f12] shadow-[0_14px_32px_rgba(15,23,42,0.04)]",
    icon: "bg-white text-slate-500",
    label: "text-slate-400",
    cta: "text-slate-500",
    chip: "border-slate-200 bg-white text-slate-500",
  },
} as const;

type WorkspaceServiceCardProps = {
  icon: LucideIcon;
  title: string;
  description: string;
  eyebrow?: string;
  ctaLabel: string;
  href?: string;
  tone: keyof typeof toneClasses;
  disabled?: boolean;
  className?: string;
};

function WorkspaceServiceCardInner({
  icon: Icon,
  title,
  description,
  eyebrow,
  ctaLabel,
  tone,
}: Omit<WorkspaceServiceCardProps, "href" | "disabled" | "className">) {
  const currentTone = toneClasses[tone];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className={cn("rounded-[18px] p-2.5 transition-colors", currentTone.icon)}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-300 transition-colors group-hover:text-white" />
      </div>

      <div className="space-y-1.5">
        {eyebrow ? (
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", currentTone.label)}>
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-xl font-black tracking-tight">{title}</h3>
        <p className="text-sm leading-5 text-slate-600 group-hover:text-white/82">{description}</p>
      </div>

      <div className={cn("mt-auto inline-flex items-center gap-2 text-sm font-semibold", currentTone.cta)}>
        {ctaLabel}
      </div>
    </>
  );
}

export function WorkspaceServiceCard({
  href,
  disabled = false,
  className,
  ...props
}: WorkspaceServiceCardProps) {
  const shellClassName = cn(
    "flex h-full min-h-[220px] flex-col gap-5 rounded-[24px] border p-5 transition-all duration-300",
    toneClasses[props.tone].shell,
    !disabled && "hover:-translate-y-0.5",
    disabled && "cursor-default opacity-90",
    className
  );

  if (disabled || !href) {
    return (
      <div className={shellClassName}>
        <WorkspaceServiceCardInner {...props} />
      </div>
    );
  }

  return (
    <Link href={href} className={cn(shellClassName, "group")}>
      <WorkspaceServiceCardInner {...props} />
    </Link>
  );
}
