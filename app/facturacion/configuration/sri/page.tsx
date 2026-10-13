import SriSetupPage from "@/app/sri/page";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";

export default async function Page() {
  await requireDashboardSession();
  return (
    <DashboardShell mainClassName="" contentClassName="">
      <SriSetupPage />
    </DashboardShell>
  );
}
