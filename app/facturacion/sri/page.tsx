import SriPage from "@/app/sri/page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";

export default async function FacturacionSriPage() {
  return (
    <DashboardShell mainClassName="" contentClassName="">
      <SriPage />
    </DashboardShell>
  );
}
