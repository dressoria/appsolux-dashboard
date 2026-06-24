import ErpAccountingPage from "@/app/erp/accounting/page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

export default async function FacturacionAccountingPage() {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (tenantMode.canUseAdvancedErp) {
    return <ErpAccountingPage />;
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Facturacion</p>
          <h1 className="text-3xl font-semibold tracking-tight">Contabilidad no disponible</h1>
        </div>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            La contabilidad forma parte del motor de Gestion Empresarial y no aparece como operacion activa en modo basico.
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
