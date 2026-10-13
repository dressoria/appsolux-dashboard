import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Prisma, type PrismaClient } from "@prisma/client";
import {
  SRI_TAX_NAVIGATION,
  SRI_CONFIGURATION_NAVIGATION,
} from "../../../config/sri-tax-navigation";
import { buildSidebarNavigation } from "../../../components/appsolux/layout/sidebar";
import type { TenantModeState } from "../tenant-mode";
import { buildSriAccessKey } from "../sri-access-key";
import { parseTaxPeriod, TaxInputError } from "./tax-period";
import { money, sum } from "./money";
import { buildAtsPeriodData } from "./ats-data";
import { buildAtsSummary } from "./ats-summary";
import { buildAtsXml, escapeXml, validateAtsXsd } from "./ats-xml";
import { buildSriTaxSummary } from "./sri-tax-summary";
import { buildIva104Report, parseIvaManualInputs } from "./iva-104-report";
import { validateTaxSnapshot } from "./tax-validations";
import { loadTaxSnapshot } from "./repository";
import {
  getReceivedSyncState,
  listReceivedDocuments,
  parseReceivedFilters,
  receivedAction,
} from "./received-documents";
import {
  ivaReportXlsx,
  taxReportPdf,
  ivaReportLines,
  atsSummaryLines,
} from "./exports";
import type { TaxSnapshot, TaxDocument, TaxInbox } from "./types";

const now = new Date("2026-10-13T15:00:00Z");
const period = () =>
  parseTaxPeriod({ year: 2026, month: 9, frequency: "MONTHLY" }, now);
