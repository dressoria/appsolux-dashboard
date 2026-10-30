import Link from "next/link";

import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { DebitNotesClient } from "./debit-notes-client";

export default async function DebitNotesPage() {
  await requireDashboardSession();

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-7xl">
      <div className="space-y-5">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Notas de débito</h1>
            <p className="mt-1 text-sm text-slate-600">Emite notas de débito por intereses, gastos u otros cargos.</p>
          </div>
          <Button asChild className="rounded-xl bg-facturom-primary hover:bg-facturom-primary-soft">
            <Link href={routes.facturacionDebitNotesNew}>+ Nueva nota de débito</Link>
          </Button>
        </header>
        <DebitNotesClient />
      </div>
    </DashboardShell>
  );
}
