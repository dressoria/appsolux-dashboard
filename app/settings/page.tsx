import { SettingsTabs } from "@/components/appsolux/settings/settings-tabs";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
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
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

async function loadErpSettings(erpnextCompanyId: string | null | undefined) {
  const [companies, warehouses, modesOfPayment] = await Promise.all([
    getErpnextCompanies(),
    getErpnextWarehouses(),
    getErpnextModesOfPayment(),
  ]);
  const companyName =
    erpnextCompanyId ?? companies.find((c) => c.name)?.name ?? undefined;
  const [company, paymentModeDetails, accounts] = await Promise.all([
    companyName
      ? getErpnextCompanyDetail(companyName)
      : Promise.resolve(undefined),
    Promise.all(
      modesOfPayment.map((m) => getErpnextModeOfPaymentDetail(m.name))
    ),
    companyName ? getCashAndBankAccounts(companyName) : Promise.resolve([]),
  ]);
  return { companies, warehouses, company, paymentModeDetails, accounts };
}

function getErpBadge(erp: {
  isRealActive: boolean;
  isPending: boolean;
  isSimulated: boolean;
  isFailed: boolean;
}): { label: string; className: string } {
  if (erp.isRealActive) {
    return {
      label: "ERP activo",
      className: "border-green-200 bg-green-50 text-green-700",
    };
  }
  if (erp.isPending || erp.isSimulated) {
    return {
      label: "ERP en preparacion",
      className: "border-amber-200 bg-amber-50 text-amber-700",
    };
  }
  if (erp.isFailed) {
    return {
      label: "Error ERP",
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
  const erpData = erpActive
    ? await loadErpSettings(tenant.erpnext_company_id)
    : null;

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

        <SettingsTabs
          company={erpData?.company}
          companies={erpData?.companies ?? []}
          warehouses={erpData?.warehouses ?? []}
          modesOfPayment={erpData?.paymentModeDetails ?? []}
          accounts={erpData?.accounts ?? []}
          erpActive={erpActive}
          erpDisplayStatus={tenantMode.erpProvisioning.displayStatus}
        />
      </div>
    </DashboardShell>
  );
}
