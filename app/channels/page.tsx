import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ChannelsPage() {
  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Canales</p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Canales conectados
          </h1>
          <p className="mt-2 text-muted-foreground">
            Conecta WhatsApp por Evolution API o Meta, ademas de Instagram y
            Messenger.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp QR / Evolution API</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pendiente: generar instancia y mostrar codigo QR.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Meta oficial</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Pendiente: conectar WhatsApp Cloud API, Instagram y Messenger.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardShell>
  );
}