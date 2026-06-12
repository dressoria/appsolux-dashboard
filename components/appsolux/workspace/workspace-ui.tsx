import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type StatusVariant = "active" | "pending" | "incomplete" | "locked" | "testing";

const badgeClasses: Record<StatusVariant, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  pending: "border-slate-200 bg-slate-100 text-slate-600",
  incomplete: "border-amber-200 bg-amber-50 text-amber-700",
  locked: "border-slate-200 bg-slate-50 text-slate-500",
  testing: "border-sky-200 bg-sky-50 text-sky-700",
};

export function StatusBadge({
  variant,
  label,
}: {
  variant: StatusVariant;
  label: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium",
        badgeClasses[variant]
      )}
    >
      {label}
    </span>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  description,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <div className={cn("space-y-2", align === "center" && "text-center")}>
      {eyebrow ? (
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
          {eyebrow}
        </p>
      ) : null}
      <div className="space-y-1">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <p className="max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <Card className="border-slate-200 bg-white shadow-sm">
      <CardHeader className="pb-2">
        <CardDescription className="text-slate-500">{label}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <p className="text-3xl font-semibold tracking-tight text-slate-900">{value}</p>
        <p className="text-xs text-slate-500">{helper}</p>
      </CardContent>
    </Card>
  );
}

export function QuickActionCard({
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
      className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="rounded-2xl bg-sky-100 p-2.5 text-sky-700">
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

export function AppCard({
  icon: Icon,
  title,
  description,
  features,
  status,
  href,
  actionLabel = "Abrir app",
  meta,
  priority = false,
  buttonVariant = "outline",
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  features: string[];
  status: ReactNode;
  href: string;
  actionLabel?: string;
  meta?: ReactNode;
  priority?: boolean;
  buttonVariant?: "default" | "outline";
}) {
  return (
    <Card
      className={cn(
        "h-full rounded-[28px] border-slate-200 bg-white py-0 shadow-sm transition hover:-translate-y-1 hover:shadow-lg",
        priority && "border-sky-200 bg-linear-to-br from-sky-50 via-white to-white"
      )}
    >
      <CardHeader className="gap-4 px-6 pt-6">
        <div className="flex items-start justify-between gap-3">
          <div className="rounded-2xl bg-sky-100 p-3 text-sky-700">
            <Icon className="h-5 w-5" />
          </div>
          {status}
        </div>
        <div className="space-y-2">
          <CardTitle className="text-lg text-slate-900">{title}</CardTitle>
          <CardDescription className="text-sm leading-6 text-slate-600">
            {description}
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 px-6 pb-0">
        <ul className="space-y-2">
          {features.slice(0, 5).map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
        {meta ? (
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
            {meta}
          </div>
        ) : null}
      </CardContent>
      <CardFooter className="mt-auto border-none bg-transparent px-6 py-6">
        <Button asChild variant={buttonVariant} className="w-full">
          <Link href={href}>{actionLabel}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
