import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextJournalEntries } from "@/lib/api/erpnext/accounting";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-EC", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function getNum(v: number | undefined) {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function docStatusLabel(status?: 0 | 1 | 2) {
  if (status === 1) return { label: "Confirmado", cls: "border-green-200 bg-green-50 text-green-700" };
  if (status === 2) return { label: "Anulado", cls: "border-red-200 bg-red-50 text-red-700" };
  return { label: "Borrador", cls: "border-slate-200 bg-slate-50 text-slate-500" };
}

export default async function ErpAccountingJournalPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver el libro diario.</p>
        </div>
      </DashboardShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.canUseAdvancedErp) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Libro diario
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Libro diario</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver el libro diario.</p>
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
  const entries = await getErpnextJournalEntries(firstCompany?.name, 50).catch(() => []);

  const confirmed = entries.filter((e) => e.docstatus === 1);
  const totalDebit = confirmed.reduce((s, e) => s + getNum(e.total_debit), 0);
  const totalCredit = confirmed.reduce((s, e) => s + getNum(e.total_credit), 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Libro diario
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Libro diario</h1>
            <p className="mt-1 text-muted-foreground">
              {entries.length} asientos recientes
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600">
              Asientos manuales se registran en ERPNext
            </span>
            <Button asChild variant="outline">
              <Link href={routes.erpAccounting}>Volver a contabilidad</Link>
            </Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Asientos confirmados</p>
            <p className="text-xl font-semibold">{confirmed.length}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total debito</p>
            <p className="text-xl font-semibold">{formatMoney(totalDebit)}</p>
          </div>
          <div className="rounded-2xl border bg-card p-4 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Total credito</p>
            <p className="text-xl font-semibold">{formatMoney(totalCredit)}</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Asientos recientes</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {entries.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No se encontraron asientos contables. Los asientos se generan
                automaticamente al registrar facturas, pagos y ajustes en el ERP.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-left">Fecha</th>
                      <th className="px-4 py-2 text-left">Asiento</th>
                      <th className="px-4 py-2 text-left">Tipo</th>
                      <th className="px-4 py-2 text-right">Debito</th>
                      <th className="px-4 py-2 text-right">Credito</th>
                      <th className="px-4 py-2 text-left">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const st = docStatusLabel(entry.docstatus);
                      return (
                        <tr key={entry.name} className="border-b last:border-0 hover:bg-muted/30">
                          <td className="px-4 py-2 text-muted-foreground">{entry.posting_date ?? "—"}</td>
                          <td className="px-4 py-2 font-medium">
                            {entry.title ?? entry.name}
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">
                            {entry.voucher_type ?? "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {entry.total_debit != null ? formatMoney(getNum(entry.total_debit)) : "—"}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {entry.total_credit != null ? formatMoney(getNum(entry.total_credit)) : "—"}
                          </td>
                          <td className="px-4 py-2">
                            <span className={`inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium ${st.cls}`}>
                              {st.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingGeneralLedger}>Libro mayor</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingAccounts}>Plan de cuentas</Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
