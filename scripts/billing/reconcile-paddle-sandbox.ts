// This command never creates payments, transactions or subscriptions and never replays notifications.
import { timingSafeEqual } from "node:crypto";
import { getPrismaClient } from "../../lib/db/prisma";
import { getPaddleClient, getPaddleEnvironment, getPaddleWebhookSecret, getBillingAppUrl } from "../../lib/core/billing/paddle-config";
import { receivePaddleEvent, processPaddleInbox } from "../../lib/core/billing/paddle-inbox";
import { resolvePaddlePriceId } from "../../lib/core/billing/paddle-price-map";
const args = process.argv.slice(2);
function option(name: string) { const i = args.indexOf(name); return i < 0 ? undefined : args[i + 1]; }
async function main() {
  if (getPaddleEnvironment() !== "sandbox") throw new Error("Solo Sandbox está permitido en esta herramienta.");
  if (!args.includes("--read-provider")) { console.log({ dryRun: true, networkCalls: 0, databaseWrites: 0, instruction: "Tras autorización, usa --read-provider --subscription-id sub_... para diagnóstico de solo lectura. --apply-existing-subscription agrega el snapshot verificado a la bandeja local; no produce cobros." }); return; }
  const id = option("--subscription-id");
  if (!id?.startsWith("sub_")) throw new Error("Indica una suscripción Sandbox existente.");
  const paddle = getPaddleClient();
  if (option("--destination-id")) {
    const destination = await paddle.notificationSettings.get(option("--destination-id")!);
    const expected = Buffer.from(getPaddleWebhookSecret());
    const actual = Buffer.from(destination.endpointSecretKey ?? "");
    const matches = expected.length === actual.length && timingSafeEqual(expected, actual);
    const endpointMatches = destination.destination === `${getBillingAppUrl()}/api/billing/webhooks/paddle`;
    console.log({ endpointMatches, destinationId: destination.id, active: destination.active, destinationMatchesConfiguredSecret: matches });
    if (!matches || !destination.active || !endpointMatches) throw new Error("Destino o secreto no coincide con el entorno configurado.");
  }
  const subscription = await paddle.subscriptions.get(id);
  const token = subscription.customData?.cid;
  const db = getPrismaClient();
  const intent = typeof token === "string" ? await db.paddleCheckoutIntent.findUnique({ where: { token } }) : null;
  const link = await db.paddleSubscriptionLink.findUnique({ where: { environment_providerSubscriptionId: { environment: "sandbox", providerSubscriptionId: id } } });
  const price = subscription.items[0]?.price?.id;
  const selection = price ? resolvePaddlePriceId(price) : null;
  const local = await db.tenantSubscription.findFirst({ where: { ...(link ? { tenantId: link.tenantId } : intent ? { tenantId: intent.tenantId } : { providerSubscriptionId: id }) }, orderBy: { startedAt: "desc" } });
  const errors: string[] = [];
  if (!local || (!intent && !link && local.providerSubscriptionId !== id)) errors.push("MAPPING_MISSING");
  if (!selection || subscription.items.length !== 1 || subscription.items[0].quantity !== 1) errors.push("PRICE_OR_QUANTITY_INVALID");
  if (intent && ((intent.environment && intent.environment !== "sandbox") || intent.expectedPriceId !== price || (link && link.tenantId !== intent.tenantId) || (intent.paddleSubscriptionId && intent.paddleSubscriptionId !== id))) errors.push("INTENT_BINDING_MISMATCH");
  if (intent && intent.status === "pending" && (new Date(subscription.createdAt) < intent.createdAt || new Date(subscription.createdAt) > intent.expiresAt)) errors.push("PURCHASE_OUTSIDE_WINDOW");
  if (local?.billingMode === "manual" && local.providerSubscriptionId !== id && !intent) errors.push("HISTORICAL_SUBSCRIPTION_REQUIRES_REVIEW");
  if (subscription.status !== "active") errors.push("SUBSCRIPTION_NOT_ACTIVE");
  if (!subscription.currentBillingPeriod) errors.push("PERIOD_MISSING");
  console.log({ dryRun: !args.includes("--apply-existing-subscription"), subscriptionId: id, providerStatus: subscription.status, expectedPlan: selection?.planCode, interval: selection?.billingInterval, intentId: intent?.id, alreadyLinked: !!link, period: subscription.currentBillingPeriod, errors });
  if (errors.length) throw new Error("La validación de reconciliación requiere revisión.");
  if (!args.includes("--apply-existing-subscription")) return;
  // The authenticated provider GET is authoritative; processing uses the same transaction/idempotence rules as signed events.
  const eventId = `reconcile:sandbox:${id}:${subscription.updatedAt}`;
  await receivePaddleEvent({ eventId, eventType: "subscription.updated", occurredAt: subscription.updatedAt, data: subscription as unknown as Record<string, unknown> });
  await processPaddleInbox();
  const outcome = await db.billingWebhookEvent.findUniqueOrThrow({ where: { provider_externalEventId: { provider: "PADDLE", externalEventId: eventId } }, select: { status: true, errorMessage: true } });
  console.log({ eventId, ...outcome });
  if (outcome.status !== "processed") process.exitCode = 1;
}
main().catch(() => { console.error("Reconciliación detenida. No se crearon cobros. Revisa configuración y diagnóstico seguro."); process.exitCode = 1; }).finally(async () => { if (process.env.DATABASE_URL) await getPrismaClient().$disconnect(); });
