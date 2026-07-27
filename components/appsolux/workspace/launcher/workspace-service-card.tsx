import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";

const toneClasses = {
  facturacion: {
    shell:
      "border-[#588100]/15 bg-white text-[#0d0f12] shadow-[0_18px_50px_rgba(88,129,0,0.10)] hover:border-[#588100]/30 hover:shadow-[0_22px_60px_rgba(88,129,0,0.14)]",
    icon: "bg-[#588100] text-white",
    label: "text-[#588100]",
    cta: "text-[#588100]",
    chip: "border-[#588100]/15 bg-[#588100]/6 text-[#588100]",
  },
  neutral: {
    shell:
      "border-slate-200 bg-white text-[#0d0f12] shadow-[0_16px_40px_rgba(15,23,42,0.06)] hover:border-slate-300 hover:shadow-[0_20px_52px_rgba(15,23,42,0.09)]",
    icon: "bg-slate-100 text-slate-700",
    label: "text-slate-500",
    cta: "text-slate-900",
    chip: "border-slate-200 bg-slate-50 text-slate-600",
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
  tags?: string[];
  badge?: string;
  eyebrow?: string;
  ctaLabel: string;
  href?: string;
  tone: keyof typeof toneClasses;
  featured?: boolean;
  disabled?: boolean;
  className?: string;
};

function WorkspaceServiceCardInner({
  icon: Icon,
  title,
  description,
  tags = [],
  badge,
  eyebrow,
  ctaLabel,
  tone,
  featured = false,
}: Omit<WorkspaceServiceCardProps, "href" | "disabled" | "className">) {
  const currentTone = toneClasses[tone];

  return (
    <>
      <div className="flex items-start justify-between gap-4">
        <div className={cn("rounded-[20px] p-3", currentTone.icon)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex items-center gap-2">
          {featured ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-[#588100]/15 bg-[#588100]/6 px-2.5 py-1 text-[11px] font-semibold text-[#588100]">
              <Sparkles className="h-3 w-3" />
              Principal
            </span>
          ) : null}
          {badge ? (
            <span className={cn("rounded-full border px-2.5 py-1 text-[11px] font-semibold", currentTone.chip)}>
              {badge}
            </span>
          ) : null}
        </div>
      </div>

      <div className="space-y-2">
        {eyebrow ? (
          <p className={cn("text-[11px] font-semibold uppercase tracking-[0.2em]", currentTone.label)}>
            {eyebrow}
          </p>
        ) : null}
        <h3 className="text-2xl font-black tracking-tight">{title}</h3>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>

      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <span
              key={tag}
              className={cn("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium", currentTone.chip)}
            >
              {tag}
            </span>
          ))}
        </div>
      ) : null}

      <div className={cn("mt-auto inline-flex items-center gap-2 text-sm font-semibold", currentTone.cta)}>
        {ctaLabel}
        <ArrowRight className="h-4 w-4" />
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
    "flex h-full flex-col gap-6 rounded-[28px] border p-7 transition-all duration-300",
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
