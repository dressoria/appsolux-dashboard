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
        <p>
          {erpProvisioning.isPending
            ? "La configuración técnica está en preparación."
            : erpProvisioning.isFailed
              ? "La última configuración técnica no terminó correctamente."
              : "Esta función aún necesita configuración para operar en esta empresa."}
        </p>

        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={routes.facturacionSettings}>Revisar configuración</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
