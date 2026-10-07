import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const BATCH_SIZE = 200;

async function main() {
  const profiles = await prisma.sriTaxpayerProfile.findMany({
    select: { tenantId: true, ruc: true },
    orderBy: { tenantId: "asc" },
  });
  let updated = 0;
  let withoutLocalRecord = 0;

  for (let offset = 0; offset < profiles.length; offset += BATCH_SIZE) {
    const batch = profiles.slice(offset, offset + BATCH_SIZE);
    const records = await prisma.sriTaxpayerRecord.findMany({
      where: { ruc: { in: batch.map((profile) => profile.ruc) } },
      select: {
        ruc: true,
        taxpayerStatus: true,
        taxpayerClass: true,
        taxpayerType: true,
        accountingRequired: true,
      },
    });
    const byRuc = new Map(records.map((record) => [record.ruc, record]));
    const operations = batch.flatMap((profile) => {
      const record = byRuc.get(profile.ruc);
      if (!record) {
        withoutLocalRecord++;
        return [];
      }
      updated++;
      return [
        prisma.sriTaxpayerProfile.update({
          where: { tenantId: profile.tenantId },
          data: {
            taxpayerStatus: record.taxpayerStatus,
            taxpayerClass: record.taxpayerClass,
            taxpayerType: record.taxpayerType,
            ...(record.accountingRequired == null
              ? {}
              : { accountingRequired: record.accountingRequired }),
          },
        }),
      ];
    });
    if (operations.length) await prisma.$transaction(operations);
  }

  console.log(
    `Backfill SRI completado. Perfiles actualizados: ${updated}. Sin registro local: ${withoutLocalRecord}.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
