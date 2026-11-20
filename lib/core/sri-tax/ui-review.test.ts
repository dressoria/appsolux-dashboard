import assert from "node:assert/strict";
import test from "node:test";
import { Prisma, type PrismaClient } from "@prisma/client";
import { listReceivedDocuments, parseReceivedFilters } from "./received-documents";
import { atsPreparationState, taxIssueGroups } from "./ui-state";
import { buildAtsPeriodData } from "./ats-data";
import { parseTaxPeriod } from "./tax-period";
import { receivedXmlInputError } from "./received-import-input";
import { buildSriAccessKey } from "../sri-access-key";
import type { TaxIssue } from "./types";

type Row = Record<string, unknown>;
const row = (id: string, status: string, source: "inbox" | "purchase", extra: Row = {}): Row => ({
  id, tenantId: "tenant-a", status, createdAt: new Date(`2026-09-${id.endsWith("1") ? "11" : "12"}T12:00:00Z`), issueDate: new Date("2026-09-10T12:00:00Z"),
  supplierName: "Proveedor de prueba", supplierRuc: "1790016919001", supplierIdentification: "1790016919001", documentNumber: id, supplierDocumentNumber: id,
  documentType: "INVOICE", origin: "XML_IMPORT", purchaseDocumentId: null,
  subtotal: new Prisma.Decimal(10), subtotal0: new Prisma.Decimal(0), subtotal15: new Prisma.Decimal(10), subtotalNoTax: new Prisma.Decimal(0), subtotalExempt: new Prisma.Decimal(0), ivaTotal: new Prisma.Decimal(1.5), total: new Prisma.Decimal(11.5),
  accessKey: source === "inbox" ? null : id, authorizationDate: source === "purchase" ? new Date("2026-09-10T14:00:00Z") : null,
  ...extra,
});
let inbox: Row[] = [];
let purchases: Row[] = [];
const calls: Row[] = [];
function matches(record: Row, where: Row): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "AND") return (value as Row[]).every((condition) => matches(record, condition));
    if (key === "OR") return (value as Row[]).some((condition) => matches(record, condition));
    if (value && typeof value === "object") {
      const filter = value as Row;
      if ("in" in filter) return (filter.in as unknown[]).includes(record[key]);
      if ("not" in filter) return record[key] !== filter.not;
      if ("contains" in filter) return String(record[key] ?? "").toLowerCase().includes(String(filter.contains).toLowerCase());
      const date = (record[key] as Date).getTime();
      return (!filter.gte || date >= (filter.gte as Date).getTime()) && (!filter.lte || date <= (filter.lte as Date).getTime());
    }
    return record[key] === value;
  });
}
const model = (records: () => Row[]) => ({
  findMany: async ({ where, take, distinct }: { where: Row; take?: number; distinct?: unknown }) => {
    calls.push(where);
    const items = records().filter((item) => matches(item, where));
    if (distinct) return [{ documentType: "INVOICE" }];
    return items.sort((a, b) => (b.createdAt as Date).getTime() - (a.createdAt as Date).getTime() || String(b.id).localeCompare(String(a.id))).slice(0, take);
  },
  count: async ({ where }: { where: Row }) => { calls.push(where); return records().filter((item) => matches(item, where)).length; },
});

test.beforeEach(() => {
  inbox = [row("inbox-1", "NEW", "inbox"), row("ignored-1", "IGNORED", "inbox"), row("linked-1", "REGISTERED", "inbox", { purchaseDocumentId: "purchase-1" }), row("orphan-1", "REGISTERED", "inbox"), row("foreign-inbox", "NEW", "inbox", { tenantId: "tenant-b" })];
  purchases = [row("purchase-1", "REGISTERED", "purchase"), row("review-1", "NEEDS_REVIEW", "purchase"), row("cancelled-1", "CANCELLED", "purchase"), row("foreign-purchase", "AUTHORIZED", "purchase", { tenantId: "tenant-b" })];
  calls.length = 0;
  process.env.DATABASE_URL ||= "postgresql://test.invalid/sri-ui";
  (globalThis as unknown as { prisma: PrismaClient }).prisma = { purchaseInboxItem: model(() => inbox), purchaseDocument: model(() => purchases) } as unknown as PrismaClient;
});

