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
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

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
            Inicia sesion para configurar empresa y pagos.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [companies, warehouses, modesOfPayment] = await Promise.all([
    getErpnextCompanies(),
    getErpnextWarehouses(),
    getErpnextModesOfPayment(),
  ]);
  const companyName =
    tenant.erpnext_company_id ??
    companies.find((company) => company.name)?.name ??
    undefined;
  const [company, paymentModeDetails, accounts] = await Promise.all([
    companyName ? getErpnextCompanyDetail(companyName) : Promise.resolve(undefined),
    Promise.all(
      modesOfPayment.map((modeOfPayment) =>
        getErpnextModeOfPaymentDetail(modeOfPayment.name)
      )
    ),
    companyName ? getCashAndBankAccounts(companyName) : Promise.resolve([]),
  ]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Configuracion</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Ajustes de empresa y pagos
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Configura datos basicos de empresa, bodegas, metodos de pago y
            cuentas de caja o banco sin entrar al ERP.
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Tenant: {tenant.name} ({tenant.slug})
          </p>
        </div>

        <Card>
          <CardContent className="space-y-2 p-4 text-sm text-muted-foreground">
            <p>
              Los datos se leen y guardan en ERPNext real. Appsolux no crea
              cuentas contables ni metodos de pago automaticamente para evitar
              afectar el plan de cuentas.
            </p>
            <p>
              El checkout POS usa estas cuentas para registrar cobros en caja o
              banco.
            </p>
          </CardContent>
        </Card>

        <SettingsTabs
          company={company}
          companies={companies}
          warehouses={warehouses}
          modesOfPayment={paymentModeDetails}
          accounts={accounts}
        />
      </div>
    </DashboardShell>
  );
}
