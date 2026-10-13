import "@/lib/security/server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import type { AtsPeriodData } from "./ats-data";
import { money } from "./money";

export function escapeXml(value: string) {
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(value))
    throw new Error("Caracteres XML inválidos.");
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function buildAtsXml(data: AtsPeriodData) {
  if (data.domainStatus !== "DOMAIN_VALIDATION_OK" || !data.company)
    throw new Error(
      "ATS_EXPORT_BLOCKED: Corrija los errores y complete el mapeo ATS antes de exportar.",
    );
  // A period without transactions can be serialized for technical validation.
  // Non-empty periods are blocked by buildAtsPeriodData until official mappings
  // and the mandatory source fields exist. Nothing is silently omitted.
  if (data.hasInformation) throw new Error("ATS_CATALOG_MAPPING_PENDING");
  const tag = (name: string, value: string) =>
    `<${name}>${escapeXml(value)}</${name}>`;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<iva>${tag("TipoIDInformante", "R")}${tag("IdInformante", data.company.ruc)}${tag("razonSocial", data.company.legalName)}${tag("Anio", String(data.period.year))}${tag("Mes", String(data.period.month).padStart(2, "0"))}${data.period.frequency === "SEMIANNUAL" ? tag("regimenMicroempresa", "SI") : ""}${tag("totalVentas", money(data.totals.sales.base))}${tag("codigoOperativo", "IVA")}</iva>\n`;
}

export async function validateAtsXsd(xml: string): Promise<{
  status: "XSD_VALIDATED" | "XSD_VALIDATION_ERROR" | "XSD_VALIDATION_PENDING";
  detail: string;
}> {
  const schema = path.join(process.cwd(), "lib/core/sri-tax/resources/at.xsd");
  return new Promise((resolve) => {
    const child = spawn(
      "xmllint",
      ["--nonet", "--noout", "--schema", schema, "-"],
      { stdio: ["pipe", "ignore", "pipe"], timeout: 10_000 },
    );
    let detail = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (detail.length < 4000) detail += chunk.toString();
    });
    child.stdin.on("error", () => {});
    child.on("error", () =>
      resolve({
        status: "XSD_VALIDATION_PENDING",
        detail: "Validador XSD no disponible en este entorno.",
      }),
    );
    child.on("close", (code) =>
      resolve({
        status:
          code === 0
            ? "XSD_VALIDATED"
            : code === 5 || detail.includes("failed to load external entity")
              ? "XSD_VALIDATION_PENDING"
              : "XSD_VALIDATION_ERROR",
        detail:
          code === 0
            ? "XML validado contra el esquema oficial descargado del SRI."
            : detail || "Validación XSD interrumpida.",
      }),
    );
    child.stdin.end(xml);
  });
}
