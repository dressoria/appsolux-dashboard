import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BankTransferForm } from "@/components/appsolux/billing/bank-transfer-form";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth/current-user";
import { isTenantOwner } from "@/lib/auth/permissions";
import { getBankTransferInfo } from "@/lib/core/billing/bank-transfer-service";
import { commercialPlans, type CommercialPlanCode } from "@/lib/core/billing/commercial-plans";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

const VALID_PLANS = new Set<string>(commercialPlans.map((p) => p.code));
const VALID_INTERVALS = new Set(["MONTHLY", "YEARLY"]);

export default async function BankTransferPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string; interval?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight">Inicia sesión</h1>
          <Button asChild>
            <Link href="/sign-in">Iniciar sesión</Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  await getCurrentTenant(user);

  if (!isTenantOwner(user)) {
    return (
      <DashboardShell>
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight">Permiso denegado</h1>
          <p className="text-muted-foreground">Solo el propietario de la empresa puede gestionar pagos.</p>
          <Button asChild variant="outline">
            <Link href="/billing">Volver a planes</Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const query = await searchParams;
  const planCode = query.plan?.toUpperCase();
  const intervalParam = query.interval?.toUpperCase();

  if (!planCode || !VALID_PLANS.has(planCode) || !intervalParam || !VALID_INTERVALS.has(intervalParam)) {
    return (
      <DashboardShell>
        <div className="space-y-3">
          <h1 className="text-3xl font-black tracking-tight">Plan no válido</h1>
          <p className="text-muted-foreground">Elige un plan desde la página de planes para continuar.</p>
          <Button asChild variant="outline">
            <Link href="/billing">Ver planes</Link>
          </Button>
        </div>
      </DashboardShell>
    );
  }

  const info = getBankTransferInfo(
    planCode as CommercialPlanCode,
    intervalParam as "MONTHLY" | "YEARLY",
  );

  return (
    <DashboardShell contentClassName="mx-auto max-w-2xl">
      <div className="space-y-8 pb-10">
        <div>
          <Button asChild className="mb-4" size="sm" variant="ghost">
            <Link href="/billing">
              <ArrowLeft className="mr-2 size-4" />
              Volver a planes
            </Link>
          </Button>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-facturom-primary">
            Pago por transferencia
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            {info.planDisplayName} — {info.billingInterval === "MONTHLY" ? "Mensual" : "Anual"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Realiza la transferencia, sube el comprobante y nuestro equipo activará tu plan.
          </p>
        </div>

        <BankTransferForm
          accountNumber={info.accountNumber}
          amount={info.amount}
          billingInterval={info.billingInterval}
          planCode={info.planCode}
          planDisplayName={info.planDisplayName}
        />
      </div>
    </DashboardShell>
  );
}