test("received views use actual registration status, count filtered records and omit linked inbox duplicates", async () => {
  for (const [view, expected] of [["UNREGISTERED", 3], ["REGISTERED", 1], ["CANCELLED", 2]] as const) {
    const result = await listReceivedDocuments("tenant-a", parseReceivedFilters(new URLSearchParams({ view })));
    assert.equal(result.total, expected);
    assert.deepEqual(result.counts, { unregistered: 3, registered: 1, cancelled: 2 });
    assert.ok(!result.items.some((item) => ["linked-1", "foreign-inbox", "foreign-purchase"].includes(item.id)));
    if (view === "REGISTERED") assert.equal(result.items[0].authorizationDate, "2026-09-10T14:00:00.000Z");
  }
  assert.ok(calls.every((where) => where.tenantId === "tenant-a"));
});

test("view counts respect search, date, type and old status filters", async () => {
  const query = new URLSearchParams({ view: "UNREGISTERED", q: "review-1", from: "2026-09-01", to: "2026-09-30", type: "INVOICE" });
  const result = await listReceivedDocuments("tenant-a", parseReceivedFilters(query));
  assert.deepEqual(result.counts, { unregistered: 1, registered: 0, cancelled: 0 });
  assert.equal(result.items[0].id, "review-1");
  query.set("status", "REGISTERED");
  const filtered = await listReceivedDocuments("tenant-a", parseReceivedFilters(query));
  assert.equal(filtered.total, 0);
  assert.deepEqual(filtered.counts, { unregistered: 0, registered: 0, cancelled: 0 });
  query.delete("status"); query.set("from", "2026-10-01"); query.set("to", "2026-10-31");
  assert.equal((await listReceivedDocuments("tenant-a", parseReceivedFilters(query))).total, 0);
});

test("pagination of mixed sources preserves real totals without overlapping pages", async () => {
  const first = await listReceivedDocuments("tenant-a", parseReceivedFilters(new URLSearchParams("view=UNREGISTERED&pageSize=2&page=1")));
  const second = await listReceivedDocuments("tenant-a", parseReceivedFilters(new URLSearchParams("view=UNREGISTERED&pageSize=2&page=2")));
  assert.equal(first.totalPages, 2);
  assert.equal(first.items.length, 2);
  assert.equal(second.items.length, 1);
  assert.equal(new Set([...first.items, ...second.items].map((item) => item.id)).size, 3);
  assert.throws(() => parseReceivedFilters(new URLSearchParams("view=OTHER")), /inválida/);
});

const issues: TaxIssue[] = [
  { code: "BLOCK", severity: "ERROR", type: "ATS", document: "DOC", description: "Error real", action: "Corregir documento", href: "/facturacion/purchases/documents" },
  { code: "WARN", severity: "WARNING", type: "PERIOD", document: null, description: "Advertencia real", action: "Revisar período", href: null },
  { code: "INFO", severity: "INFO", type: "PERIOD", document: null, description: "Información real", action: "Consultar", href: null },
];
const ats = () => buildAtsPeriodData({ tenantId: "tenant-a", period: parseTaxPeriod({ year: 2025, month: 9 }), profile: { ruc: "1790016919001", legalName: "Empresa de prueba", regime: null }, documents: [], inbox: [], undatedCount: 0 });

test("diagnostic grouping preserves severity and all original issues", () => {
  const grouped = taxIssueGroups(issues);
  assert.deepEqual(grouped.errors, [issues[0]]);
  assert.deepEqual(grouped.warnings, [issues[1]]);
  assert.deepEqual(grouped.information, [issues[2]]);
  assert.equal(issues[0].severity, "ERROR");
});

test("ATS XML download requires domain, XML and XSD success with no blocking issues", () => {
  const data = ats();
  for (const xsdStatus of ["XSD_VALIDATION_PENDING", "XSD_VALIDATION_ERROR"]) {
    assert.equal(atsPreparationState({ ...data, xmlStatus: "XML_GENERATED", xsdStatus }).canDownloadXml, false);
  }
  const ready = { ...data, issues: [], domainStatus: "DOMAIN_VALIDATION_OK", xmlStatus: "XML_GENERATED", xsdStatus: "XSD_VALIDATED" };
  assert.equal(atsPreparationState(ready).canDownloadXml, true);
  assert.equal(atsPreparationState({ ...ready, issues }).canDownloadXml, false);
  assert.equal(atsPreparationState({ ...ready, xmlStatus: "XML_NOT_GENERATED" }).canDownloadXml, false);
  assert.equal(atsPreparationState({ ...ready, domainStatus: "DOMAIN_VALIDATION_ERROR" }).canDownloadXml, false);
});

