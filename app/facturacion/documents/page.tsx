import Link from "next/link";
import { CheckCircle2, Clock3, FileText, ReceiptText } from "lucide-react";

import { BillingDocumentsList } from "@/components/appsolux/billing/billing-documents-list";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { Button } from "@/components/ui/button";
import { routes } from "@/config/routes";
import { loadCoreDocuments, loadErpDocuments } from "@/lib/core/billing/billing-documents";
import { requireDashboardSession } from "@/lib/core/require-dashboard-session";
import { getTenantModeState } from "@/lib/core/tenant-mode";

type FilterKey = "all" | "receipt" | "sri" | "authorized" | "pending" | "rejected" | "canceled";
type Props = { searchParams: Promise<{ q?: string; type?: string; page?: string; perPage?: string; from?: string; to?: string; sort?: string }> };
const FILTERS = new Set<FilterKey>(["all", "receipt", "sri", "authorized", "pending", "rejected", "canceled"]);
function integer(value: string | undefined, fallback: number) { const parsed = Number.parseInt(value ?? "", 10); return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback; }
function dateValue(value: string | undefined, end = false) { if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined; const date = new Date(`${value}T${end ? "23:59:59.999" : "00:00:00.000"}-05:00`); return Number.isNaN(date.getTime()) ? undefined : date; }

export default async function FacturacionDocumentsPage({ searchParams }: Props) {
  const { tenant } = await requireDashboardSession();
  const [params, mode] = await Promise.all([searchParams, getTenantModeState(tenant)]);
  const page = integer(params.page, 1); const perPageCandidate = integer(params.perPage, 10); const perPage = [10,25,50].includes(perPageCandidate) ? perPageCandidate : 10;
  const type = FILTERS.has(params.type as FilterKey) ? params.type as FilterKey : "all"; const sort = params.sort === "total" ? "total" as const : "date" as const;
  const result = mode.canUseAdvancedErp
    ? await loadErpDocuments(tenant.id, { page, perPage, includeBasicHistory: true })
    : await loadCoreDocuments(tenant.id, { page, perPage, type, search: params.q, from: dateValue(params.from), to: dateValue(params.to,true), sort });
  const totalPages = Math.max(1, Math.ceil(result.total / perPage));
  const sriCount = result.items.filter((item) => item.sriDocumentId).length; const pending = result.items.filter((item) => ["DRAFT","READY_FOR_TESTING","SIGNED","SENT"].includes(item.sriStatus ?? "")).length; const authorized = result.items.filter((item) => item.sriStatus === "AUTHORIZED").length;
  return <DashboardShell mainClassName="px-4 py-6 sm:px-6 sm:py-8" contentClassName="mx-auto max-w-7xl"><div className="space-y-5">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><h1 className="text-3xl font-black tracking-tight text-slate-950">Documentos</h1><p className="mt-1 text-sm text-slate-600">Consulta tus ventas, recibos y comprobantes electrónicos.</p></div><Button asChild className="rounded-xl bg-facturom-primary hover:bg-facturom-primary-soft"><Link href={routes.facturacionPos}>+ Nueva venta</Link></Button></header>
    <section className="grid grid-cols-2 gap-2 lg:grid-cols-4"><Metric icon={<FileText className="h-4 w-4"/>} label="Documentos" value={String(result.total)}/><Metric icon={<ReceiptText className="h-4 w-4"/>} label="Facturas en página" value={String(sriCount)}/><Metric icon={<Clock3 className="h-4 w-4"/>} label="Pendientes en página" value={String(pending)} tone="warning"/><Metric icon={<CheckCircle2 className="h-4 w-4"/>} label="Autorizados en página" value={String(authorized)} tone="success"/></section>
    <BillingDocumentsList items={result.items} page={Math.min(page,totalPages)} totalPages={totalPages} totalItems={result.total} currentFilter={type} search={params.q ?? ""} from={params.from ?? ""} to={params.to ?? ""} perPage={perPage} sort={sort} basePath={routes.facturacionDocuments}/>
  </div></DashboardShell>;
}

function Metric({ icon, label, value, tone = "neutral" }: { icon: React.ReactNode; label: string; value: string; tone?: "neutral" | "warning" | "success" }) { const colors = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-violet-700"; return <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><span className={colors}>{icon}</span><div><p className="text-[11px] uppercase tracking-wide text-slate-500">{label}</p><p className="text-lg font-black text-slate-950">{value}</p></div></div>; }
