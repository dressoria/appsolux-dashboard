import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/appsolux/layout/dashboard-shell";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { assertContractOwner } from "@/lib/legal/service";
export const dynamic = "force-dynamic";
export default async function ContractHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const tenant = await getCurrentTenant(user);
  const db = getPrismaClient();
  try { await assertContractOwner(db, user.id, tenant.id); } catch { redirect("/billing"); }
  const entries = await db.legalAcceptance.findMany({ where: { tenantId: tenant.id }, orderBy: { acceptedAt: "desc" }, take: 100, include: { release: { include: { documents: true } } } });
  return <DashboardShell><div className="space-y-5"><h1 className="text-2xl font-bold">Historial contractual de {tenant.name}</h1>{!entries.length ? <p>No hay nuevas aceptaciones registradas. Las suscripciones anteriores conservan su acceso.</p> : null}{entries.map((entry) => <article className="space-y-3 rounded-xl border p-5" key={entry.id}><h2 className="font-semibold">{entry.context} · {entry.planCode} · {entry.billingInterval ?? "Prueba"}</h2><p>{entry.acceptedAt.toISOString()} · Versión {entry.release.version}</p><p className="break-all text-xs">Evidencia {entry.id} · SHA-256 {entry.releaseHash}</p>{entry.release.documents.map((doc) => <details key={doc.id}><summary>{doc.title} · {doc.version}</summary><p className="whitespace-pre-wrap py-4">{doc.content}</p><p className="break-all text-xs">SHA-256 {doc.hash}</p></details>)}</article>)}</div></DashboardShell>;
}
