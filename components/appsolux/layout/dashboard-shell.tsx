import type { ReactNode } from "react";
import Link from "next/link";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { isClerkAuth } from "@/lib/auth/provider";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { DashboardFrame } from "./dashboard-frame";
import { buildSidebarNavigation } from "./sidebar";
import { getTenantOperationalAccess } from "@/lib/core/tenant-operational-access";
import { getStripeBillingAvailability } from "@/lib/core/billing/stripe-config";

type DashboardShellProps = {
  children: ReactNode;
  hideTopbar?: boolean;
  mainClassName?: string;
  contentClassName?: string;
};

export async function DashboardShell({
  children,
  hideTopbar = false,
  mainClassName = "px-6 py-8",
  contentClassName = "mx-auto max-w-6xl",
}: DashboardShellProps) {
  const { user, tenant } = await requireDashboardSession();
  const [tenantMode, operationalAccess] = await Promise.all([
    getTenantModeState(tenant),
    getTenantOperationalAccess(tenant.id),
  ]);
  const navigationGroups = buildSidebarNavigation(tenantMode);
  const stripeAvailable = getStripeBillingAvailability().configured;
  const userName = user.name?.trim() || "Usuario";
  const tenantName = tenant.name?.trim() || "Tu empresa";

  return (
    <DashboardFrame
      hideTopbar={hideTopbar}
      mainClassName={mainClassName}
      contentClassName={contentClassName}
      userName={userName}
      tenantName={tenantName}
      modeLabel={
        operationalAccess.effectiveStatus === "suspended"
          ? "Plan requerido"
          : operationalAccess.effectiveStatus === "past_due"
            ? "Pago pendiente"
            : tenantMode.subscriptionStatus === "trialing" && operationalAccess.trialDaysRemaining
              ? `Prueba gratuita · ${operationalAccess.trialDaysRemaining} días`
              : tenantMode.planKey === "enterprise"
                ? "Empresarial"
                : tenantMode.planKey === "pro"
                  ? "Negocio"
                  : "Básico"
      }
      navigationGroups={navigationGroups}
      clerkActive={isClerkAuth()}
    >
      {operationalAccess.effectiveStatus === "suspended" ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold">
              {operationalAccess.reason === "trial_expired" ? "Tu prueba terminó" : "Plan requerido"}
            </p>
            <p>
              {stripeAvailable
                ? "Elige un plan para continuar usando Facturom."
                : "Los pagos en línea aún no están disponibles. Nuestro equipo puede ayudarte a continuar."}
            </p>
          </div>
          <Link className="font-semibold text-primary underline-offset-4 hover:underline" href={stripeAvailable ? "/billing" : "/contacto"}>
            {stripeAvailable ? "Ver planes" : "Contactar soporte"}
          </Link>
        </div>
      ) : operationalAccess.effectiveStatus === "past_due" && operationalAccess.graceEndsAt ? (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
          No pudimos procesar tu pago. Actualiza tu método de pago antes del{" "}
          {new Intl.DateTimeFormat("es-EC").format(operationalAccess.graceEndsAt)}.
        </div>
      ) : null}
      {children}
    </DashboardFrame>
  );
}
