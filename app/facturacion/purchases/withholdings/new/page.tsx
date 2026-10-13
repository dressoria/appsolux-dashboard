import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { NewWithholdingClient } from "./new-withholding-client";

export default async function NewWithholdingPage() {
  await requireDashboardSession();

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-4xl">
      <NewWithholdingClient />
    </DashboardShell>
  );
}
