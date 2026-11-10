import { getPrismaClient } from "../../lib/db/prisma";
const args = process.argv.slice(2);
async function main() {
  const index = args.indexOf("--id");
  if (index < 0 || !args[index + 1]) { console.log({ readOnly: true, instruction: "Indica --id SOLICITUD. Este comando solo diagnostica; la aprobación se realiza en la interfaz autorizada después de revisar el pago." }); return; }
  const db = getPrismaClient();
  const request = await db.bankTransferRequest.findUniqueOrThrow({ where: { id: args[index + 1] }, select: { id: true, tenantId: true, planCode: true, billingInterval: true, status: true, activationErrorCode: true, invoiceStatus: true, invoiceReference: true, activatedSubscriptionId: true, subscriptionStartsAt: true, subscriptionEndsAt: true, pendingInvoice: { select: { id: true } } } });
  const [subscription, pendingAuditCount] = await Promise.all([
    db.tenantSubscription.findFirst({ where: { tenantId: request.tenantId }, orderBy: { startedAt: "desc" }, select: { id: true, planId: true, status: true, billingMode: true, billingInterval: true, currentPeriodStartsAt: true, currentPeriodEndsAt: true, providerSubscriptionId: true, cancelAtPeriodEnd: true } }),
    db.auditLog.count({ where: { tenantId: request.tenantId, entityId: request.id, action: "commercial_invoice.pending" } }),
  ]);
  console.log({ readOnly: true, request, subscription, pendingAuditCount, taxInvoiceIssued: "No se puede inferir de invoiceStatus=pending; verificar comprobante autorizado por separado." });
}
main().catch(() => { console.error("No fue posible consultar la solicitud de forma segura."); process.exitCode = 1; }).finally(async () => { if (process.env.DATABASE_URL) await getPrismaClient().$disconnect(); });
