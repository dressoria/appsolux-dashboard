import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getJournalEntries } from "@/lib/core/accounting-journal";
import { JournalClient } from "./journal-client";

export default async function JournalPage() {
  const { tenant } = await requireDashboardSession();
  const result = await getJournalEntries(tenant.id, { page: 1, pageSize: 25 });

  return (
    <DashboardShell>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">Contabilidad</p>
          <h1 className="text-3xl font-semibold tracking-tight">Asientos contables</h1>
        </div>
        <JournalClient
          initialEntries={JSON.parse(JSON.stringify(result.entries))}
          totalPages={result.totalPages}
          currentPage={result.page}
        />
      </div>
    </DashboardShell>
  );
}
