import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const statusClasses = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  info: "border-sky-200 bg-sky-50 text-sky-700",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border-amber-200 bg-amber-50 text-amber-700",
  danger: "border-rose-200 bg-rose-50 text-rose-700",
} as const;

export function SaleStatusBadge({
  label,
  variant = "neutral",
}: {
  label: string;
  variant?: keyof typeof statusClasses;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        statusClasses[variant]
      )}
    >
      {label}
    </span>
  );
}

export function SalesMetricCard({
  icon: Icon,
  label,
  value,
  helper,
  tone = "neutral",
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  helper: string;
  tone?: "neutral" | "info" | "success" | "warning";
}) {
  const toneClasses = {
    neutral: "bg-slate-100 text-slate-700",
    info: "bg-sky-100 text-sky-700",
    success: "bg-emerald-100 text-emerald-700",
    warning: "bg-amber-100 text-amber-700",
  }[tone];

  return (
    <Card className="rounded-[26px] border-slate-200 bg-white py-0 shadow-sm">
      <CardHeader className="px-5 pt-5">
        <div className="flex items-start justify-between gap-3">
          <div className={cn("rounded-2xl p-3", toneClasses)}>
            <Icon className="h-5 w-5" />
          </div>
          <SaleStatusBadge
            label={tone === "warning" ? "Atencion" : tone === "success" ? "Activo" : "Resumen"}
            variant={tone === "warning" ? "warning" : tone === "success" ? "success" : "info"}
          />
        </div>
        <CardDescription className="pt-4 text-sm text-slate-500">{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1 px-5 pb-5">
        <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs leading-5 text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function SalesQuickAction({
  href,
  title,
  description,
  icon: Icon,
}: {
  href: string;
  title: string;
  description: string;
  icon: LucideIcon;
}) {
  return (
    <Link
      href={href}
      className="group rounded-[24px] border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-sky-700" />
      </div>
      <div className="mt-4 space-y-1">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </Link>
  );
}

export function CheckoutModeCard({
  title,
  description,
  selected,
  icon: Icon,
  status,
  onSelect,
}: {
  title: string;
  description: string;
  selected: boolean;
  icon: LucideIcon;
  status: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-[24px] border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
        selected ? "border-sky-300 ring-2 ring-sky-100" : "border-slate-200"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
          <Icon className="h-5 w-5" />
        </div>
        <SaleStatusBadge label={status} variant={selected ? "info" : "neutral"} />
      </div>
      <div className="mt-4 space-y-1">
        <p className="font-medium text-slate-900">{title}</p>
        <p className="text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </button>
  );
}

export function SaleCompletionPanel({
  title,
  description,
  badges,
  primaryHref,
  primaryLabel,
  secondaryHref,
  secondaryLabel,
}: {
  title: string;
  description: string;
  badges: Array<{ label: string; variant?: keyof typeof statusClasses }>;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref?: string;
  secondaryLabel?: string;
}) {
  return (
    <Card className="rounded-[28px] border-slate-200 bg-white py-0 shadow-sm">
      <CardHeader className="px-6 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          {badges.map((badge) => (
            <SaleStatusBadge
              key={badge.label}
              label={badge.label}
              variant={badge.variant ?? "info"}
            />
          ))}
        </div>
        <CardTitle className="pt-2 text-slate-900">{title}</CardTitle>
        <CardDescription className="text-sm leading-6 text-slate-600">
          {description}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3 px-6 pb-6">
        <Button asChild>
          <Link href={primaryHref}>{primaryLabel}</Link>
        </Button>
        {secondaryHref && secondaryLabel ? (
          <Button asChild variant="outline">
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
