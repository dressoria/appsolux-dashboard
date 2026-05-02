import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AutomationsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Automatizaciones</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Plantillas y configuraciones
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Aqui el cliente vera automatizaciones disponibles y formularios
            simples de configuracion. Nunca se deben mostrar nodos, workflows,
            credenciales ni informacion interna de n8n.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Inventario inteligente</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Permite subir inventario, catalogo, precios, stock y reglas para
                automatizar respuestas y ventas.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Validacion de pagos</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Analiza comprobantes, detecta pagos pendientes y envia alertas
                internas al centro de notificaciones.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Seguimiento de clientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Crea recordatorios, clasifica leads y mueve clientes segun
                etiquetas o reglas comerciales.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Configuracion para empresas con inventario</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pendiente: formulario para cargar inventario, reglas de venta,
                horarios, politicas de envio, preguntas frecuentes y datos del
                catalogo.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Eventos y resultados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Las automatizaciones notificaran dentro de Appsolux: pagos,
                comprobantes, errores, leads importantes, pedidos y alertas de
                inventario.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}