import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";

const toneClasses = {
  facturacion: {
    shell:
      "border-transparent bg-facturom-primary text-white shadow-[0_14px_34px_rgba(59,10,103,0.2)] hover:bg-facturom-primary-soft",
    icon: "bg-white/15 text-white",
    label: "text-facturom-yellow",
    cta: "text-white",
  },
  chats: {
    shell:
      "border-transparent bg-[#eee5f7] text-facturom-text shadow-[0_12px_28px_rgba(59,10,103,0.09)] hover:bg-[#e4d4f3]",
    icon: "bg-facturom-primary-soft text-white",
    label: "text-facturom-primary-soft",
    cta: "text-facturom-primary",
  },
  automation: {
    shell:
      "border-transparent bg-[#fff6de] text-facturom-text shadow-[0_12px_28px_rgba(96,55,0,0.08)] hover:bg-[#ffefc2]",
    icon: "bg-facturom-accent text-facturom-primary-dark",
    label: "text-[#9a5600]",
    cta: "text-facturom-primary",
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
        <ArrowRight className="h-5 w-5 opacity-55 transition-transform group-hover:translate-x-1" />
      </div>

      <div className="space-y-1.5">
        {eyebrow ? (
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", currentTone.label)}>
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-xl font-black tracking-tight">{title}</h3>
        <p className="text-sm leading-5 opacity-70">{description}</p>
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
    "flex h-full min-h-[176px] flex-col gap-4 rounded-[24px] border p-5 transition-all duration-300",
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
