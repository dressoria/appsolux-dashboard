import Link from "next/link";
import { ExportCsvButton } from "@/components/appsolux/reports/export-csv-button";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildProfitAndLossReport } from "@/lib/api/erpnext/accounting-reports";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

type Props = { searchParams: Promise<{ from?: string; to?: string; company?: string }> };

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value);
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function monthStart() {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString().slice(0, 10);
}

export default async function ErpAccountingProfitAndLossPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver el estado de resultados.</p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);
  if (!tenantMode.erpProvisioning.isRealActive) {
    return (
      <DashboardShell>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            <p>El ERP dedicado es necesario para ver el estado de resultados.</p>
          </CardContent>
        </Card>
      </DashboardShell>
    );
  }

  const params = await searchParams;
  const companies = await getErpnextCompanies().catch(() => []);
  const company = params.company || companies[0]?.name;
  const from = params.from || monthStart();
  const to = params.to || today();
  const report = await buildProfitAndLossReport({ company, from, to });
  const rowsCsv = report.rows.map((row) => ({
    account: row.account,
    account_name: row.account_name ?? "",
    root_type: row.root_type ?? "",
    account_type: row.account_type ?? "",
    debit: row.debit,
    credit: row.credit,
    balance: row.balance,
  }));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Estado de resultados
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Estado de resultados</h1>
            <p className="mt-2 text-muted-foreground">
              Vista gerencial construida desde libro mayor ERPNext; no reemplaza reportes fiscales/SRI.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton
              filename={`estado-resultados-${from}-${to}`}
              rows={rowsCsv}
              columns={[
                { key: "account", header: "Cuenta" },
                { key: "account_name", header: "Nombre" },
                { key: "root_type", header: "Root type" },
                { key: "account_type", header: "Tipo" },
                { key: "debit", header: "Debito" },
                { key: "credit", header: "Credito" },
                { key: "balance", header: "Saldo" },
              ]}
            />
            <Button asChild variant="outline"><Link href={routes.erpAccounting}>Volver</Link></Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-4">
            <form className="grid gap-3 md:grid-cols-4">
              <input name="from" type="date" defaultValue={from} className="rounded-md border bg-background px-3 py-2 text-sm" />
              <input name="to" type="date" defaultValue={to} className="rounded-md border bg-background px-3 py-2 text-sm" />
              <select name="company" defaultValue={company ?? ""} className="rounded-md border bg-background px-3 py-2 text-sm">
                {companies.map((item) => <option key={item.name} value={item.name}>{item.company_name ?? item.name}</option>)}
              </select>
              <Button type="submit">Filtrar</Button>
            </form>
          </CardContent>
        </Card>

        <div className="grid gap-3 md:grid-cols-5">
          {[
            ["Ingresos operativos", report.income, "text-green-700"],
            ["Costo de ventas", report.costOfSales, "text-rose-600"],
            ["Utilidad bruta", report.grossProfit, report.grossProfit >= 0 ? "text-green-700" : "text-rose-600"],
            ["Gastos operativos", report.operatingExpenses, "text-rose-600"],
            ["Utilidad neta estimada", report.netProfit, report.netProfit >= 0 ? "text-green-700" : "text-rose-600"],
          ].map(([label, value, cls]) => (
            <Card key={label}>
              <CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader>
              <CardContent className={`text-xl font-semibold ${cls}`}>{formatMoney(Number(value))}</CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader><CardTitle>Movimientos por cuenta</CardTitle></CardHeader>
          <CardContent>
            {report.rows.length === 0 ? (
              <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">Sin movimientos para el periodo seleccionado.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b text-xs text-muted-foreground">
                    <tr>
                      <th className="py-2 pr-4 text-left">Cuenta</th>
                      <th className="py-2 pr-4 text-left">Tipo</th>
                      <th className="py-2 pr-4 text-right">Debito</th>
                      <th className="py-2 pr-4 text-right">Credito</th>
                      <th className="py-2 text-right">Saldo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.rows.map((row) => (
                      <tr key={row.account}>
                        <td className="py-2 pr-4 font-medium">{row.account_name ?? row.account}<p className="text-xs text-muted-foreground">{row.account}</p></td>
                        <td className="py-2 pr-4 text-muted-foreground">{row.account_type ?? row.root_type ?? "-"}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(row.debit)}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(row.credit)}</td>
                        <td className="py-2 text-right font-semibold">{formatMoney(row.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
