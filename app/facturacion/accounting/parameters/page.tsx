import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getMappings } from "@/lib/core/accounting-parameters";
import { getActivePlan } from "@/lib/core/accounting-plan";
import { getPostableAccounts } from "@/lib/core/accounting-accounts";
import { ParametersClient } from "./parameters-client";

export default async function ParametersPage() {
  const { tenant } = await requireDashboardSession();
  const plan = await getActivePlan(tenant.id);
  const mappings = await getMappings(tenant.id);
  const accounts = plan ? await getPostableAccounts(tenant.id, plan.id) : [];

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad</p>
          <h1 className="text-3xl font-semibold tracking-tight">Parámetros contables</h1>
        </div>
        <ParametersClient
          initialMappings={JSON.parse(JSON.stringify(mappings))}
          accounts={JSON.parse(JSON.stringify(accounts))}
          hasPlan={!!plan}
        />
      </div>
    </DashboardShell>
  );
}
