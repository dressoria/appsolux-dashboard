import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users } from "lucide-react";

const FISCAL_ITEMS = [
  { label: "RUC / Identificacion tributaria", status: "Proximamente" },
  { label: "Regimen fiscal", status: "Proximamente" },
  { label: "Puntos de emision", status: "Proximamente" },
  { label: "Facturacion electronica SRI", status: "Proximamente" },
  { label: "ATS y retenciones", status: "Proximamente" },
  { label: "Pais y moneda", status: "En preparacion" },
] as const;

const USER_ITEMS = [
  { label: "Usuarios del negocio", status: "En preparacion" },
  { label: "Roles y grupos", status: "En preparacion" },
  { label: "Permisos por modulo", status: "En preparacion" },
  { label: "Acceso por dispositivo", status: "Proximamente" },
  { label: "Sesiones activas", status: "Proximamente" },
  { label: "Historial de accesos", status: "Proximamente" },
] as const;

function StatusBadge({ status }: { status: "En preparacion" | "Proximamente" }) {
  return (
    <span
      className={`inline-flex h-5 items-center rounded-full border px-2 text-xs font-medium ${
        status === "En preparacion"
          ? "border-amber-200 bg-amber-50 text-amber-700"
          : "border-blue-200 bg-blue-50 text-blue-700"
      }`}
    >
      {status}
    </span>
  );
}

function ItemGrid({
  items,
}: {
  items: ReadonlyArray<{ label: string; status: "En preparacion" | "Proximamente" }>;
}) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-sm"
        >
          <span className="text-muted-foreground">{item.label}</span>
          <StatusBadge status={item.status} />
        </div>
      ))}
    </div>
  );
}

export function FiscalSettingsPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Fiscal / SRI</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
            En preparacion
          </span>
          <span className="inline-flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500">
            Ecuador
          </span>
        </div>
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            La configuracion fiscal se activara por pais. Para Ecuador se
            preparara integracion con SRI, ATS, retenciones y documentos
            electronicos.
          </p>
          <p>
            No se tocan certificados, XML, firma electronica ni autorizacion de
            documentos en esta fase.
          </p>
        </div>
        <ItemGrid items={FISCAL_ITEMS} />
      </CardContent>
    </Card>
  );
}

export function UsersSettingsPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-muted-foreground" />
          <CardTitle>Usuarios y permisos</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
            En preparacion
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          Administra quien puede acceder al dashboard, que modulos puede usar y
          que acciones puede ejecutar.
        </p>
        <ItemGrid items={USER_ITEMS} />
      </CardContent>
    </Card>
  );
}

export { UsersSettingsPlaceholder as SecuritySettingsPlaceholder };
