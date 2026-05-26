import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { listSriEstablishments, listSriIssuePoints } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { SriIssuePointForm } from "./issue-point-form";

export default async function SriIssuePointsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Puntos de emision"
        description="Cada establecimiento puede tener uno o varios puntos de emision."
        activeHref={routes.sriIssuePoints}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [establishments, issuePoints] = await Promise.all([
    listSriEstablishments(tenant.id),
    listSriIssuePoints(tenant.id),
  ]);

  return (
    <SriModuleShell
      title="Puntos de emision"
      description="Cada punto de emision tiene un codigo de 3 digitos dentro del establecimiento (ejemplo: 001)."
      activeHref={routes.sriIssuePoints}
    >
      {establishments.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Debes registrar al menos un establecimiento antes de agregar puntos de emision.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Agregar punto de emision</CardTitle>
          </CardHeader>
          <CardContent>
            <SriIssuePointForm
              establishments={establishments.map((e) => ({
                id: e.id,
                code: e.code,
                name: e.name,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Puntos de emision registrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {issuePoints.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay puntos de emision registrados. Agrega el primero con el formulario de arriba.
            </p>
          ) : (
            issuePoints.map((ip) => (
              <div
                key={ip.id}
                className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[auto_auto_1fr_auto]"
              >
                <span className="font-mono text-muted-foreground">{ip.establishment.code}</span>
                <span className="font-mono font-semibold">{ip.code}</span>
                <p className="font-medium">{ip.name}</p>
                <span className={`self-start text-xs ${ip.isActive ? "text-emerald-700" : "text-slate-400"}`}>
                  {ip.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
