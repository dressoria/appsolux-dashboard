import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";

export function AdvancedErpNotActivatedState({
  description,
  basicHref = routes.basic,
}: {
  description: string;
  basicHref?: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>ERP avanzado no activado</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Este espacio esta disponible solo para cuentas con ERP avanzado habilitado.
        </p>
        <p className="text-sm text-muted-foreground">{description}</p>
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link href={routes.workspace}>Ir al panel principal</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href={basicHref}>Ir al modulo basico</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
