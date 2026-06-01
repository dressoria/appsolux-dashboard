import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { SriCompanyForm } from "@/components/appsolux/sri/sri-company-form";
import type { SriCompanyFormProfile } from "@/components/appsolux/sri/sri-company-form";
import { getSriProfile } from "@/lib/core/sri";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { routes } from "@/config/routes";

export default async function SriCompanyPage() {
  const { tenant } = await requireDashboardSession();
  const profile = await getSriProfile(tenant.id);

  // Strip Date fields — only pass serializable primitives to the Client Component
  const initialProfile: SriCompanyFormProfile | null = profile
    ? {
        legalName: profile.legalName,
        tradeName: profile.tradeName,
        ruc: profile.ruc,
        environment: profile.environment,
        accountingRequired: profile.accountingRequired,
        specialTaxpayerNumber: profile.specialTaxpayerNumber,
        withholdingAgentResolution: profile.withholdingAgentResolution,
      }
    : null;

  return (
    <SriModuleShell
      title="Empresa y RUC"
      description="Datos tributarios del contribuyente para emision de comprobantes electronicos."
      activeHref={routes.sriCompany}
    >
      <SriCompanyForm initialProfile={initialProfile} />
    </SriModuleShell>
  );
}
