import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { getLegalOperator, missingLegalOperatorFields } from "../lib/legal/config";
import { legalDocuments } from "../lib/legal/catalog";
import { prepareLegalDraft, approveLegalDraft, publishLegalRelease } from "../lib/legal/publication";
import { getPrismaClient } from "../lib/db/prisma";
const args = process.argv.slice(2);
const option = (name: string) => { const index = args.indexOf(name); return index >= 0 ? args[index + 1] : undefined; };
async function main() {
  const action = args[0] ?? "check";
  if (action === "check") { console.log({ missing: missingLegalOperatorFields(), message: "No se modificó la base. Completar identidad y revisión antes de publicar." }); return; }
  if (action === "prepare") {
    const operator = getLegalOperator();
    const contents: Record<string, string> = {};
    for (const doc of legalDocuments) {
      let text = await readFile(resolve(option("--directory") || "docs/legal/drafts", `${doc.type}.md`), "utf8");
      for (const [key, value] of Object.entries(operator)) if (value) text = text.replaceAll(`{{${key}}}`, value);
      contents[doc.type] = text;
    }
    const release = await prepareLegalDraft({ version: option("--version") ?? "", effectiveAt: new Date(operator.effectiveDate), contents });
    console.log({ id: release.id, hash: release.hash, status: release.status, missing: missingLegalOperatorFields() });
  } else if (action === "approve") {
    const review = JSON.parse(await readFile(option("--review-file") ?? "", "utf8"));
    const release = await approveLegalDraft(option("--id") ?? "", option("--hash") ?? "", option("--lawyer-reference") || "", review);
    console.log({ id: release.id, hash: release.hash, status: release.status });
  } else if (action === "publish") {
    if (!args.includes("--publish-reviewed-contracts")) throw new Error("Publicación requiere --publish-reviewed-contracts y el hash revisado.");
    const release = await publishLegalRelease(option("--id") ?? "", option("--hash") ?? "");
    console.log({ id: release.id, hash: release.hash, status: release.status });
  } else if (action === "purge-expired-technical") {
    if (!args.includes("--apply")) { console.log({ dryRun: true, count: await getPrismaClient().legalAcceptanceTechnicalEvidence.count({ where: { expiresAt: { lte: new Date() } } }) }); return; }
    console.log(await getPrismaClient().legalAcceptanceTechnicalEvidence.deleteMany({ where: { expiresAt: { lte: new Date() } } }));
  } else throw new Error("Acción desconocida.");
}
main().catch(() => { console.error("No se completó la operación legal. Revisa parámetros, configuración y estado del borrador."); process.exitCode = 1; }).finally(async () => { if (process.env.DATABASE_URL) await getPrismaClient().$disconnect(); });
