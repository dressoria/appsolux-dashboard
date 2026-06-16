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

type ChecklistItemStatus =
  | "configured"
  | "requires-config"
  | "in-preparation"
  | "coming-soon";

type ChecklistItem = {
  label: string;
  description: string;
  status: ChecklistItemStatus;
  href?: string;
};

const STATUS_LABELS: Record<ChecklistItemStatus, string> = {
  configured: "Configurado",
  "requires-config": "Requiere configuracion",
  "in-preparation": "En preparacion",
  "coming-soon": "Proximamente",
};

const STATUS_CLASSES: Record<ChecklistItemStatus, string> = {
  configured: "border-green-200 bg-green-50 text-green-700",
  "requires-config": "border-orange-200 bg-orange-50 text-orange-700",
  "in-preparation": "border-amber-200 bg-amber-50 text-amber-700",
  "coming-soon": "border-blue-200 bg-blue-50 text-blue-700",
};

function ChecklistRow({ item }: { item: ChecklistItem }) {
  const label = STATUS_LABELS[item.status];
  const cls = STATUS_CLASSES[item.status];
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border bg-card px-4 py-3">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-tight">{item.label}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {item.description}
        </p>
        {item.href && (
          <Link
            href={item.href}
            className="mt-1.5 inline-flex h-6 items-center rounded border bg-background px-2 text-xs transition-colors hover:bg-muted"
          >
            Ver &rarr;
          </Link>
        )}
      </div>
      <span
        className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${cls}`}
      >
        {label}
      </span>
    </div>
  );
}

export default async function ErpFiscalEcuadorPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver el modulo fiscal.
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
        <div className="space-y-6">
          <div>
            <p className="text-sm text-muted-foreground">
              <Link href={routes.erp} className="hover:underline">
                ERP Comercial
              </Link>{" "}
              /{" "}
              <Link href={routes.erpFiscal} className="hover:underline">
                Fiscalidad
              </Link>{" "}
              / Ecuador / SRI
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Ecuador / SRI
            </h1>
          </div>
          <Card>
            <CardContent className="p-6 text-sm text-muted-foreground">
              <p>El ERP dedicado es necesario para este modulo.</p>
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

  const taxId = companyDetail?.tax_id ?? null;
  const country = companyDetail?.country ?? null;
  const companyName =
    companyDetail?.company_name ?? firstCompany?.name ?? null;

  const hasTaxId = Boolean(taxId);
  const hasCountry = Boolean(country);

  const checklist: ChecklistItem[] = [
    {
      label: "Datos fiscales de empresa",
      description:
        "Razon social, RUC, direccion matriz y datos legales de la empresa.",
      status: hasTaxId && hasCountry ? "configured" : "requires-config",
      href: routes.erpFiscalSettings,
    },
    {
      label: "RUC / Identificacion tributaria",
      description: "Registro Unico de Contribuyentes (RUC) de 13 digitos.",
      status: hasTaxId ? "configured" : "requires-config",
      href: routes.settings,
    },
    {
      label: "Ambiente SRI",
      description:
        "Seleccion entre ambiente de pruebas (1) y produccion (2) del SRI.",
      status: "in-preparation",
      href: routes.erpFiscalSettings,
    },
    {
      label: "Certificado de firma electronica",
      description:
        "Archivo .p12 para firma de documentos electronicos. No se configura en esta fase.",
      status: "in-preparation",
    },
    {
      label: "Secuenciales y puntos de emision",
      description:
        "Establecimiento, punto de emision y secuencial por tipo de documento.",
      status: "in-preparation",
      href: routes.erpFiscalSettings,
    },
    {
      label: "Facturas electronicas",
      description: "Generacion, firma y envio de facturas al SRI.",
      status: "in-preparation",
      href: routes.erpFiscalDocuments,
    },
    {
      label: "Notas de credito",
      description: "Anulacion parcial o total de facturas emitidas.",
      status: "in-preparation",
    },
    {
      label: "Notas de debito",
      description: "Cargos adicionales sobre facturas emitidas.",
      status: "in-preparation",
    },
    {
      label: "Retenciones",
      description:
        "Comprobantes de retencion en la fuente emitidos y recibidos.",
      status: "in-preparation",
      href: routes.erpFiscalWithholdings,
    },
    {
      label: "Guias de remision",
      description: "Documentos de traslado de mercaderia entre establecimientos.",
      status: "coming-soon",
    },
    {
      label: "ATS",
      description:
        "Anexo Transaccional Simplificado mensual para declaracion al SRI.",
      status: "in-preparation",
      href: routes.erpFiscalAts,
    },
    {
      label: "Envio masivo de documentos",
      description:
        "Autorizacion y envio masivo al SRI en un solo proceso.",
      status: "coming-soon",
    },
    {
      label: "Facturas recibidas electronicas",
      description:
        "Importacion de XML de facturas de proveedores para conciliacion.",
      status: "coming-soon",
      href: routes.erpFiscalReceived,
    },
  ];

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
              <Link href={routes.erpFiscal} className="hover:underline">
                Fiscalidad
              </Link>{" "}
              / Ecuador / SRI
            </p>
            <div className="mt-1 flex items-center gap-2">
              <h1 className="text-3xl font-semibold tracking-tight">
                Ecuador / SRI
              </h1>
              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                En preparacion
              </span>
            </div>
            <p className="mt-2 text-muted-foreground">
              Prepara facturacion electronica, retenciones, guias de remision y
              ATS para empresas en Ecuador.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.erpFiscalSettings}>
                Configuracion fiscal
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFiscal}>Volver a fiscalidad</Link>
            </Button>
          </div>
        </div>

        {companyDetail && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Datos de empresa detectados
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <p className="text-xs text-muted-foreground">Empresa</p>
                <p className="font-medium">{companyName ?? "-"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pais</p>
                <p className="font-medium">{country ?? "No configurado"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">RUC / Tax ID</p>
                <p className="font-medium">{taxId ?? "No configurado"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Moneda</p>
                <p className="font-medium">
                  {companyDetail?.default_currency ?? "-"}
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 text-sm text-amber-800">
            <span className="font-medium">Fase de preparacion.</span> En esta
            etapa se preparan la arquitectura, UI y configuracion base. No se
            realiza autorizacion real con el SRI, no se firman documentos
            electronicos y no se envian datos a servicios externos del SRI.
          </CardContent>
        </Card>

        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Checklist fiscal Ecuador
          </h2>
          <div className="space-y-2">
            {checklist.map((item) => (
              <ChecklistRow key={item.label} item={item} />
            ))}
          </div>
        </div>

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
            <Link href={routes.erpFiscalReceived}>Facturas recibidas</Link>
          </Button>
        </div>
      </div>
    </DashboardShell>
  );
}
