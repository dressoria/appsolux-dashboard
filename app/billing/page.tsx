import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function BillingPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Appsolux</p>
          <h1 className="text-3xl font-semibold tracking-tight">Mi plan</h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Aqui se mostrara el plan que el cliente tiene contratado con
            Appsolux, sus pagos, facturas del servicio, limites y estado de
            suscripcion.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Plan actual</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nombre del plan, funciones incluidas, limites de uso y estado
                de la suscripcion.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pagos a Appsolux</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pagos del cliente hacia Appsolux, comprobantes, renovaciones y
                estado de cobro.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Facturas del servicio</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Facturas emitidas por Appsolux al cliente por el uso de la
                plataforma.
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Importante</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Esta seccion no es la facturacion del negocio del cliente. Las
              facturas, ventas y pagos propios del negocio se gestionan en el
              modulo ERP.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}