test("ATS returns explicit blocked, pending and warning results instead of HTTP-only success", () => {
  const data = ats();
  assert.match(atsPreparationState({ ...data, issues }).title, /bloquean/);
  assert.match(atsPreparationState(data).title, /pendiente/);
  assert.match(atsPreparationState({ ...data, xmlStatus: "XML_GENERATED", xsdStatus: "XSD_VALIDATED" }).title, /advertencias/);
});

const accessKey = buildSriAccessKey({ issuedAt: new Date("2026-09-10T15:00:00Z"), documentType: "INVOICE", ruc: "1790016919001", environment: "PRODUCTION", establishmentCode: "001", issuePointCode: "001", sequentialNumber: 1, numericCode: "12345678" }).accessKey;
const xml = `<factura><infoTributaria><claveAcceso>${accessKey}</claveAcceso><ruc>1790016919001</ruc><razonSocial>Proveedor de prueba</razonSocial><codDoc>01</codDoc><estab>001</estab><ptoEmi>001</ptoEmi><secuencial>000000001</secuencial></infoTributaria><infoFactura><identificacionComprador>1790016919001</identificacionComprador><fechaEmision>10/09/2026</fechaEmision><importeTotal>10.00</importeTotal></infoFactura></factura>`;

test("manual XML preconditions accept existing parser output without claiming SRI authorization", () => {
  assert.equal(receivedXmlInputError(xml, "1790016919001"), null);
  assert.equal(receivedXmlInputError(`<autorizacion><estado>AUTORIZADO</estado><numeroAutorizacion>${accessKey}</numeroAutorizacion><comprobante><![CDATA[${xml}]]></comprobante></autorizacion>`, "1790016919001"), null);
  assert.match(receivedXmlInputError(`<autorizacion><estado>NO AUTORIZADO</estado><numeroAutorizacion>${accessKey}</numeroAutorizacion><comprobante><![CDATA[${xml}]]></comprobante></autorizacion>`, "1790016919001") ?? "", /autorización/);
});

test("manual XML import cannot skip receiver isolation when company RUC is missing", () => {
  assert.match(receivedXmlInputError(xml, null) ?? "", /RUC/);
  assert.match(receivedXmlInputError(xml.replace('<identificacionComprador>1790016919001', '<identificacionComprador>9999999999999'), "1790016919001") ?? "", /receptor/);
  assert.match(receivedXmlInputError(xml.replace(/<identificacionComprador>.*?<\/identificacionComprador>/, ''), "1790016919001") ?? "", /receptor/);
});

test("manual XML import rejects incomplete documents, invalid keys, unsupported types and DTD", () => {
  assert.ok(receivedXmlInputError("", "1790016919001"));
  assert.ok(receivedXmlInputError(xml.replace(accessKey, '0'.repeat(49)), "1790016919001"));
  assert.ok(receivedXmlInputError(xml.replace('<codDoc>01', '<codDoc>99'), "1790016919001"));
  assert.ok(receivedXmlInputError(xml.replace('<codDoc>01', '<codDoc>04'), "1790016919001"));
  assert.ok(receivedXmlInputError(xml.replace('10/09/2026', '31/09/2026'), "1790016919001"));
  assert.ok(receivedXmlInputError(xml.replace('<secuencial>000000001', '<secuencial>000000002'), "1790016919001"));
  assert.ok(receivedXmlInputError(xml.replace('<secuencial>000000001', '<secuencial>1'), "1790016919001"));
  assert.ok(receivedXmlInputError('<!DOCTYPE factura>' + xml, "1790016919001"));
  assert.ok(receivedXmlInputError(xml.replace('<importeTotal>10.00', '<importeTotal>NaN'), "1790016919001"));
});
