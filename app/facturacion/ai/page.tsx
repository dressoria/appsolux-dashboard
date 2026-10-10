import { redirect } from "next/navigation";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { routes } from "@/config/routes";
import { AiInvoicingClient } from "./ai-invoicing-client";

export default async function AiInvoicingPage() {
  const { tenant } = await requireDashboardSession();
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canAccessAiInvoicing) {
    redirect(routes.facturacion);
  }

  return (
    <DashboardShell
      mainClassName="px-4 py-5 sm:px-6 sm:py-6"
      contentClassName="mx-auto max-w-5xl"
    >
      <AiInvoicingClient />
    </DashboardShell>
  );
}
