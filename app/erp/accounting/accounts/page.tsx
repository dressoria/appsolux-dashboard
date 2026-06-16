import Link from "next/link";
import { AccountActions } from "@/components/appsolux/erp/account-actions";
import { CreateAccountForm } from "@/components/appsolux/erp/create-account-form";
import { ExportCsvButton } from "@/components/appsolux/reports/export-csv-button";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextAccounts } from "@/lib/api/erpnext/accounts";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";
import type { ErpnextAccount } from "@/types/erpnext";

const ROOT_TYPE_LABELS: Record<string, string> = {
  Asset: "Activo",
  Liability: "Pasivo",
  Equity: "Patrimonio",
  Income: "Ingreso",
  Expense: "Gasto",
};

const ROOT_ORDER = ["Asset", "Liability", "Equity", "Income", "Expense"];

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function rootTypeLabel(type?: string) {
  if (!type) return "Otro";
  return ROOT_TYPE_LABELS[type] ?? type;
}

function groupByRootType(accounts: ErpnextAccount[]) {
  const groups: Record<string, ErpnextAccount[]> = {};
  for (const account of accounts) {
    const root = account.root_type ?? "Otro";
    groups[root] = [...(groups[root] ?? []), account];
  }

  return [
    ...ROOT_ORDER.filter((root) => groups[root]).map(
      (root) => [root, groups[root]] as [string, ErpnextAccount[]]
    ),
    ...Object.entries(groups).filter(([root]) => !ROOT_ORDER.includes(root)),
  ];
}

export default async function ErpAccountingAccountsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el plan de cuentas.
          </p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <p>El ERP dedicado es necesario para ver el plan de cuentas.</p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const companies = await getErpnextCompanies().catch(() => []);
  const firstCompany = companies[0];
  const accounts = await getErpnextAccounts(firstCompany?.name).catch(() => []);
  const activeAccounts = accounts.filter((a) => a.disabled !== 1 && a.is_group !== 1);
  const groupAccounts = accounts.filter((a) => a.is_group === 1);
  const grouped = groupByRootType(activeAccounts);
  const accountsCsv = accounts.map((account) => ({
    name: account.name,
    account_number: account.account_number ?? "",
    account_name: account.account_name ?? "",
    parent_account: account.parent_account ?? "",
    root_type: account.root_type ?? "",
    account_type: account.account_type ?? "",
    is_group: account.is_group ?? 0,
    disabled: account.disabled ?? 0,
    balance: account.balance ?? 0,
  }));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">
                Contabilidad
              </Link>{" "}
              / Plan de cuentas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Plan de cuentas
            </h1>
            <p className="mt-1 text-muted-foreground">
              {activeAccounts.length} cuentas activas · {groupAccounts.length} grupos
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton
              filename="plan-de-cuentas"
              rows={accountsCsv}
              columns={[
                { key: "name", header: "ID" },
                { key: "account_number", header: "Numero" },
                { key: "account_name", header: "Cuenta" },
                { key: "parent_account", header: "Padre" },
                { key: "root_type", header: "Root type" },
                { key: "account_type", header: "Tipo" },
                { key: "is_group", header: "Grupo" },
                { key: "disabled", header: "Inactivo" },
                { key: "balance", header: "Balance" },
              ]}
            />
            <Button asChild variant="outline">
              <Link href={routes.erpAccounting}>Volver a contabilidad</Link>
            </Button>
          </div>
        </div>

        <CreateAccountForm
          companies={companies}
          parentAccounts={groupAccounts}
          defaultCompany={firstCompany?.name}
          defaultCurrency={firstCompany?.default_currency}
        />

        {accounts.length === 0 ? (
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              No se encontraron cuentas contables. Configura el plan de cuentas
              en ERPNext primero.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {grouped.map(([rootType, items]) => (
              <Card key={rootType}>
                <CardHeader>
                  <CardTitle className="text-base">
                    {rootTypeLabel(rootType)}
                    <span className="ml-2 text-sm font-normal text-muted-foreground">
                      ({items.length})
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                          <th className="px-4 py-2 text-left">Cuenta</th>
                          <th className="px-4 py-2 text-left">ID</th>
                          <th className="px-4 py-2 text-left">Padre</th>
                          <th className="px-4 py-2 text-left">Tipo</th>
                          <th className="px-4 py-2 text-left">Moneda</th>
                          <th className="px-4 py-2 text-left">Empresa</th>
                          <th className="px-4 py-2 text-right">Balance</th>
                          <th className="px-4 py-2 text-left">Estado</th>
                          <th className="px-4 py-2 text-left">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((account) => (
                          <tr
                            key={account.name}
                            className="border-b last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-4 py-2 font-medium">
                              {account.account_name ?? account.name}
                              {account.account_number ? (
                                <span className="ml-2 text-xs text-muted-foreground">
                                  {account.account_number}
                                </span>
                              ) : null}
                            </td>
                            <td className="px-4 py-2 font-mono text-xs text-muted-foreground">
                              {account.name}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {account.parent_account ?? "-"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {account.account_type ?? "-"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {account.account_currency ?? "-"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {account.company ?? "-"}
                            </td>
                            <td className="px-4 py-2 text-right">
                              {formatMoney(account.balance ?? 0)}
                            </td>
                            <td className="px-4 py-2">
                              <span className="inline-flex h-5 items-center rounded-full border border-green-200 bg-green-50 px-2 text-xs font-medium text-green-700">
                                Activa
                              </span>
                            </td>
                            <td className="px-4 py-2">
                              <AccountActions
                                account={account}
                                parentAccounts={groupAccounts}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingGeneralLedger}>Libro mayor</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingTrialBalance}>
              Balance de comprobacion
            </Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
