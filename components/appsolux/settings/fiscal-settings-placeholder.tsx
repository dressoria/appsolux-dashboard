import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { routes } from "@/config/routes";

const FISCAL_ITEMS = [
  { label: "RUC / Identificacion tributaria", status: "En preparacion" },
  { label: "Ambiente SRI: pruebas / produccion", status: "En preparacion" },
  { label: "Certificado de firma electronica", status: "En preparacion" },
  { label: "Secuenciales / puntos de emision", status: "En preparacion" },
  { label: "Facturacion electronica SRI", status: "En preparacion" },
  { label: "Retenciones y ATS", status: "En preparacion" },
  { label: "Guias de remision", status: "Proximamente" },
  { label: "Facturas recibidas electronicas", status: "Proximamente" },
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
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle>Fiscal / SRI</CardTitle>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex h-5 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
              En preparacion
            </span>
            <span className="inline-flex h-5 items-center rounded border border-slate-200 bg-slate-50 px-1.5 text-xs text-slate-500">
              Ecuador
            </span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2 text-sm text-muted-foreground">
          <p>
            La configuracion fiscal se activa por pais. Para Ecuador se prepara
            integracion con SRI, ATS, retenciones y documentos electronicos.
          </p>
          <p>
            No se tocan certificados, XML, firma electronica ni autorizacion de
            documentos en esta fase.
          </p>
        </div>
        <ItemGrid items={FISCAL_ITEMS} />
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm">
            <Link href={routes.erpFiscal}>Abrir modulo fiscal</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpFiscalEcuador}>Ecuador / SRI</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={routes.erpFiscalSettings}>Configuracion fiscal</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
