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

type FiscalRowProps = {
  label: string;
  value: string | null | undefined;
  placeholder: string;
  status?: "configured" | "missing" | "pending";
};

function FiscalRow({ label, value, placeholder, status = "pending" }: FiscalRowProps) {
  const statusMap = {
    configured: "border-green-200 bg-green-50 text-green-700",
    missing: "border-orange-200 bg-orange-50 text-orange-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
  };
  const statusLabel = {
    configured: "Configurado",
    missing: "Pendiente",
    pending: "En preparacion",
  };
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border px-4 py-3">
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="mt-0.5 text-sm font-medium">
          {value ?? <span className="text-muted-foreground">{placeholder}</span>}
        </p>
      </div>
      <span
        className={`inline-flex h-5 shrink-0 items-center rounded-full border px-2 text-xs font-medium ${statusMap[status]}`}
      >
        {statusLabel[status]}
      </span>
    </div>
  );
}

export default async function ErpFiscalSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <DashboardShell>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Sesion requerida
          </h1>
          <p className="text-muted-foreground">
            Inicia sesion para ver configuracion fiscal.
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
              / Configuracion fiscal
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Configuracion fiscal
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
  const currency = companyDetail?.default_currency ?? firstCompany?.default_currency ?? null;
  const companyName = companyDetail?.company_name ?? firstCompany?.name ?? null;
  const companyEmail = companyDetail?.company_email ?? null;
  const phone = companyDetail?.phone_no ?? null;

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
              / Configuracion fiscal
            </p>
            <h1 className="text-3xl font-semibold tracking-tight">
              Configuracion fiscal
            </h1>
            <p className="mt-2 text-muted-foreground">
              Datos fiscales de empresa leidos desde el ERP. Edita desde
              Configuracion de empresa.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href={routes.settings}>Editar en Configuracion</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={routes.erpFiscal}>Volver a fiscalidad</Link>
            </Button>
          </div>
        </div>

        {/* Datos de empresa */}
        <Card>
          <CardHeader>
            <CardTitle>Datos de empresa</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <FiscalRow
              label="Razon social / Nombre comercial"
              value={companyName}
              placeholder="Sin configurar"
              status={companyName ? "configured" : "missing"}
            />
            <FiscalRow
              label="Identificacion tributaria (RUC / NIT / RFC)"
              value={taxId}
              placeholder="Sin configurar"
              status={taxId ? "configured" : "missing"}
            />
            <FiscalRow
              label="Pais fiscal"
              value={country}
              placeholder="Sin configurar"
              status={country ? "configured" : "missing"}
            />
            <FiscalRow
              label="Moneda"
              value={currency}
              placeholder="Sin configurar"
              status={currency ? "configured" : "missing"}
            />
            <FiscalRow
              label="Email de empresa"
              value={companyEmail}
              placeholder="Sin configurar"
              status={companyEmail ? "configured" : "missing"}
            />
            <FiscalRow
              label="Telefono"
              value={phone}
              placeholder="Sin configurar"
              status={phone ? "configured" : "missing"}
            />
          </CardContent>
        </Card>

        {/* Configuracion SRI Ecuador */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>Configuracion SRI Ecuador</CardTitle>
              <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
                En preparacion
              </span>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <FiscalRow
              label="Ambiente SRI"
              value={null}
              placeholder="Pruebas / Produccion — pendiente de configuracion"
              status="pending"
            />
            <FiscalRow
              label="Certificado de firma electronica"
              value={null}
              placeholder="No configurado — no se sube en esta fase"
              status="pending"
            />
            <FiscalRow
              label="Fecha de expiracion del certificado"
              value={null}
              placeholder="Pendiente de certificado"
              status="pending"
            />
            <FiscalRow
              label="Establecimiento"
              value={null}
              placeholder="Pendiente de configuracion"
              status="pending"
            />
            <FiscalRow
              label="Punto de emision"
              value={null}
              placeholder="Pendiente de configuracion"
              status="pending"
            />
            <FiscalRow
              label="Secuencial de facturas"
              value={null}
              placeholder="Pendiente de configuracion"
              status="pending"
            />
            <FiscalRow
              label="Obligado a llevar contabilidad"
              value={null}
              placeholder="Pendiente de configuracion"
              status="pending"
            />
            <FiscalRow
              label="Regimen"
              value={null}
              placeholder="Regimen general / RIMPE — pendiente"
              status="pending"
            />
          </CardContent>
        </Card>

        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4 text-sm text-amber-800">
            <span className="font-medium">No se configura certificado ni firma en esta fase.</span>{" "}
            Para editar datos de empresa (razon social, RUC, pais, moneda) usa{" "}
            <Link
              href={routes.settings}
              className="font-medium underline-offset-2 hover:underline"
            >
              Configuracion de empresa
            </Link>
            .
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
