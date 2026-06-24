import { SettingsTabs } from "@/components/appsolux/settings/settings-tabs";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent } from "@/components/ui/card";
import { getCashAndBankAccounts } from "@/lib/api/erpnext/accounts";
import {
  getErpnextCompanies,
  getErpnextCompanyDetail,
} from "@/lib/api/erpnext/companies";
import {
  getErpnextModeOfPaymentDetail,
  getErpnextModesOfPayment,
} from "@/lib/api/erpnext/modes-of-payment";
import { getErpnextWarehouses } from "@/lib/api/erpnext/warehouses";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantMemberships } from "@/lib/core/memberships";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

async function loadErpSettings(erpnextCompanyId: string | null | undefined) {
  const [companies, warehouses, modesOfPayment] = await Promise.all([
    getErpnextCompanies().catch(() => []),
    getErpnextWarehouses().catch(() => []),
    getErpnextModesOfPayment().catch(() => []),
  ]);

  const configuredExists =
    Boolean(erpnextCompanyId) &&
    companies.some((c) => c.name === erpnextCompanyId);
  const companyMismatch = Boolean(erpnextCompanyId) && !configuredExists;
  const effectiveName = configuredExists
    ? erpnextCompanyId!
    : (companies[0]?.name ?? undefined);

  const [company, paymentModeDetails, accounts] = await Promise.all([
    effectiveName
      ? getErpnextCompanyDetail(effectiveName).catch(() => undefined)
      : Promise.resolve(undefined),
    Promise.all(
      modesOfPayment.map((m) => getErpnextModeOfPaymentDetail(m.name))
    ).catch(() => []),
    effectiveName
      ? getCashAndBankAccounts(effectiveName).catch(() => [])
      : Promise.resolve([]),
  ]);

  return { companies, warehouses, company, paymentModeDetails, accounts, companyMismatch };
}

function getErpBadge(erp: {
  isRealActive: boolean;
  isPending: boolean;
  isSimulated: boolean;
  isFailed: boolean;
}): { label: string; className: string } {
  if (erp.isRealActive) {
    return {
      label: "Gestion Empresarial activa",
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }
  if (erp.isPending || erp.isSimulated) {
    return {
      label: "Gestion Empresarial en preparacion",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (erp.isFailed) {
    return {
      label: "Error de activacion",
      className: "border-red-200 bg-red-50 text-red-700",
    };
  }
  return {
    label: "Appsolux Basico",
    className: "border-slate-200 bg-slate-50 text-slate-600",
  };
}

export default async function SettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para configurar tu empresa.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);
  const erpActive = tenantMode.erpProvisioning.isRealActive;
  const badge = getErpBadge(tenantMode.erpProvisioning);
  const [erpData, memberships] = await Promise.all([
    erpActive ? loadErpSettings(tenant.erpnext_company_id) : Promise.resolve(null),
    getTenantMemberships(tenant.id).catch(() => []),
  ]);
  const membershipRows = memberships.map((membership) => ({
    id: membership.id,
    role: membership.role,
    status: membership.status,
    createdAt: membership.createdAt.toISOString(),
    user: {
      ...membership.user,
      createdAt: membership.user.createdAt.toISOString(),
    },
  }));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Configuracion</p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Configuracion de empresa
            </h1>
            <p className="mt-2 max-w-3xl text-muted-foreground">
              Administra datos de tu negocio, sucursales, bodegas, pagos,
              usuarios y configuracion fiscal.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Empresa: {tenant.name}
            </p>
          </div>
          <span
            className={`inline-flex h-7 items-center rounded-full border px-3 text-sm font-medium ${badge.className}`}
          >
            {badge.label}
          </span>
        </div>

        {erpData?.companyMismatch ? (
          <Card className="border-amber-200 bg-amber-50/60">
            <CardContent className="p-4 text-sm text-amber-800">
              <span className="font-medium">
                La empresa configurada no coincide con Gestion Empresarial.
              </span>{" "}
              Se muestra la empresa disponible. Revisa la configuracion del
              tenant.
            </CardContent>
          </Card>
        ) : null}

        <SettingsTabs
          company={erpData?.company}
          companies={erpData?.companies ?? []}
          warehouses={erpData?.warehouses ?? []}
          modesOfPayment={erpData?.paymentModeDetails ?? []}
          accounts={erpData?.accounts ?? []}
          erpActive={erpActive}
          erpDisplayStatus={tenantMode.erpProvisioning.displayStatus}
          memberships={membershipRows}
        />
      </div>
    </DashboardShell>
  );
}
