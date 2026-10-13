import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import {
  TREASURY_NAVIGATION,
  type TreasuryView,
} from "@/config/treasury-navigation";
import { TreasuryClient } from "./treasury-client";

export async function TreasuryPage({ view }: { view: TreasuryView }) {
  const { tenant } = await requireDashboardSession();
  const item = TREASURY_NAVIGATION.flatMap((group) => [...group.items]).find(
    (entry) => entry.view === view,
  );
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Tesorería · {tenant.name}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            {item?.title ?? "Resumen de Tesorería"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuentas, dinero disponible y obligaciones de tu empresa.
          </p>
        </div>
        <nav aria-label="Tesorería" className="flex flex-wrap gap-2">
          <Link
            className="rounded-lg border px-3 py-2 text-sm"
            href="/facturacion/treasury"
          >
            Resumen
          </Link>
          {TREASURY_NAVIGATION.map((group) => (
            <details
              key={group.title}
              className="relative rounded-lg border bg-background px-3 py-2 text-sm"
            >
              <summary className="cursor-pointer">{group.title}</summary>
              <div className="mt-2 grid gap-2">
                {group.items.map((entry) => (
                  <Link
                    aria-current={entry.view === view ? "page" : undefined}
                    className="whitespace-nowrap text-blue-600 hover:underline"
                    href={entry.href}
                    key={entry.href}
                  >
                    {entry.title}
                  </Link>
                ))}
              </div>
            </details>
          ))}
        </nav>
        <TreasuryClient key={view} view={view} />
      </div>
    </DashboardShell>
  );
}
