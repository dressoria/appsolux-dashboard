import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTaxWithholdingMappings } from "@/lib/core/accounting-parameters";
import { TaxCodesClient } from "./tax-codes-client";

export default async function TaxCodesPage() {
  const { tenant } = await requireDashboardSession();
  const mappings = await getTaxWithholdingMappings(tenant.id);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad</p>
          <h1 className="text-3xl font-semibold tracking-tight">Códigos de retención</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Asocia cuentas contables a cada código de retención de IVA y Renta.
          </p>
        </div>
        <TaxCodesClient initialMappings={JSON.parse(JSON.stringify(mappings))} />
      </div>
    </DashboardShell>
  );
}
