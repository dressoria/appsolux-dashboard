import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getSriProfile, listSriEstablishments } from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { SriEstablishmentForm } from "./establishment-form";

export default async function SriEstablishmentsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Establecimientos"
        description="Registra los establecimientos autorizados por el SRI para emitir comprobantes."
        activeHref={routes.sriEstablishments}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [profile, establishments] = await Promise.all([
    getSriProfile(tenant.id),
    listSriEstablishments(tenant.id),
  ]);

  return (
    <SriModuleShell
      title="Establecimientos"
      description="Cada establecimiento tiene un codigo de 3 digitos asignado por el SRI (ejemplo: 001)."
      activeHref={routes.sriEstablishments}
    >
      {!profile && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Debes configurar la empresa y RUC antes de agregar establecimientos.
        </div>
      )}

      {profile && (
        <Card>
          <CardHeader>
            <CardTitle>Agregar establecimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <SriEstablishmentForm profileId={profile.id} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Establecimientos registrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {establishments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay establecimientos registrados. Agrega el primero con el formulario de arriba.
            </p>
          ) : (
            establishments.map((est) => (
              <div
                key={est.id}
                className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[auto_1fr_auto_auto]"
              >
                <span className="font-mono font-semibold">{est.code}</span>
                <div>
                  <p className="font-medium">{est.name}</p>
                  <p className="text-xs text-muted-foreground">{est.address}</p>
                </div>
                <span className={`self-start text-xs ${est.isMain ? "text-blue-700" : "text-muted-foreground"}`}>
                  {est.isMain ? "Principal" : "Secundario"}
                </span>
                <span className={`self-start text-xs ${est.isActive ? "text-emerald-700" : "text-slate-400"}`}>
                  {est.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
