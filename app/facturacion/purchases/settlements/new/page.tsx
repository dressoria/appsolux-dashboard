import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { NewSettlementClient } from "./new-settlement-client";

export default async function NewSettlementPage() {
  await requireDashboardSession();

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-4xl">
      <NewSettlementClient />
    </DashboardShell>
  );
}
