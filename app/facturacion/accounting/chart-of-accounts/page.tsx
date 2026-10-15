import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getActivePlan } from "@/lib/core/accounting-plan";
import { getAccountTree } from "@/lib/core/accounting-accounts";
import { ChartOfAccountsClient } from "./chart-of-accounts-client";

export default async function ChartOfAccountsPage() {
  const { tenant } = await requireDashboardSession();
  const plan = await getActivePlan(tenant.id);

  const accounts = plan ? await getAccountTree(tenant.id, plan.id) : [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad</p>
          <h1 className="text-3xl font-semibold tracking-tight">Plan de cuentas</h1>
        </div>
        <ChartOfAccountsClient
          initialAccounts={JSON.parse(JSON.stringify(accounts))}
          hasPlan={!!plan}
          planName={plan?.name ?? null}
        />
      </div>
    </DashboardShell>
  );
}
