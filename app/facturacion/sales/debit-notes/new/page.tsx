import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { DebitNoteEditor } from "./debit-note-editor";

export default async function NewDebitNotePage() {
  await requireDashboardSession();

  return (
    <DashboardShell contentClassName="mx-auto max-w-[1400px]" mainClassName="px-4 py-5">
      <DebitNoteEditor />
    </DashboardShell>
  );
}
