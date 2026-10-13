import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getEcuadorSriDateParts } from "@/lib/core/sri-ecuador-date";
import { SRI_TAX_NAVIGATION } from "@/config/sri-tax-navigation";
import { TaxCenterClient, type TaxView } from "./tax-center-client";

export async function TaxPage({ view }: { view: TaxView }) {
  const { tenant } = await requireDashboardSession();
  const today = getEcuadorSriDateParts(new Date());
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Centro tributario SRI · {tenant.name}
            </p>
            <h1 className="text-2xl font-semibold tracking-tight">
              {
                SRI_TAX_NAVIGATION.find(
                  (item) =>
                    item.href ===
                    `/facturacion/sri${view === "summary" ? "" : view === "ats-summary" ? "/ats/summary" : `/${view}`}`,
                )?.title
              }
            </h1>
          </div>
          <Link
            className="text-sm font-medium text-blue-600 hover:underline"
            href="/facturacion/configuration/sri"
          >
            Configuración → SRI
          </Link>
        </div>
        <nav
          aria-label="Centro tributario SRI"
          className="flex gap-2 overflow-x-auto pb-2"
        >
          {SRI_TAX_NAVIGATION.map((item) => (
            <Link
              className="shrink-0 rounded-lg border px-3 py-2 text-sm hover:border-blue-400"
              key={item.href}
              href={item.href}
            >
              {item.title}
            </Link>
          ))}
        </nav>
        <TaxCenterClient
          view={view}
          initialYear={Number(today.year)}
          initialMonth={Number(today.month)}
        />
      </div>
    </DashboardShell>
  );
}
