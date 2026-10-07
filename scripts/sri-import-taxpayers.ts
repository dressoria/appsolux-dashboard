import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { PrismaClient } from "@prisma/client";
import unzipper from "unzipper";
import {
  discoverSriTaxpayerResources,
  getSriImportRunStatus,
  importNormalizedRecords,
  normalizeSriTaxpayerRow,
  parsePipeDelimitedLine,
  PrismaSriTaxpayerStore,
  rowFromHeaders,
  SRI_EXPECTED_PROVINCE_COUNT,
  SRI_DATASETS_URL,
  SRI_DATA_USER_AGENT,
  SRI_PROVINCES,
  type NormalizedSriTaxpayerRecord,
  type SriTaxpayerDatasetResource,
  validateSriTaxpayerResource,
} from "../lib/core/sri-data-service.ts";

const prisma = new PrismaClient();

async function* recordsFromResource(
  resource: SriTaxpayerDatasetResource,
): AsyncGenerator<NormalizedSriTaxpayerRecord | null> {
  const response = await fetch(resource.url, {
    headers: {
      "User-Agent": SRI_DATA_USER_AGENT,
      Accept: "application/zip,application/octet-stream",
    },
    signal: AbortSignal.timeout(10 * 60_000),
  });
  if (!response.ok || !response.body)
    throw new Error(
      `No se pudo descargar ${resource.province} (${response.status}).`,
    );
  const archive = Readable.fromWeb(response.body as never).pipe(
    unzipper.Parse({ forceStream: true }),
  );
  let foundCsv = false;
  for await (const entry of archive) {
    if (entry.type !== "File" || !entry.path.toLowerCase().endsWith(".csv")) {
      entry.autodrain();
      continue;
    }
    foundCsv = true;
    let headers: string[] | null = null;
    const lines = createInterface({ input: entry, crlfDelay: Infinity });
    for await (const line of lines) {
      if (!headers) {
        headers = parsePipeDelimitedLine(line);
        continue;
      }
      yield normalizeSriTaxpayerRow(
        rowFromHeaders(headers, parsePipeDelimitedLine(line)),
      );
    }
  }
  if (!foundCsv)
    throw new Error(`El ZIP de ${resource.province} no contiene CSV.`);
}

async function main() {
  const updateOnly = process.argv.includes("--update");
  const dryRun = process.argv.includes("--dry-run");
  const resources = await discoverSriTaxpayerResources();
  const uniqueProvinces = new Set(
    resources.map((resource) => resource.province),
  );
  const missingProvinces = SRI_PROVINCES.filter(
    (province) => !uniqueProvinces.has(province),
  );
  if (dryRun) {
    for (const resource of resources) {
      try {
        const metadata = await validateSriTaxpayerResource(resource);
        const size = metadata.sizeBytes
          ? `${(metadata.sizeBytes / 1024 / 1024).toFixed(2)} MiB`
          : "no informado";
        console.log(
          `${resource.province}: ${resource.url} | ${metadata.fileType} | ${size}`,
        );
      } catch (error) {
        console.error(
          `${resource.province}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    console.log(`Fuentes encontradas: ${uniqueProvinces.size}/${SRI_EXPECTED_PROVINCE_COUNT}`);
    if (missingProvinces.length)
      console.error(`Provincias faltantes: ${missingProvinces.join(", ")}`);
    console.log("Dry-run completado; no se escribió en PostgreSQL ni se descargaron ZIPs completos.");
    if (missingProvinces.length) process.exitCode = 1;
    return;
  }
  if (!resources.length)
    throw new Error("No se descubrieron fuentes oficiales SRI para importar.");
  const version = resources
    .map((resource) => `${resource.province}:${resource.modifiedAt ?? ""}`)
    .sort()
    .join("|");
  if (updateOnly && resources.every((resource) => resource.modifiedAt)) {
    const previous = await prisma.sriTaxpayerImportRun.findFirst({
      where: {
        status: "succeeded",
        sourceVersion: version,
        filesProcessed: resources.length,
        errors: 0,
      },
      select: { id: true },
    });
    if (previous) {
      console.log(
        "El catálogo oficial no presenta cambios desde la última importación.",
      );
      return;
    }
  }
  const run = await prisma.sriTaxpayerImportRun.create({
    data: {
      status: "running",
      sourceCatalogUrl: SRI_DATASETS_URL,
      sourceVersion: version,
    },
  });
  const summary = {
    filesProcessed: 0,
    recordsRead: 0,
    inserted: 0,
    updated: 0,
    unchanged: 0,
    errors: missingProvinces.length,
  };
  const failureMessages: string[] = missingProvinces.map(
    (province) => `${province}: no se descubrió una fuente oficial.`,
  );
  const store = new PrismaSriTaxpayerStore(prisma);
  try {
    for (const resource of resources) {
      try {
        const result = await importNormalizedRecords(
          recordsFromResource(resource),
          store,
        );
        summary.filesProcessed++;
        summary.recordsRead += result.recordsRead;
        summary.inserted += result.inserted;
        summary.updated += result.updated;
        summary.unchanged += result.unchanged;
        summary.errors += result.errors;
        console.log(
          `${resource.province}: ${result.recordsRead} leídos, ${result.inserted} nuevos, ${result.updated} actualizados.`,
        );
      } catch (error) {
        summary.errors++;
        const message = `${resource.province}: ${error instanceof Error ? error.message : String(error)}`;
        failureMessages.push(message);
        console.error(message);
      }
    }
    await prisma.sriTaxpayerImportRun.update({
      where: { id: run.id },
      data: {
        status: getSriImportRunStatus(summary, resources.length),
        finishedAt: new Date(),
        errorMessage: failureMessages.length
          ? failureMessages.join("\n").slice(0, 1000)
          : null,
        ...summary,
      },
    });
    console.log(
      `Archivos procesados: ${summary.filesProcessed}\nRegistros leídos: ${summary.recordsRead}\nNuevos: ${summary.inserted}\nActualizados: ${summary.updated}\nSin cambios: ${summary.unchanged}\nErrores: ${summary.errors}`,
    );
    if (summary.filesProcessed !== resources.length || summary.errors !== 0)
      process.exitCode = 1;
  } catch (error) {
    await prisma.sriTaxpayerImportRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        finishedAt: new Date(),
        errorMessage: [
          ...failureMessages,
          error instanceof Error ? error.message : String(error),
        ]
          .join("\n")
          .slice(0, 1000),
        ...summary,
      },
    });
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
