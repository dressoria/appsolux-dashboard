import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";

export default function SriLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell mainClassName="" contentClassName="">
      {children}
    </DashboardShell>
  );
}
