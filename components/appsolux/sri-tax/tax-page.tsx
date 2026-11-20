import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getEcuadorSriDateParts } from "@/lib/core/sri-ecuador-date";
import { SRI_TAX_NAVIGATION } from "@/config/sri-tax-navigation";
import { TaxCenterClient, type TaxView } from "./tax-center-client";
import { TaxNavigation } from "./tax-navigation";
import styles from "./sri-center.module.css";

export async function TaxPage({ view }: { view: TaxView }) {
  const { tenant } = await requireDashboardSession();
  const today = getEcuadorSriDateParts(new Date());
  return (
    <DashboardShell>
      <div className={`${styles.center} space-y-6`}>
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
        <TaxNavigation activeHref={`/facturacion/sri${view === "summary" ? "" : view === "ats-summary" ? "/ats/summary" : `/${view}`}`} />
        <TaxCenterClient
          view={view}
          initialYear={Number(today.year)}
          initialMonth={Number(today.month)}
        />
      </div>
    </DashboardShell>
  );
}
