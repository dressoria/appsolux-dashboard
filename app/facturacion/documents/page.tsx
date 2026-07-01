import Link from "next/link";

import { BasicModuleShell } from "@/components/appsolux/basic/basic-module-shell";
import { BillingDocumentsList } from "@/components/appsolux/billing/billing-documents-list";
import { Button } from "@/components/ui/button";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { routes } from "@/config/routes";
import { loadCoreDocuments, loadErpDocuments } from "@/lib/core/billing/billing-documents";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

const PAGE_SIZE = 20;

// ── Filter tab definitions ────────────────────────────────────────────────────

const CORE_STATUS_TABS = [
  { key: "all", label: "Todos" },
  { key: "paid", label: "Pagados" },
  { key: "pending", label: "Pendientes" },
  { key: "canceled", label: "Cancelados" },
] as const;

const ERP_STATUS_TABS = [
  { key: "all", label: "Todos" },
  { key: "AUTHORIZED", label: "Autorizados" },
  { key: "SENT", label: "Recibidos SRI" },
  { key: "SIGNED", label: "Firmados" },
  { key: "READY_FOR_TESTING", label: "Listos" },
  { key: "REJECTED", label: "Rechazados" },
  { key: "DRAFT", label: "Borradores" },
] as const;

// ── Page ──────────────────────────────────────────────────────────────────────

type Props = {
  searchParams: Promise<{ status?: string; page?: string }>;
};

function normalizePage(raw: string | undefined): number {
  const n = parseInt(raw ?? "1", 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export default async function FacturacionDocumentsPage({ searchParams }: Props) {
  const { tenant } = await requireDashboardSession();
  const [resolvedParams, tenantMode] = await Promise.all([
    searchParams,
    getTenantModeState(tenant),
  ]);

  const statusParam = resolvedParams.status ?? "all";
  const page = normalizePage(resolvedParams.page);

  const isErp = tenantMode.canUseAdvancedErp;
  const mode = isErp ? "SHARED_ERP" : "CORE";

  const { items, total } = isErp
    ? await loadErpDocuments(tenant.id, { status: statusParam, page, perPage: PAGE_SIZE })
    : await loadCoreDocuments(tenant.id, { status: statusParam, page, perPage: PAGE_SIZE });

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const tabs = isErp ? ERP_STATUS_TABS : CORE_STATUS_TABS;
  const activeTab = statusParam === "all" ? "all" : (tabs.find((t) => t.key === statusParam)?.key ?? "all");

  function tabHref(key: string) {
    const params = new URLSearchParams();
    if (key !== "all") params.set("status", key);
    const qs = params.toString();
    return qs ? `${routes.facturacionDocuments}?${qs}` : routes.facturacionDocuments;
  }

  function pageHref(p: number) {
    const params = new URLSearchParams();
    if (statusParam !== "all") params.set("status", statusParam);
    if (p > 1) params.set("page", String(p));
    const qs = params.toString();
    return qs ? `${routes.facturacionDocuments}?${qs}` : routes.facturacionDocuments;
  }

  const compactActions = (
    <div className="flex flex-wrap gap-2">
      <Button asChild variant="outline" size="sm">
        <Link href={routes.facturacionPos}>Ir al POS</Link>
      </Button>
      {!isErp && (
        <Button asChild variant="outline" size="sm">
          <Link href={routes.sriDocuments}>Historial SRI</Link>
        </Button>
      )}
    </div>
  );

  return (
    <DashboardShell mainClassName="" contentClassName="">
      <BasicModuleShell
        title="Documentos"
        description="Consulta ventas, recibos y comprobantes electrónicos generados desde Facturación."
        activeHref={routes.facturacionDocuments}
        action={compactActions}
      >
        <div className="space-y-4">
          {/* Status filter tabs — server-side */}
          <div className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <Button
                key={tab.key}
                asChild
                size="sm"
                variant={activeTab === tab.key ? "default" : "outline"}
              >
                <Link href={tabHref(tab.key)}>{tab.label}</Link>
              </Button>
            ))}
          </div>

          {/* Unified document list */}
          <BillingDocumentsList
            items={items}
            mode={mode}
            page={safePage}
            totalPages={totalPages}
            totalItems={total}
            prevHref={safePage > 1 ? pageHref(safePage - 1) : undefined}
            nextHref={safePage < totalPages ? pageHref(safePage + 1) : undefined}
          />
        </div>
      </BasicModuleShell>
    </DashboardShell>
  );
}
