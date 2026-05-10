import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextGlEntries } from "@/lib/api/erpnext/accounting";
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

export default async function ErpAccountingGeneralLedgerPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">Sesion requerida</h1>
          <p className="text-muted-foreground">Inicia sesion para ver el libro mayor.</p>
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
              / Libro mayor
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Libro mayor</h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para ver el libro mayor.</p>
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
  const entries = await getErpnextGlEntries(firstCompany?.name, 100).catch(() => []);

  const totalDebit = entries.reduce((s, e) => s + getNum(e.debit), 0);
  const totalCredit = entries.reduce((s, e) => s + getNum(e.credit), 0);

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">ERP Comercial</Link>{" "}
              /{" "}
              <Link href={routes.erpAccounting} className="hover:underline">Contabilidad</Link>{" "}
              / Libro mayor
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">Libro mayor</h1>
            <p className="mt-1 text-muted-foreground">
              Ultimos {entries.length} movimientos contables
            </p>
          </div>
          <Button asChild variant="outline">
            <Link href={routes.erpAccounting}>Volver a contabilidad</Link>
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border bg-card p-4 space-y-1">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Movimientos</p>
            <p className="text-xl font-semibold">{entries.length}</p>
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
            <CardTitle>Movimientos contables</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {entries.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">
                No se encontraron movimientos contables. Los movimientos se
                generan automaticamente al registrar transacciones en el ERP.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-left">Fecha</th>
                      <th className="px-4 py-2 text-left">Cuenta</th>
                      <th className="px-4 py-2 text-left">Referencia</th>
                      <th className="px-4 py-2 text-left">Tipo</th>
                      <th className="px-4 py-2 text-right">Debito</th>
                      <th className="px-4 py-2 text-right">Credito</th>
                      <th className="px-4 py-2 text-left">Tercero</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => (
                      <tr key={entry.name} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2 text-muted-foreground">{entry.posting_date ?? "—"}</td>
                        <td className="px-4 py-2 font-medium leading-tight max-w-[200px] truncate">
                          {entry.account ?? "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{entry.voucher_no ?? "—"}</td>
                        <td className="px-4 py-2 text-muted-foreground">{entry.voucher_type ?? "—"}</td>
                        <td className="px-4 py-2 text-right">
                          {getNum(entry.debit) > 0 ? formatMoney(getNum(entry.debit)) : "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {getNum(entry.credit) > 0 ? formatMoney(getNum(entry.credit)) : "—"}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {entry.party
                            ? `${entry.party_type ?? ""} ${entry.party}`.trim()
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Mostrando los ultimos 100 movimientos. Para filtros avanzados por cuenta o periodo,
          accede directamente al ERP.
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingJournal}>Libro diario</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpAccountingAccounts}>Plan de cuentas</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.reports}>Ver reportes</Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
