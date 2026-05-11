import Link from "next/link";
import { ExportCsvButton } from "@/components/appsolux/reports/export-csv-button";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildBalanceSheetReport } from "@/lib/api/erpnext/accounting-reports";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

type Props = { searchParams: Promise<{ to?: string; company?: string }> };

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(value);
}

function today() { return new Date().toISOString().slice(0, 10); }

function BalanceRows({ title, rows }: { title: string; rows: Array<{ account: string; account_name?: string; account_type?: string; balance: number }> }) {
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-sm text-muted-foreground">Sin movimientos.</p> : (
          <div className="space-y-2">{rows.map((row) => (
            <div key={row.account} className="flex justify-between gap-3 rounded-lg border p-3 text-sm">
              <div><p className="font-medium">{row.account_name ?? row.account}</p><p className="text-xs text-muted-foreground">{row.account_type ?? row.account}</p></div>
              <p className="font-semibold">{formatMoney(Math.abs(row.balance))}</p>
            </div>
          ))}</div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function ErpAccountingBalanceSheetPage({ searchParams }: Props) {
  const user = await getCurrentUser();
  if (!user) return <DashboardShell><div>Sesion requerida</div></DashboardShell>;
  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);
  if (!tenantMode.erpProvisioning.isRealActive) return <DashboardShell><Card><CardContent className="p-6 text-sm text-muted-foreground">El ERP dedicado es necesario para ver el balance general.</CardContent></Card></DashboardShell>;

  const params = await searchParams;
  const companies = await getErpnextCompanies().catch(() => []);
  const company = params.company || companies[0]?.name;
  const to = params.to || today();
  const report = await buildBalanceSheetReport({ company, to });
  const rowsCsv = report.rows.map((row) => ({
    account: row.account,
    account_name: row.account_name ?? "",
    root_type: row.root_type ?? "",
    account_type: row.account_type ?? "",
    balance: row.balance,
  }));

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground"><Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link> / Balance general</p>
            <h1 className="text-3xl font-semibold tracking-tight">Balance general</h1>
            <p className="mt-2 text-muted-foreground">Vista gerencial desde cuentas ERPNext y GL Entry al corte seleccionado; no es balance tributario certificado.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportCsvButton filename={`balance-general-${to}`} rows={rowsCsv} columns={[
              { key: "account", header: "Cuenta" },
              { key: "account_name", header: "Nombre" },
              { key: "root_type", header: "Root type" },
              { key: "account_type", header: "Tipo" },
              { key: "balance", header: "Saldo" },
            ]} />
            <Button asChild variant="outline"><Link href={routes.erpAccounting}>Volver</Link></Button>
          </div>
        </div>

        <Card><CardContent className="p-4"><form className="grid gap-3 md:grid-cols-3">
          <input name="to" type="date" defaultValue={to} className="rounded-md border bg-background px-3 py-2 text-sm" />
          <select name="company" defaultValue={company ?? ""} className="rounded-md border bg-background px-3 py-2 text-sm">{companies.map((item) => <option key={item.name} value={item.name}>{item.company_name ?? item.name}</option>)}</select>
          <Button type="submit">Filtrar</Button>
        </form></CardContent></Card>

        <div className="grid gap-3 md:grid-cols-4">
          <Card><CardHeader><CardTitle>Total activos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatMoney(report.totalAssets)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Total pasivos</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatMoney(report.totalLiabilities)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Total patrimonio</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{formatMoney(report.totalEquity)}</CardContent></Card>
          <Card><CardHeader><CardTitle>Diferencia</CardTitle></CardHeader><CardContent className={`text-2xl font-semibold ${Math.abs(report.difference) > 0.01 ? "text-amber-600" : "text-green-700"}`}>{formatMoney(report.difference)}</CardContent></Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <BalanceRows title="Activos" rows={report.assets} />
          <BalanceRows title="Pasivos" rows={report.liabilities} />
          <BalanceRows title="Patrimonio" rows={report.equity} />
        </div>
      </div>
    </DashboardShell>
  );
}
