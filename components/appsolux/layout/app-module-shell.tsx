import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { routes } from "@/config/routes";

type NavItem = { title: string; href: string };

type AppModuleShellProps = {
  appName: string;
  appDescription: string;
  badge?: string;
  badgeVariant?: "slate" | "blue" | "emerald" | "amber" | "violet";
  backHref?: string;
  backLabel?: string;
  navItems?: NavItem[];
  activeHref?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
};

const badgeClasses: Record<string, string> = {
  slate: "border-slate-200 bg-slate-50 text-slate-600",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
};

export function AppModuleShell({
  appName,
  appDescription,
  badge,
  badgeVariant = "slate",
  backHref = routes.workspace,
  backLabel = "Volver a mis apps",
  navItems,
  activeHref,
  action,
  children,
}: AppModuleShellProps) {
  return (
    <DashboardShell>
      <div className="space-y-5">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition hover:text-foreground"
        >
          ← {backLabel}
        </Link>

        <div className="rounded-lg border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              {badge && (
                <span
                  className={`mb-2 inline-flex h-6 items-center rounded-full border px-2 text-xs font-medium ${badgeClasses[badgeVariant]}`}
                >
                  {badge}
                </span>
              )}
              <h1 className="text-2xl font-semibold tracking-tight">{appName}</h1>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{appDescription}</p>
            </div>
            {action && <div className="shrink-0">{action}</div>}
          </div>

          {navItems && navItems.length > 0 && (
            <nav className="mt-5 flex gap-1 overflow-x-auto border-t pt-4 pb-0.5">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`shrink-0 rounded-md px-3 py-1.5 text-sm transition ${
                    activeHref === item.href
                      ? "bg-primary text-primary-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {item.title}
                </Link>
              ))}
            </nav>
          )}
        </div>

        {children}
      </div>
    </DashboardShell>
  );
}
