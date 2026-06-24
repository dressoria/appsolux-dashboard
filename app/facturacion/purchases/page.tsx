import ErpPurchasesPage from "@/app/erp/purchases/page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

export default async function FacturacionPurchasesPage() {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <ErpPurchasesPage />;
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Facturacion</p>
          <h1 className="text-3xl font-semibold tracking-tight">Compras no disponibles</h1>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Las compras forman parte de Gestion Empresarial y se habilitan cuando ese motor esta activo.
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