function doc(overrides: Partial<TaxDocument> = {}): TaxDocument {
  const direction = overrides.direction ?? "SALE";
  const type = overrides.type ?? "INVOICE";
  const date = overrides.date ?? "2026-09-10T17:00:00Z";
  const key = buildSriAccessKey({
    issuedAt: new Date(date),
    documentType: type,
    ruc: direction === "SALE" ? "1790012345001" : "1790023456001",
    environment: "PRODUCTION",
    establishmentCode: "001",
    issuePointCode: "001",
    sequentialNumber: 1,
    numericCode: "12345678",
  }).accessKey;
  return {
    id: "doc-a",
    tenantId: "tenant-a",
    direction,
    type,
    status: "AUTHORIZED",
    environment: direction === "SALE" ? "PRODUCTION" : null,
    number: "001-001-000000001",
    name: "CLIENTE TEST SA",
    identification: "1790023456001",
    identificationType: "RUC",
    date,
    accessKey: key,
    authorization: key,
    establishment: "001",
    issuePoint: "001",
    base: "100.00",
    iva: "15.00",
    total: "115.00",
    lines: [{ base: "100.00", rate: "15", iva: "15.00" }],
    category: "category-a",
    deductibility: "UNREVIEWED",
    fiscalClassification: null,
    relatedDocument: null,
    withholding: [],
    href: "/doc-a",
    ...overrides,
  };
}
function snapshot(
  documents: TaxDocument[] = [],
  inbox: TaxInbox[] = [],
): TaxSnapshot {
  return {
    tenantId: "tenant-a",
    period: period(),
    profile: {
      ruc: "1790012345001",
      legalName: "FACTUROM TEST SA",
      regime: null,
    },
    documents,
    inbox,
    undatedCount: 0,
  };
}
function inbox(overrides: Partial<TaxInbox> = {}): TaxInbox {
  return {
    id: "inbox-a",
    tenantId: "tenant-a",
    purchaseDocumentId: null,
    status: "NEW",
    type: "INVOICE",
    number: "001-001-000000002",
    name: "PROVEEDOR TEST",
    identification: "1790023456001",
    accessKey: null,
    date: "2026-09-10T17:00:00Z",
    base: "100.00",
    iva: "15.00",
    total: "115.00",
    origin: "XML_IMPORT",
    hasXml: false,
    ...overrides,
  };
}
function mockDb(t: TestContext, value: object) {
  const globalDb = globalThis as unknown as { prisma?: PrismaClient };
  const old = globalDb.prisma,
    oldUrl = process.env.DATABASE_URL;
  process.env.DATABASE_URL = "postgresql://unused:unused@localhost:1/unused";
  globalDb.prisma = value as PrismaClient;
  t.after(() => {
    globalDb.prisma = old;
    if (oldUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = oldUrl;
  });
}

test("A–F: sidebar exposes exactly the six Tax Center entries", () => {
  const sri = buildSidebarNavigation({} as TenantModeState).find(
    (g) => g.key === "sri",
  );
  assert.ok(sri);
  assert.deepEqual(
    sri.items.map((i) => i.title),
    SRI_TAX_NAVIGATION.map((i) => i.title),
  );
  for (const title of [
    "Configuración SRI",
    "Firma electrónica",
    "Secuenciales",
    "Establecimientos",
    "Puntos de emisión",
  ])
    assert.ok(!sri.items.some((i) => i.title === title));
});
test("G: configuration preserves fiscal setup, signature and automation URLs", () => {
  for (const suffix of [
    "company",
    "signature",
    "sequences",
    "establishments",
    "issue-points",
  ])
    assert.ok(
      SRI_CONFIGURATION_NAVIGATION.some(
        (i) => i.href === `/facturacion/sri/${suffix}`,
      ),
    );
  assert.ok(
    SRI_CONFIGURATION_NAVIGATION.some(
      (i) => i.href === "/facturacion/purchases/automatic-download",
    ),
  );
  const client = readFileSync(
    "components/appsolux/settings/configuration-page-client.tsx",
    "utf8",
  );
  assert.match(client, /activeTab === "sri"/);
  assert.match(client, /SriConfigurationSection/);
  for (const suffix of [
    "company",
    "signature",
    "sequences",
    "establishments",
    "issue-points",
    "environment",
  ])
    assert.match(
      readFileSync(`app/facturacion/sri/${suffix}/page.tsx`, "utf8"),
      /@\/app\/sri\//,
    );
});
test("H–J/AH: all report engines reject a mixed-tenant dataset", () => {
  const data = snapshot([doc({ tenantId: "tenant-b" })]);
  for (const build of [
    buildAtsPeriodData,
    buildSriTaxSummary,
    buildIva104Report,
    validateTaxSnapshot,
  ])
    assert.throws(() => build(data), /TAX_TENANT_SCOPE_VIOLATION/);
});
test("K/AH: foreign inbox records are rejected by report validation", () => {
  assert.throws(
    () => buildSriTaxSummary(snapshot([], [inbox({ tenantId: "tenant-b" })])),
    /TAX_TENANT_SCOPE_VIOLATION/,
  );
});
test("repository queries every source with the session tenant and Ecuador period bounds", async (t) => {
  const calls: { model: string; args: { where: Record<string, unknown> } }[] =
    [];
  const find =
    (model: string, result: unknown) =>
    async (args: { where: Record<string, unknown> }) => {
      calls.push({ model, args });
      return result;
    };
  mockDb(t, {
    sriTaxpayerProfile: { findUnique: find("profile", null) },
    sriDocument: {
      findMany: find("sales", []),
      count: find("sales-undated", 0),
    },
    purchaseDocument: {
      findMany: find("purchases", []),
      count: find("purchases-undated", 0),
    },
    purchaseInboxItem: {
      findMany: find("inbox", []),
      count: find("inbox-undated", 0),
    },
  });
  const data = await loadTaxSnapshot("tenant-a", period());
  assert.equal(data.tenantId, "tenant-a");
  assert.equal(calls.length, 7);
  for (const call of calls) assert.equal(call.args.where.tenantId, "tenant-a");
  assert.deepEqual(
    calls.find((c) => c.model === "sales")?.args.where.issuedAt,
    {
      gte: new Date("2026-09-01T05:00:00Z"),
      lt: new Date("2026-10-01T05:00:00Z"),
    },
  );
  assert.equal(
    calls.find((c) => c.model === "sales")?.args.where.environment,
    "PRODUCTION",
  );
});

test("H/I/J: tenant A summary, ATS and IVA exclude tenant B transactions at the repository boundary", async (t) => {
  const records = [
    { id: "a", tenantId: "tenant-a", amount: "100.00" },
    { id: "b", tenantId: "tenant-b", amount: "999.00" },
  ].map((r) => ({
    ...r,
    documentType: "INVOICE",
    status: "AUTHORIZED",
    environment: "PRODUCTION",
    sequentialNumber: 1,
    establishment: { tenantId: r.tenantId, code: "001" },
    issuePoint: { tenantId: r.tenantId, code: "001" },
    customerIdentification: "1790023456001",
    customerIdentificationType: "RUC",
    customerName: "CLIENTE TEST SA",
    issuedAt: new Date("2026-09-10T17:00:00Z"),
    accessKey: null,
    submissionJobs: [],
    subtotal: new Prisma.Decimal(r.amount),
    taxTotal: new Prisma.Decimal(0),
    grandTotal: new Prisma.Decimal(r.amount),
    lines: [
      {
        subtotal: new Prisma.Decimal(r.amount),
        taxRate: new Prisma.Decimal(0),
        taxAmount: new Prisma.Decimal(0),
      },
    ],
    withholdingLines: [],
  }));
  mockDb(t, {
    sriTaxpayerProfile: {
      findUnique: async () => ({
        ruc: "1790012345001",
        legalName: "FACTUROM TEST SA",
        taxRegimeCode: null,
      }),
    },
    sriDocument: {
      findMany: async (args: { where: { tenantId: string } }) =>
        records.filter((r) => r.tenantId === args.where.tenantId),
      count: async () => 0,
    },
    purchaseDocument: { findMany: async () => [], count: async () => 0 },
    purchaseInboxItem: { findMany: async () => [], count: async () => 0 },
  });
  const a = await loadTaxSnapshot("tenant-a", period());
  const b = await loadTaxSnapshot("tenant-b", period());
  assert.equal(buildSriTaxSummary(a).sales.base, "100.00");
  assert.equal(buildAtsPeriodData(a).totals.sales.base, "100.00");
  assert.equal(buildIva104Report(a).sales.base, "100.00");
  assert.equal(buildIva104Report(b).sales.base, "999.00");
  assert.deepEqual(
    a.documents.map((d) => d.id),
    ["a"],
  );
});
test("L: draft, rejected and test environment documents never contribute as authorized sales", () => {
  const data = buildAtsPeriodData(
    snapshot([
      doc(),
      doc({ id: "draft", status: "DRAFT", base: "999.00" }),
      doc({ id: "rejected", status: "REJECTED", base: "999.00" }),
      doc({ id: "test", environment: "TEST", base: "999.00" }),
    ]),
  );
  assert.equal(data.sales.length, 1);
  assert.equal(data.totals.sales.base, "100.00");
});
test("M/V: credit notes reduce net totals without mutating originals", () => {
  const invoice = doc();
  const credit = doc({
    id: "credit",
    type: "CREDIT_NOTE",
    base: "20.00",
    iva: "3.00",
    total: "23.00",
    lines: [{ base: "20.00", rate: "15", iva: "3.00" }],
  });
  const data = snapshot([invoice, credit]);
  const before = JSON.stringify(data);
  const ats = buildAtsPeriodData(data);
  const report = buildIva104Report(data, {
    classifications: {
      "doc-a": "SALE_LOCAL_TAXED",
      credit: "SALE_LOCAL_TAXED",
    },
  });
  assert.equal(ats.totals.sales.base, "80.00");
  assert.equal(ats.totals.sales.iva, "12.00");
  assert.equal(report.rows[0].gross, "100.00");
  assert.equal(report.rows[0].net, "80.00");
  assert.equal(report.rows[0].iva, "12.00");
  assert.equal(JSON.stringify(data), before);
});
test("N: XML escapes every reserved character and rejects invalid control characters", () => {
  assert.equal(
    escapeXml("A&B <C> \"D\" 'E'"),
    "A&amp;B &lt;C&gt; &quot;D&quot; &apos;E&apos;",
  );
  const data = buildAtsPeriodData(snapshot());
  data.company!.legalName = "A & B < TEST >";
  assert.match(buildAtsXml(data), /A &amp; B &lt; TEST &gt;/);
  assert.throws(() => escapeXml("A\u0001B"));
});
test("O/AC: Decimal summation and rounding preserve cents", () => {
  assert.equal(money(sum(["0.10", "0.20"])), "0.30");
  assert.equal(money("1.005"), "1.01");
  assert.equal(money(sum(Array(1000).fill("0.01"))), "10.00");
});
test("P/Q: ATS preview and summary share identical totals; XML consumes that same object", () => {
  const ats = buildAtsPeriodData(snapshot());
  const summary = buildAtsSummary(ats);
  assert.equal(summary.totals, ats.totals);
  assert.equal(summary.period, ats.period);
  assert.match(buildAtsXml(ats), /<totalVentas>0\.00<\/totalVentas>/);
  assert.doesNotMatch(buildAtsXml(ats), /version="1\.19\.0"/);
});
test("ATS refuses to silently omit transactions without official catalog mappings", () => {
  const ats = buildAtsPeriodData(snapshot([doc()]));
  assert.equal(ats.catalogMappingStatus, "ATS_CATALOG_MAPPING_PENDING");
  assert.throws(() => buildAtsXml(ats), /ATS_EXPORT_BLOCKED/);
  assert.equal(ats.xsdStatus, "XSD_VALIDATION_PENDING");
});
test("R: invalid years, months, frequencies and future periods fail strictly", () => {
  for (const input of [
    { year: 1999, month: 9 },
    { year: 9999, month: 9 },
    { year: 2026, month: 0 },
    { year: 2026, month: 13 },
    { year: "2026x", month: 9 },
    { year: 2026, month: 9, frequency: "YEARLY" },
    { year: 2026, month: 9, frequency: "SEMIANNUAL" },
    { year: 2026, month: 12 },
  ])
    assert.throws(() => parseTaxPeriod(input, now), TaxInputError);
});
test("monthly and semiannual boundaries use Ecuador midnight and exclusive end", () => {
  const semi = parseTaxPeriod(
    { year: 2026, month: 6, frequency: "SEMIANNUAL" },
    now,
  );
  assert.equal(semi.start.toISOString(), "2026-01-01T05:00:00.000Z");
  assert.equal(semi.end.toISOString(), "2026-07-01T05:00:00.000Z");
  const december = parseTaxPeriod({ year: 2025, month: 12 }, now);
  assert.equal(december.end.toISOString(), "2026-01-01T05:00:00.000Z");
});
test("S: XSD status is pending until the real validator runs", async () => {
  const ats = buildAtsPeriodData(snapshot());
  assert.equal(ats.xsdStatus, "XSD_VALIDATION_PENDING");
  const result = await validateAtsXsd(buildAtsXml(ats));
  assert.ok(
    ["XSD_VALIDATED", "XSD_VALIDATION_PENDING"].includes(result.status),
    result.detail,
  );
  if (result.status === "XSD_VALIDATED")
    assert.equal(
      (await validateAtsXsd("<iva><inventado/></iva>")).status,
      "XSD_VALIDATION_ERROR",
    );
});
test("T: a verified manual local-sale classification maps stored 15% tax to 401/411/421", () => {
  const report = buildIva104Report(snapshot([doc()]), {
    classifications: { "doc-a": "SALE_LOCAL_TAXED" },
  });
  assert.deepEqual(report.rows[0].codes, ["401", "411", "421"]);
  assert.equal(report.rows[0].iva, "15.00");
  assert.ok(report.rows[0].manual);
});
test("U: zero-rate sales remain distinct and require credit eligibility classification", () => {
  const d = doc({
    iva: "0.00",
    total: "100.00",
    lines: [{ base: "100.00", rate: "0", iva: "0.00" }],
  });
  const unknown = buildIva104Report(snapshot([d]));
  assert.equal(unknown.unclassified.length, 1);
  assert.equal(unknown.rateGroups[0].rate, "0");
  const known = buildIva104Report(snapshot([d]), {
    classifications: { "doc-a": "SALE_ZERO_CREDIT" },
  });
  assert.equal(
    known.rows.find((r) => r.key === "SALE_ZERO_CREDIT")?.net,
    "100.00",
  );
  assert.equal(known.rows[0].net, "0.00");
});
test("W: purchase IVA stays potential until credit applicability is confirmed", () => {
  const report = buildIva104Report(snapshot([doc({ direction: "PURCHASE" })]), {
    classifications: { "doc-a": "PURCHASE_LOCAL_CREDIT" },
  });
  assert.equal(
    report.rows.find((r) => r.key === "PURCHASE_LOCAL_CREDIT")?.iva,
    "15.00",
  );
  assert.equal(report.tax.potentialCredit, "15.00");
  assert.equal(report.tax.applicableCredit, null);
});
test("X: zero-rate purchases use their explicit classification and never taxable boxes", () => {
  const report = buildIva104Report(
    snapshot([
      doc({
        direction: "PURCHASE",
        iva: "0.00",
        total: "100.00",
        lines: [{ base: "100.00", rate: "0", iva: "0.00" }],
      }),
    ]),
    { classifications: { "doc-a": "PURCHASE_ZERO" } },
  );
  assert.equal(
    report.rows.find((r) => r.key === "PURCHASE_ZERO")?.net,
    "100.00",
  );
  assert.equal(report.tax.potentialCredit, "0.00");
});
test("Y: unknown operation is never assigned a fiscal box from its rate or category", () => {
  const report = buildIva104Report(
    snapshot([doc({ category: "ACTIVO FIJO" })]),
  );
  assert.equal(report.unclassified.length, 1);
  assert.ok(
    report.rows
      .filter((r) => r.direction === "SALE")
      .every((r) => r.net === null && !r.complete),
  );
  assert.ok(
    report.rows
      .filter((r) => r.direction === "SALE")
      .every((r) => r.classified.net === "0.00"),
  );
  assert.equal(report.sales.base, "100.00");
});
test("Z: missing prior balances stay null, explicit manual zero is preserved", () => {
  const report = buildIva104Report(snapshot());
  assert.equal(report.tax.previousPurchasesCredit, null);
  assert.equal(report.tax.previousWithholdingsCredit, null);
  assert.equal(report.tax.totalEstimated, null);
  const manual = buildIva104Report(snapshot(), {
    previousPurchasesCredit: "0",
    previousWithholdingsCredit: "0.00",
    applicablePurchasesCredit: "0",
  });
  assert.equal(manual.tax.previousPurchasesCredit, "0.00");
  assert.equal(manual.tax.preliminarySubtotal, "0.00");
  assert.equal(manual.tax.totalEstimated, null);
});
test("AA: historical 12% values are retained without applying current rates", () => {
  const report = buildIva104Report(
    snapshot([
      doc({
        iva: "12.00",
        total: "112.00",
        lines: [{ base: "100.00", rate: "12", iva: "12.00" }],
      }),
    ]),
    { classifications: { "doc-a": "SALE_LOCAL_TAXED" } },
  );
  assert.equal(report.rows[0].iva, "12.00");
  assert.equal(report.rateGroups[0].rate, "12");
});
test("AB: pending received withholdings cannot be counted as registered IVA retentions", () => {
  const report = buildIva104Report(
    snapshot([], [inbox({ type: "WITHHOLDING", total: "50.00" })]),
  );
  assert.equal(report.tax.receivedWithholdings, null);
  assert.ok(
    report.observations.some((o) => o.includes("retenciones recibidas")),
  );
});
test("manual inputs reject negative values, exponent notation, NaN and foreign document IDs", () => {
  for (const value of ["-1", "1e5", "NaN", "1.123", 0])
    assert.throws(
      () => parseIvaManualInputs({ previousPurchasesCredit: value }),
      TaxInputError,
    );
  assert.throws(
    () =>
      buildIva104Report(snapshot(), {
        classifications: { "tenant-b-document": "SALE_LOCAL_TAXED" },
      }),
    TaxInputError,
  );
  assert.throws(
    () =>
      buildIva104Report(snapshot([doc()]), {
        classifications: { "doc-a": "PURCHASE_LOCAL_CREDIT" },
      }),
    TaxInputError,
  );
});
test("mixed rates and unverified differentiated rates require specific classifications", () => {
  assert.throws(
    () =>
      buildIva104Report(
        snapshot([
          doc({
            lines: [
              { base: "50.00", rate: "0", iva: "0.00" },
              { base: "50.00", rate: "15", iva: "7.50" },
            ],
          }),
        ]),
        { classifications: { "doc-a": "SALE_LOCAL_TAXED" } },
      ),
    /mixtas/,
  );
  assert.throws(
    () =>
      buildIva104Report(
        snapshot([
          doc({ lines: [{ base: "100.00", rate: "5", iva: "5.00" }] }),
        ]),
        { classifications: { "doc-a": "SALE_LOCAL_TAXED" } },
      ),
    /diferenciada/,
  );
});
test("AD: missing supplier raises an error", () => {
  assert.ok(
    validateTaxSnapshot(
      snapshot([
        doc({ direction: "PURCHASE", name: null, identification: null }),
      ]),
    ).some(
      (i) => i.code === "PURCHASE_SUPPLIER_MISSING" && i.severity === "ERROR",
    ),
  );
});
test("AE: missing purchase category raises a warning", () => {
  assert.ok(
    validateTaxSnapshot(
      snapshot([doc({ direction: "PURCHASE", category: null })]),
    ).some(
      (i) => i.code === "PURCHASE_CATEGORY_MISSING" && i.severity === "WARNING",
    ),
  );
});
test("AF: duplicate access keys are detected while a linked inbox record is not duplicated", () => {
  const d = doc();
  assert.ok(
    validateTaxSnapshot(snapshot([d, doc({ id: "duplicate" })])).some(
      (i) => i.code === "DUPLICATE_ACCESS_KEY",
    ),
  );
  assert.ok(
    !validateTaxSnapshot(
      snapshot(
        [d],
        [
          inbox({
            purchaseDocumentId: d.id,
            accessKey: d.accessKey,
            status: "REGISTERED",
          }),
        ],
      ),
    ).some((i) => i.code === "DUPLICATE_ACCESS_KEY"),
  );
  assert.ok(
    validateTaxSnapshot(
      snapshot([d], [inbox({ accessKey: d.accessKey })]),
    ).some((i) => i.code === "DUPLICATE_ACCESS_KEY"),
  );
});
test("AG: pending documents and received items produce warnings", () => {
  const issues = validateTaxSnapshot(
    snapshot([doc({ status: "DRAFT" })], [inbox()]),
  );
  assert.ok(issues.some((i) => i.code === "DOCUMENT_PENDING"));
  assert.ok(issues.some((i) => i.code === "RECEIVED_PENDING"));
});
test("invalid access key, missing authorization, IVA mismatch and missing credit origin are detected", () => {
  const issues = validateTaxSnapshot(
    snapshot([
      doc({
        type: "CREDIT_NOTE",
        accessKey: "1".repeat(49),
        authorization: null,
        iva: "14.00",
      }),
    ]),
  );
  for (const code of [
    "ACCESS_KEY_INCONSISTENT",
    "AUTHORIZATION_MISSING",
    "SALE_IVA_INCONSISTENT",
    "CREDIT_NOTE_ORIGIN_MISSING",
  ])
    assert.ok(
      issues.some((i) => i.code === code),
      code,
    );
});
test("withholding lines validate purchase source, catalog and retained amount", () => {
  const issues = validateTaxSnapshot(
    snapshot([
      doc({
        type: "WITHHOLDING",
        withholding: [
          {
            type: "IVA",
            code: "bad",
            base: "100.00",
            rate: "30",
            amount: "1.00",
            purchaseNumber: null,
            catalogValid: false,
          },
        ],
      }),
    ]),
  );
  for (const code of [
    "WITHHOLDING_PURCHASE_MISSING",
    "WITHHOLDING_CATALOG_INVALID",
    "WITHHOLDING_AMOUNT_INCONSISTENT",
  ])
    assert.ok(issues.some((i) => i.code === code));
});
test("received filtering rejects invalid dates, reversed ranges, status, type and page", () => {
  for (const query of [
    "from=2026-02-30",
    "from=bad",
    "from=2026-99-99",
    "from=2026-10-02&to=2026-10-01",
    "page=-1",
    "pageSize=101",
    "status=AUTHORIZED",
    "type=UNKNOWN",
  ])
    assert.throws(
      () => parseReceivedFilters(new URLSearchParams(query)),
      TaxInputError,
    );
});
test("K: received queries are tenant-scoped, deduplicate linked inbox, merge and paginate", async (t) => {
  const calls: Record<string, unknown>[] = [];
  const row = {
    id: "purchase-a",
    tenantId: "tenant-a",
    supplierDocumentNumber: "001-001-000000001",
    documentType: "INVOICE",
    supplierName: "A",
    supplierIdentification: "1790023456001",
    issueDate: new Date("2026-09-10"),
    subtotal0: new Prisma.Decimal(0),
    subtotal15: new Prisma.Decimal(100),
    subtotalNoTax: new Prisma.Decimal(0),
    subtotalExempt: new Prisma.Decimal(0),
    ivaTotal: new Prisma.Decimal(15),
    total: new Prisma.Decimal(115),
    status: "AUTHORIZED",
    origin: "XML_IMPORT",
    createdAt: new Date("2026-09-10"),
    accessKey: "a",
  };
  mockDb(t, {
    purchaseInboxItem: {
      findMany: async (args: {
        where: Record<string, unknown>;
        distinct?: unknown;
      }) => {
        calls.push(args.where);
        if (args.distinct) return [{ documentType: "INVOICE" }];
        assert.equal(args.where.purchaseDocumentId, null);
        return [];
      },
      count: async (args: { where: Record<string, unknown> }) => {
        calls.push(args.where);
        return 0;
      },
    },
    purchaseDocument: {
      findMany: async (args: {
        where: Record<string, unknown>;
        distinct?: unknown;
      }) => {
        calls.push(args.where);
        return args.distinct ? [{ documentType: "INVOICE" }] : [row];
      },
      count: async (args: { where: Record<string, unknown> }) => {
        calls.push(args.where);
        return 1;
      },
    },
  });
  const result = await listReceivedDocuments(
    "tenant-a",
    parseReceivedFilters(
      new URLSearchParams("page=1&pageSize=1&tenantId=tenant-b"),
    ),
  );
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, "purchase-a");
  assert.equal(result.items[0].base, "100.00");
  for (const where of calls) assert.equal(where.tenantId, "tenant-a");
});
test("ignore action cannot mutate another tenant or a registered inbox record", async (t) => {
  mockDb(t, {
    purchaseInboxItem: {
      updateMany: async (args: { where: Record<string, unknown> }) => {
        assert.equal(args.where.tenantId, "tenant-a");
        assert.equal(args.where.purchaseDocumentId, null);
        assert.deepEqual(args.where.status, {
          in: ["NEW", "CLASSIFIED", "NEEDS_REVIEW"],
        });
        return { count: 0 };
      },
    },
  });
  await assert.rejects(
    () => receivedAction("tenant-a", "user-a", "foreign-id", "ignore"),
    TaxInputError,
  );
});
test("classification rejects a category from another tenant", async (t) => {
  mockDb(t, {
    $transaction: async (fn: (tx: object) => unknown) =>
      fn({
        purchaseAccountingCategory: {
          findFirst: async (args: { where: { tenantId: string } }) => {
            assert.equal(args.where.tenantId, "tenant-a");
            return null;
          },
        },
      }),
  });
  await assert.rejects(
    () =>
      receivedAction("tenant-a", "user-a", "doc-a", "classify", {
        source: "PURCHASE",
        categoryId: "foreign-category",
      }),
    TaxInputError,
  );
});
test("optional sync tables missing is a pending state; unrelated errors remain errors", async (t) => {
  mockDb(t, {
    purchaseSriCredential: {
      findUnique: async () => {
        throw new Prisma.PrismaClientKnownRequestError("table missing", {
          code: "P2021",
          clientVersion: "test",
        });
      },
    },
    purchaseSriSyncConfig: { findUnique: async () => null },
    purchaseSriSyncJob: { findFirst: async () => null },
  });
  assert.equal((await getReceivedSyncState("tenant-a")).available, false);
});

