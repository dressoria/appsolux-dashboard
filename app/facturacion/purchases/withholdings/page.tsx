import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { WithholdingsClient } from "./withholdings-client";

export default async function FacturacionWithholdingsPage() {
  await requireDashboardSession();

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-7xl">
      <WithholdingsClient />
    </DashboardShell>
  );
}
