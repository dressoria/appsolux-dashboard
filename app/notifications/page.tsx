import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function NotificationsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Centro interno</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Notificaciones
          </h1>
          <p className="mt-2 text-muted-foreground">
            Aqui se mostraran alertas internas de pagos, comprobantes, leads,
            inventario, pedidos, automatizaciones y eventos importantes.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Pagos y comprobantes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Alertas de pagos recibidos, comprobantes pendientes y
                validaciones automaticas.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Leads y atencion</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Nuevos leads, clientes que requieren respuesta y conversaciones
                importantes.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eventos del sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Errores de automatizacion, alertas de inventario y procesos que
                necesitan revision.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}