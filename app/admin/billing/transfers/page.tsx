import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BankTransferAdminTable } from "@/components/appsolux/admin/bank-transfer-admin-table";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { assertBillingReviewAdmin } from "@/lib/auth/billing-review-admin";
import { routes } from "@/config/routes";

export default async function AdminBillingTransfersPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesión requerida</h1>
          <p className="text-muted-foreground">Inicia sesión para revisar transferencias.</p>
        </div>
      </DashboardShell>
    );
  }

  try {
    assertBillingReviewAdmin(user);
  } catch {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Acceso denegado</h1>
          <p className="text-muted-foreground">
            Esta pantalla solo está disponible para administradores de revisión de pagos.
          </p>
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <Button asChild className="mb-3" size="sm" variant="ghost">
            <Link href={routes.adminBilling}>
              <ArrowLeft className="mr-2 size-4" />
              Admin Billing
            </Link>
          </Button>
          <p className="text-sm text-muted-foreground">Revisión de pagos</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Transferencias bancarias
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Revisa los comprobantes de transferencia enviados por los clientes, aprueba los pagos
            verificados y rechaza los que no correspondan.
          </p>
        </div>

        <BankTransferAdminTable />
      </div>
    </DashboardShell>
  );
}
