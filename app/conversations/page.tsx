import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ConversationsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Chatwoot</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Conversaciones
          </h1>
          <p className="mt-2 max-w-3xl text-muted-foreground">
            Aqui se mostraran todos los chats del Chatwoot perteneciente al
            tenant autenticado. La consulta siempre debe usar el
            chatwoot_account_id dinamico del tenant, nunca un account_id fijo.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle>Todas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Todas las conversaciones del tenant.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Abiertas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Chats activos que requieren atencion.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pendientes</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Conversaciones pausadas o en seguimiento.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Resueltas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Conversaciones finalizadas.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Bandeja multicanal</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pendiente: conectar con Chatwoot para listar conversaciones,
                contacto, canal, ultimo mensaje, fecha, agente asignado y
                estado.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Etiquetas / Embudo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Las etiquetas de Chatwoot se usaran como alternativa de CRM y
                embudo comercial.
              </p>

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-full border px-2 py-1">Pagado</span>
                <span className="rounded-full border px-2 py-1">
                  Pendiente pago
                </span>
                <span className="rounded-full border px-2 py-1">
                  Lead nuevo
                </span>
                <span className="rounded-full border px-2 py-1">
                  Cliente frecuente
                </span>
                <span className="rounded-full border px-2 py-1">
                  Seguimiento
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}