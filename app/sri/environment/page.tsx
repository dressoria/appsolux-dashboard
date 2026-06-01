import { SriModuleShell } from "@/components/appsolux/sri/sri-module-shell";
import { SriEnvironmentActions } from "@/components/appsolux/sri/sri-environment-actions";
import { routes } from "@/config/routes";

export default function SriEnvironmentPage() {
  return (
    <SriModuleShell
      title="Ambiente"
      description="Controla si los comprobantes se emitiran en ambiente de pruebas o produccion del SRI."
      activeHref={routes.sriEnvironment}
    >
      <SriEnvironmentActions />
    </SriModuleShell>
  );
}
