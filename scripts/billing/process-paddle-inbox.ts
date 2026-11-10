import { getPrismaClient } from "../../lib/db/prisma";
import { processPaddleInbox } from "../../lib/core/billing/paddle-inbox";
import { getPaddleEnvironment } from "../../lib/core/billing/paddle-config";
const args = process.argv.slice(2);
async function main() {
  const db = getPrismaClient();
  if (!args.includes("--process")) {
    console.log({ dryRun: true, environment: getPaddleEnvironment(), counts: await db.billingWebhookEvent.groupBy({ by: ["status"], where: { provider: "PADDLE", environment: getPaddleEnvironment() }, _count: true }) }); return;
  }
  const index = args.indexOf("--retry-failed-event");
  if (index >= 0) {
    const eventId = args[index + 1];
    if (!eventId) throw new Error("Missing event ID");
    console.log(await processPaddleInbox(1, { retryFailedEventId: eventId }));
  } else console.log(await processPaddleInbox());
}
main().catch(() => { console.error("No se completó el procesamiento de la bandeja Paddle."); process.exitCode = 1; }).finally(async () => { if (process.env.DATABASE_URL) await getPrismaClient().$disconnect(); });
