import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { SriCompanyForm } from "@/components/appsolux/sri/sri-company-form";
import type { SriCompanyFormProfile } from "@/components/appsolux/sri/sri-company-form";
import { getSriProfile } from "@/lib/core/sri";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { routes } from "@/config/routes";
import { getPrismaClient } from "@/lib/db/prisma";

export default async function SriCompanyPage() {
  const { tenant } = await requireDashboardSession();
  const prisma = getPrismaClient();
  const [profile, tenantProfile] = await Promise.all([
    getSriProfile(tenant.id),
    prisma.tenant.findUnique({
      where: { id: tenant.id },
      select: { name: true, legalName: true, taxIdentificationType: true, taxIdentificationValue: true, address: true },
    }),
  ]);

  // Strip Date fields — only pass serializable primitives to the Client Component
  const initialProfile: SriCompanyFormProfile | null = profile
    ? {
        legalName: profile.legalName,
        tradeName: profile.tradeName,
        ruc: profile.ruc,
        dirMatriz: profile.dirMatriz,
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
      <SriCompanyForm
        initialProfile={initialProfile}
        prefill={{
          identificationType: tenantProfile?.taxIdentificationType === "cedula" ? "cedula" : "ruc",
          legalName: tenantProfile?.legalName ?? "",
          tradeName: tenantProfile?.name ?? "",
          ruc: tenantProfile?.taxIdentificationType === "ruc" ? tenantProfile.taxIdentificationValue ?? "" : "",
          address: tenantProfile?.address ?? "",
        }}
      />
    </SriModuleShell>
  );
}
