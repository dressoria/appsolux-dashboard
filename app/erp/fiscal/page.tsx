import Link from "next/link";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getErpnextCompanyDetail } from "@/lib/api/erpnext/companies";
import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { routes } from "@/config/routes";

export default async function ErpFiscalPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver fiscalidad.
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
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Fiscalidad e impuestos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Fiscalidad e impuestos
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para acceder al modulo fiscal.</p>
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
  const companyDetail = firstCompany
    ? await getErpnextCompanyDetail(firstCompany.name).catch(() => null)
    : null;

  const country = companyDetail?.country ?? null;
  const currency = companyDetail?.default_currency ?? firstCompany?.default_currency ?? null;
  const taxId = companyDetail?.tax_id ?? null;
  const companyName = companyDetail?.company_name ?? firstCompany?.company_name ?? firstCompany?.name ?? null;

  const isEcuador = country?.toLowerCase().includes("ecuador") ?? false;

  return (
    <DashboardShell>
      <div className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              / Fiscalidad e impuestos
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Fiscalidad e impuestos
            </h1>
            <p className="mt-2 text-muted-foreground">
              Configura documentos, impuestos y obligaciones fiscales segun el
              pais de tu empresa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFiscalSettings}>
                Configuracion fiscal
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erp}>Volver al ERP</Link>
            </Button>
          </div>
        </div>

        {/* Estado fiscal general */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            A. Configuracion fiscal
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold leading-tight">
                  {companyName ?? "Sin empresa configurada"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Pais fiscal
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold leading-tight">
                  {country ?? "Pendiente de configuracion"}
                </p>
                {isEcuador && (
                  <span className="mt-1 inline-flex h-4 items-center rounded border border-amber-200 bg-amber-50 px-1.5 text-xs text-amber-700">
                    SRI Ecuador
                  </span>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Moneda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold leading-tight">
                  {currency ?? "Sin moneda"}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Identificacion tributaria
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-semibold leading-tight">
                  {taxId ?? "No configurado"}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  RUC / NIT / RFC / RUC
                </p>
              </CardContent>
            </Card>
          </div>

          {!country && (
            <Card className="border-amber-200 bg-amber-50/50">
              <CardContent className="p-4 text-sm text-amber-800">
                <span className="font-medium">Pais fiscal no configurado.</span>{" "}
                Configura el pais de tu empresa para activar la localizacion
                fiscal correcta.{" "}
                <Link
                  href={routes.settings}
                  className="font-medium underline-offset-2 hover:underline"
                >
                  Ir a Configuracion
                </Link>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Ecuador / SRI */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            C. Ecuador / SRI
          </h2>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <CardTitle>Ecuador / SRI</CardTitle>
                    <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                      En preparacion
                    </span>
                    <span className="inline-flex h-4 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500">
                      Ecuador
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Facturacion electronica, retenciones, guias de remision y
                    ATS para empresas en Ecuador.
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.erpFiscalEcuador}>Ver detalle</Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.erpFiscalDocuments}>
                    Documentos electronicos
                  </Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.erpFiscalWithholdings}>Retenciones</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.erpFiscalAts}>ATS</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.erpFiscalReceived}>
                    Facturas recibidas
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Documentos electronicos */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            B. Documentos electronicos
          </h2>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {[
              {
                label: "Facturas",
                description:
                  "Documentos comerciales emitidos a clientes.",
                href: routes.erpFiscalDocuments,
                status: "Disponible",
                statusClass:
                  "border-green-200 bg-green-50 text-green-700",
              },
              {
                label: "Notas de credito",
                description: "Anulaciones parciales o totales de facturas.",
                href: null,
                status: "En preparacion",
                statusClass:
                  "border-amber-200 bg-amber-50 text-amber-700",
              },
              {
                label: "Notas de debito",
                description: "Cargos adicionales sobre facturas emitidas.",
                href: null,
                status: "En preparacion",
                statusClass:
                  "border-amber-200 bg-amber-50 text-amber-700",
              },
              {
                label: "Retenciones",
                description:
                  "Comprobantes de retencion emitidos y recibidos.",
                href: routes.erpFiscalWithholdings,
                status: "En preparacion",
                statusClass:
                  "border-amber-200 bg-amber-50 text-amber-700",
              },
              {
                label: "Guias de remision",
                description: "Documentos de traslado de mercaderia.",
                href: null,
                status: "Proximamente",
                statusClass:
                  "border-blue-200 bg-blue-50 text-blue-700",
              },
              {
                label: "ATS",
                description:
                  "Anexo Transaccional Simplificado mensual.",
                href: routes.erpFiscalAts,
                status: "En preparacion",
                statusClass:
                  "border-amber-200 bg-amber-50 text-amber-700",
              },
            ].map((doc) => (
              <div
                key={doc.label}
                className="rounded-2xl border bg-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium">{doc.label}</p>
                  <span
                    className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${doc.statusClass}`}
                  >
                    {doc.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {doc.description}
                </p>
                {doc.href ? (
                  <Link
                    href={doc.href}
                    className="inline-flex h-7 items-center rounded-lg border bg-background px-3 text-xs transition-colors hover:bg-muted"
                  >
                    Ver &rarr;
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        </section>

        {/* Reportes fiscales */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            D. Reportes fiscales
          </h2>
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground">
              <p>
                Los reportes fiscales (ATS, declaraciones, retenciones por
                periodo) estaran disponibles cuando la localizacion SRI este
                activa.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.erpFiscalAts}>ATS</Link>
                </Button>
                <Button asChild variant="outline" size="sm">
                  <Link href={routes.reports}>Reportes gerenciales</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </section>

        {/* Localizaciones futuras */}
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            E. Localizaciones fiscales por pais
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                country: "Ecuador",
                body: "SRI Ecuador",
                status: "En preparacion",
                statusClass: "border-amber-200 bg-amber-50 text-amber-700",
                href: routes.erpFiscalEcuador,
              },
              {
                country: "Peru",
                body: "SUNAT",
                status: "Proximamente",
                statusClass: "border-blue-200 bg-blue-50 text-blue-700",
                href: null,
              },
              {
                country: "Colombia",
                body: "DIAN",
                status: "Proximamente",
                statusClass: "border-blue-200 bg-blue-50 text-blue-700",
                href: null,
              },
              {
                country: "Mexico",
                body: "SAT / CFDI",
                status: "Proximamente",
                statusClass: "border-blue-200 bg-blue-50 text-blue-700",
                href: null,
              },
            ].map((loc) => (
              <div
                key={loc.country}
                className="rounded-2xl border bg-card p-4 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium">{loc.country}</p>
                  <span
                    className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${loc.statusClass}`}
                  >
                    {loc.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{loc.body}</p>
                {loc.href ? (
                  <Link
                    href={loc.href}
                    className="inline-flex h-7 items-center rounded-lg border bg-background px-3 text-xs transition-colors hover:bg-muted"
                  >
                    Ver &rarr;
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            La fiscalizacion se activa por pais. Si tu empresa no tiene pais
            configurado, configura primero los datos de empresa en{" "}
            <Link href={routes.settings} className="underline-offset-2 hover:underline">
              Configuracion
            </Link>
            .
          </p>
        </section>
      </div>
    </DashboardShell>
  );
}
