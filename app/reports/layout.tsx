import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell mainClassName="" contentClassName="">
      {children}
    </DashboardShell>
  );
}
