import Link from "next/link";

import { BillingImportsClient } from "@/components/appsolux/billing/billing-imports-client";
import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getPrismaClient } from "@/lib/db/prisma";

type Props = {
  searchParams: Promise<{ type?: string }>;
};

export default async function FacturacionImportsPage({ searchParams }: Props) {
  const { tenant } = await requireDashboardSession();
  const [tenantMode, params] = await Promise.all([
    getTenantModeState(tenant),
    searchParams,
  ]);

  const initialType = params.type === "customers" ? "customers" : "products";

  const history = await getPrismaClient().auditLog.findMany({
    where: {
      tenantId: tenant.id,
      action: "billing.import.confirm",
      entityType: "BillingImport",
    },
    orderBy: { createdAt: "desc" },
    take: 10,
    select: {
      id: true,
      createdAt: true,
      metadata: true,
    },
  });

  const normalizedHistory = history.map((entry) => {
    const metadata =
      entry.metadata && typeof entry.metadata === "object" && !Array.isArray(entry.metadata)
        ? (entry.metadata as Record<string, unknown>)
        : {};

    return {
      id: entry.id,
      createdAt: entry.createdAt.toISOString(),
      type: typeof metadata.type === "string" ? metadata.type : "unknown",
      totalRows: typeof metadata.totalRows === "number" ? metadata.totalRows : 0,
      created: typeof metadata.created === "number" ? metadata.created : 0,
      updated: typeof metadata.updated === "number" ? metadata.updated : 0,
      failed: typeof metadata.failed === "number" ? metadata.failed : 0,
    };
  });

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell mainClassName="" contentClassName="">
        <BasicModuleShell
          title="Cargas masivas"
          description="Importa productos y clientes en bloque cuando Gestión Empresarial está activa."
          activeHref={routes.facturacionImports}
          action={
            <Button asChild variant="outline" size="sm">
              <Link href={routes.facturacion}>Volver a Facturación</Link>
            </Button>
          }
        >
          <Card>
            <CardHeader>
              <CardTitle>Gestión Empresarial requerida</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-600">
              Las cargas masivas están disponibles en Gestión Empresarial.
            </CardContent>
          </Card>
        </BasicModuleShell>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell mainClassName="" contentClassName="">
      <BasicModuleShell
        title="Cargas masivas"
        description="Previsualiza e importa productos y clientes hacia el motor empresarial sin duplicar registros."
        activeHref={routes.facturacionImports}
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href={routes.facturacionProducts}>Productos</Link>
            </Button>
            <Button asChild variant="outline" size="sm">
              <Link href={routes.facturacionSettingsWarehouses}>Bodegas</Link>
            </Button>
          </div>
        }
      >
        <BillingImportsClient initialType={initialType} history={normalizedHistory} />
      </BasicModuleShell>
    </DashboardShell>
  );
}
