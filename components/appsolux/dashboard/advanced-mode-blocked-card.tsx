import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import type { ErpProvisioningState } from "@/lib/core/erp-provisioning-status";

export function AdvancedModeBlockedCard({
  title,
  erpProvisioning,
  canRequestDedicatedErp,
}: {
  title: string;
  erpProvisioning: ErpProvisioningState;
  canRequestDedicatedErp: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm text-muted-foreground">
        {erpProvisioning.isSimulated ? (
          <p>
            La validacion tecnica termino, pero ERP/POS/Reportes seguiran
            bloqueados hasta completar el provisioning real.
          </p>
        ) : erpProvisioning.isPending ? (
          <p>
            ERP en preparacion. Puedes seguir operando ventas, caja, stock y
            clientes desde el modo basico mientras se completa el proceso.
          </p>
        ) : erpProvisioning.isFailed ? (
          <p>
            Error preparando ERP. Revisa el estado desde Mi plan o Dashboard y
            reintenta si tu plan lo permite.
          </p>
        ) : canRequestDedicatedErp ? (
          <p>
            Tu plan permite ERP dedicado. Solicitalo para desbloquear el modo
            avanzado; mientras tanto puedes operar en Appsolux Basico.
          </p>
        ) : (
          <p>
            Tu plan actual usa Appsolux Basico. Mejora tu plan para activar ERP
            dedicado, inventario avanzado, POS completo y reportes avanzados.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={routes.basic}>Ir a Appsolux Basico</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={routes.billing}>
              {canRequestDedicatedErp ? "Ver estado ERP" : "Mejorar plan"}
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
