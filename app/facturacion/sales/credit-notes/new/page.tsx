import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { CreditNoteEditor } from "./credit-note-editor";

export default async function NewCreditNotePage() {
  await requireDashboardSession();

  return (
    <DashboardShell contentClassName="mx-auto max-w-[1400px]" mainClassName="px-4 py-5">
      <CreditNoteEditor />
    </DashboardShell>
  );
}
