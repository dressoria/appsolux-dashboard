import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getCostExpenseConcepts } from "@/lib/core/accounting-concepts";
import { CostsExpensesClient } from "./costs-expenses-client";

export default async function CostsExpensesPage() {
  const { tenant } = await requireDashboardSession();
  const concepts = await getCostExpenseConcepts(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad</p>
          <h1 className="text-3xl font-semibold tracking-tight">Costos y gastos</h1>
        </div>
        <CostsExpensesClient initialConcepts={JSON.parse(JSON.stringify(concepts))} />
      </div>
    </DashboardShell>
  );
}
