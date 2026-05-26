import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { routes } from "@/config/routes";
import { getCurrentUser } from "@/lib/auth/current-user";
import {
  SRI_DOCUMENT_TYPE_LABELS,
  formatSequentialNumber,
  listSriEstablishments,
  listSriIssuePoints,
  listSriSequences,
} from "@/lib/core/sri";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { SriSequenceForm } from "./sequence-form";

export default async function SriSequencesPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <SriModuleShell
        title="Secuenciales"
        description="Define el numero inicial de cada tipo de comprobante por punto de emision."
        activeHref={routes.sriSequences}
      >
        <p className="text-muted-foreground">Sesion requerida.</p>
      </SriModuleShell>
    );
  }

  const tenant = await getCurrentTenant(user);
  const [establishments, issuePoints, sequences] = await Promise.all([
    listSriEstablishments(tenant.id),
    listSriIssuePoints(tenant.id),
    listSriSequences(tenant.id),
  ]);

  return (
    <SriModuleShell
      title="Secuenciales"
      description="Cada combinacion establecimiento-punto de emision-tipo de comprobante tiene su propio secuencial."
      activeHref={routes.sriSequences}
    >
      {issuePoints.length === 0 ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          Debes registrar establecimientos y puntos de emision antes de configurar secuenciales.
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configurar secuencial</CardTitle>
          </CardHeader>
          <CardContent>
            <SriSequenceForm
              establishments={establishments.map((e) => ({ id: e.id, code: e.code, name: e.name }))}
              issuePoints={issuePoints.map((ip) => ({
                id: ip.id,
                code: ip.code,
                name: ip.name,
                establishmentId: ip.establishmentId,
                establishmentCode: ip.establishment.code,
              }))}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Secuenciales configurados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {sequences.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay secuenciales configurados. Agrega el primero con el formulario de arriba.
            </p>
          ) : (
            sequences.map((seq) => (
              <div
                key={seq.id}
                className="grid gap-2 rounded-md border p-3 text-sm md:grid-cols-[auto_auto_1fr_auto_auto]"
              >
                <span className="font-mono text-muted-foreground">
                  {seq.establishment.code}-{seq.issuePoint.code}
                </span>
                <span className="font-medium">
                  {SRI_DOCUMENT_TYPE_LABELS[seq.documentType] ?? seq.documentType}
                </span>
                <p className="text-muted-foreground">
                  Secuencial actual: {formatSequentialNumber(seq.currentNumber)}
                </p>
                <span className={`self-start text-xs ${seq.isActive ? "text-emerald-700" : "text-slate-400"}`}>
                  {seq.isActive ? "Activo" : "Inactivo"}
                </span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </SriModuleShell>
  );
}
