import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock3, FileText, ReceiptText, XCircle } from "lucide-react";

import { BillingDocumentsList } from "@/components/appsolux/billing/billing-documents-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { routes } from "@/config/routes";
import { loadCoreDocuments, loadErpDocuments } from "@/lib/core/billing/billing-documents";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

const PAGE_SIZE = 20;

// ── Filter tab definitions ────────────────────────────────────────────────────

const CORE_STATUS_OPTIONS = [
  { key: "all", label: "Todos" },
  { key: "paid", label: "Pagados" },
  { key: "pending", label: "Pendientes" },
  { key: "canceled", label: "Cancelados" },
] as const;

const ERP_STATUS_OPTIONS = [
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

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function isPendingSri(status: string | null) {
  return status === "DRAFT" || status === "READY_FOR_TESTING" || status === "SIGNED" || status === "SENT";
}

function MetricPill({
  title,
  value,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  icon: typeof FileText;
  tone: "green" | "neutral" | "warning" | "danger";
}) {
  const toneClasses = {
    green: "border-facturom-primary/15 bg-facturom-primary/10 text-facturom-primary",
    neutral: "border-slate-200 bg-slate-50 text-slate-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
  } as const;

  return (
    <div className={`rounded-[20px] border px-4 py-3 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/70">
          <Icon className="h-4 w-4" />
        </div>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em]">{title}</p>
          <p className="text-lg font-black">{value}</p>
        </div>
      </div>
    </div>
  );
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

  const loadResult = isErp
    ? await loadErpDocuments(tenant.id, {
        status: statusParam,
        page,
        perPage: PAGE_SIZE,
        includeBasicHistory: true,
      })
    : { ...(await loadCoreDocuments(tenant.id, { status: statusParam, page, perPage: PAGE_SIZE })), basicHistoryCount: 0 };

  const { items, total } = loadResult;

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const statusOptions = isErp ? ERP_STATUS_OPTIONS : CORE_STATUS_OPTIONS;

  function statusHref(key: string) {
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

  const totalDocuments = total + (isErp ? loadResult.basicHistoryCount : 0);
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const monthDocs = items.filter((item) => item.issuedAt && new Date(item.issuedAt) >= startOfMonth);
  const monthTotal = monthDocs.reduce((sum, item) => sum + Number(item.total ?? 0), 0);
  const authorizedCount = items.filter((item) => item.sriStatus === "AUTHORIZED").length;
  const pendingSriCount = items.filter((item) => isPendingSri(item.sriStatus)).length;
  const rejectedCount = items.filter((item) => item.sriStatus === "REJECTED").length;

  return (
    <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-7xl">
      <div className="space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm sm:px-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="space-y-2">
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Documentos</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-600 sm:text-base">
                Consulta ventas, recibos y comprobantes electrónicos generados desde Facturom.
              </p>
            </div>
            {compactActions}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-5">
            <MetricPill title="Total documentos" value={String(totalDocuments)} icon={FileText} tone="neutral" />
            <MetricPill title="Total del mes" value={formatMoney(monthTotal)} icon={ReceiptText} tone="green" />
            <MetricPill title="Autorizados" value={String(authorizedCount)} icon={CheckCircle2} tone="green" />
            <MetricPill title="Pendientes SRI" value={String(pendingSriCount)} icon={Clock3} tone="warning" />
            <MetricPill title="Rechazados" value={String(rejectedCount)} icon={XCircle} tone="danger" />
          </div>
        </section>

        <Card className="rounded-[28px] border-slate-200 bg-white shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">
              <AlertCircle className="h-3.5 w-3.5 text-facturom-primary" />
              Documentos y seguimiento
            </div>
            <BillingDocumentsList
              items={items}
              mode={mode}
              page={safePage}
              totalPages={totalPages}
              totalItems={total}
              prevHref={safePage > 1 ? pageHref(safePage - 1) : undefined}
              nextHref={safePage < totalPages ? pageHref(safePage + 1) : undefined}
              statusOptions={statusOptions.map((option) => ({
                key: option.key,
                label: option.label,
                href: statusHref(option.key),
              }))}
              currentStatus={statusParam}
            />
          </CardContent>
        </Card>
      </div>
    </DashboardShell>
  );
}