test("sync adapter does not mask connection or permission errors as an empty/pending state", async (t) => {
  mockDb(t, {
    purchaseSriCredential: {
      findUnique: async () => {
        throw new Error("CONNECTION_FAILED");
      },
    },
    purchaseSriSyncConfig: { findUnique: async () => null },
    purchaseSriSyncJob: { findFirst: async () => null },
  });
  await assert.rejects(
    () => getReceivedSyncState("tenant-a"),
    /CONNECTION_FAILED/,
  );
});
test("PDF and XLSX export actual report values and manual data", async () => {
  const report = buildIva104Report(snapshot([doc()]), {
    previousPurchasesCredit: "1.25",
  });
  const pdf = await taxReportPdf(ivaReportLines(report));
  assert.equal(Buffer.from(pdf).subarray(0, 4).toString(), "%PDF");
  const xlsx = await ivaReportXlsx(report);
  assert.equal(Buffer.from(xlsx).subarray(0, 2).toString(), "PK");
  const ExcelJS = (await import("exceljs")).default;
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(xlsx.buffer as ArrayBuffer);
  const details = workbook.getWorksheet("Detalle y observaciones");
  assert.ok(
    details
      ?.getSheetValues()
      .some((row) => JSON.stringify(row).includes("1.25")),
  );
  assert.ok(
    atsSummaryLines(buildAtsPeriodData(snapshot())).some((line) =>
      line.includes("XSD_VALIDATION_PENDING"),
    ),
  );
});
