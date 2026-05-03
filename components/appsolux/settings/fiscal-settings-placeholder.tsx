import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function FiscalSettingsPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Fiscal / SRI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm text-muted-foreground">
        <p>
          Proximo modulo: RUC, establecimientos, puntos de emision,
          secuenciales y certificado de firma electronica.
        </p>
        <p>
          Esta seccion queda preparada para facturacion electronica Ecuador, sin
          subir certificados ni emitir documentos todavia.
        </p>
      </CardContent>
    </Card>
  );
}

export function SecuritySettingsPlaceholder() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Seguridad / usuarios</CardTitle>
      </CardHeader>
      <CardContent className="text-sm text-muted-foreground">
        Proximo modulo: usuarios, roles, permisos y sesiones.
      </CardContent>
    </Card>
  );
}
