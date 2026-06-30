import { BasicHomePage } from "@/components/appsolux/basic/basic-home-page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";

export default async function FacturacionBasicHistoryPage() {
  return (
    <DashboardShell mainClassName="" contentClassName="">
      <BasicHomePage />
    </DashboardShell>
  );
}
