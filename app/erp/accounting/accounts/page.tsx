import Link from "next/link";
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

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  Cash: "Caja",
  Bank: "Banco",
  Receivable: "Por cobrar",
  Payable: "Por pagar",
  "Tax": "Impuesto",
  "Cost of Goods Sold": "Costo de ventas",
  "Stock": "Inventario",
  "Fixed Asset": "Activo fijo",
  "Depreciation": "Depreciacion",
  "Accumulated Depreciation": "Depreciacion acumulada",
  "Capital Work in Progress": "Obra en curso",
  "Chargeable": "Imputable",
  "Round Off": "Redondeo",
  "Income Account": "Ingreso",
  "Expense Account": "Gasto",
};

function accountTypeLabel(type?: string) {
  if (!type) return null;
  return ACCOUNT_TYPE_LABELS[type] ?? type;
}

function rootTypeLabel(type?: string) {
  if (!type) return null;
  return ROOT_TYPE_LABELS[type] ?? type;
}

function isCashOrBank(account: ErpnextAccount) {
  return account.account_type === "Cash" || account.account_type === "Bank";
}

const ROOT_ORDER = ["Asset", "Liability", "Equity", "Income", "Expense"];

function groupByRootType(accounts: ErpnextAccount[]) {
  const groups: Record<string, ErpnextAccount[]> = {};

  for (const account of accounts) {
    const root = account.root_type ?? "Otro";
    if (!groups[root]) groups[root] = [];
    groups[root].push(account);
  }

  const ordered: Array<[string, ErpnextAccount[]]> = [];

  for (const root of ROOT_ORDER) {
    if (groups[root]) ordered.push([root, groups[root]]);
  }

  for (const [root, items] of Object.entries(groups)) {
    if (!ROOT_ORDER.includes(root)) ordered.push([root, items]);
  }

  return ordered;
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

  if (!tenantMode.erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Plan de cuentas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Plan de cuentas</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver el plan de cuentas.</p>
              <Button asChild variant="outline" size="sm" className="mt-3">
                <Link href={routes.erp}>Ir al ERP</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </DashboardShell>
    );
  }

  const companies = await getErpnextCompanies().catch(() => []);
  const firstCompany = companies[0];
  const accounts = await getErpnextAccounts(firstCompany?.name).catch(() => []);

  const activeAccounts = accounts.filter((a) => a.disabled !== 1 && a.is_group !== 1);
  const groupAccounts = accounts.filter((a) => a.is_group === 1);
  const grouped = groupByRootType(activeAccounts);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Plan de cuentas
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Plan de cuentas</h1>
            <p className="mt-1 text-muted-foreground">
              {activeAccounts.length} cuentas activas · {groupAccounts.length} grupos
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={routes.erpAccounting}>Volver a contabilidad</Link>
          </Button>
        </div>

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
                          <th className="px-4 py-2 text-left">Tipo</th>
                          <th className="px-4 py-2 text-left">Moneda</th>
                          <th className="px-4 py-2 text-left">Empresa</th>
                          <th className="px-4 py-2 text-left">Etiqueta</th>
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
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {accountTypeLabel(account.account_type) ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {account.account_currency ?? "—"}
                            </td>
                            <td className="px-4 py-2 text-muted-foreground">
                              {account.company ?? "—"}
                            </td>
                            <td className="px-4 py-2">
                              {isCashOrBank(account) ? (
                                <span className="inline-flex h-5 items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 text-xs font-medium text-emerald-700">
                                  Caja/Banco
                                </span>
                              ) : null}
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
            <Link href={routes.erpFinanceCash}>Cuentas de caja</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpFinanceBanks}>Cuentas de banco</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingGeneralLedger}>Libro mayor</Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
