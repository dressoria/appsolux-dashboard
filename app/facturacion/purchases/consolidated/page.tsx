import { PurchasesImportTabs } from "@/components/appsolux/sri-tax/purchases-import-tabs";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { PurchasesConsolidatedClient } from "./purchases-consolidated-client";

export default async function PurchasesConsolidatedPage() {
  await requireDashboardSession();
  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-7xl">
      <PurchasesImportTabs activeHref="/facturacion/purchases/consolidated" />
      <PurchasesConsolidatedClient />
    </DashboardShell>
  );
}
