import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";

const posCapabilities = [
  "Buscar productos",
  "Ver stock disponible",
  "Agregar al carrito",
  "Seleccionar cliente",
  "Registrar forma de pago",
  "Crear venta en el ERP",
  "Preparar factura o comprobante",
];

export function PosPreviewCard() {
  return (
    <Card className="border-foreground/20">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>POS / Punto de venta</CardTitle>
          <span className="inline-flex h-6 items-center rounded-full border border-blue-200 bg-blue-50 px-2 text-xs font-medium text-blue-700">
            Fase 1 disponible
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Seras llevado al POS de Appsolux para crear pedidos de venta con
          productos, clientes, bodegas y stock reales.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {posCapabilities.map((capability) => (
            <div
              key={capability}
              className="rounded-lg border bg-background px-3 py-2 text-sm"
            >
              {capability}
            </div>
          ))}
        </div>
        <Button asChild>
          <Link href={routes.pos}>Abrir POS</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export function AccountingPreviewCard() {
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <CardTitle>Facturacion y contabilidad</CardTitle>
          <span className="inline-flex h-6 items-center rounded-full border border-amber-200 bg-amber-50 px-2 text-xs font-medium text-amber-700">
            Proximo modulo
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Modulo proximo para facturas, pagos, impuestos, cuentas, reportes y
          documentos contables.
        </p>
        <div className="rounded-lg border bg-muted/40 p-3 text-sm text-muted-foreground">
          Las facturas del negocio viviran aqui o dentro del flujo ERP. Mi Plan
          es distinto: Mi Plan es lo que el cliente paga a Appsolux.
        </div>
      </CardContent>
    </Card>
  );
}
