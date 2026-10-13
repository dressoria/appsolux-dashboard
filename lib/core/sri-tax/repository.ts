import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { TaxPeriod } from "./tax-period";
import type { TaxDocument, TaxSnapshot } from "./types";
import { money, sum } from "./money";

export async function loadTaxSnapshot(
  tenantId: string,
  period: TaxPeriod,
): Promise<TaxSnapshot> {
  if (!tenantId) throw new Error("Tenant requerido.");
  const db = getPrismaClient();
  const date = { gte: period.start, lt: period.end };
  const [
    profile,
    sales,
    purchases,
    inbox,
    undatedSales,
    undatedPurchases,
    undatedInbox,
  ] = await Promise.all([
    db.sriTaxpayerProfile.findUnique({
      where: { tenantId },
      select: { ruc: true, legalName: true, taxRegimeCode: true },
    }),
    db.sriDocument.findMany({
      where: { tenantId, issuedAt: date, environment: "PRODUCTION" },
      include: {
        lines: true,
        establishment: { select: { tenantId: true, code: true } },
        issuePoint: { select: { tenantId: true, code: true } },
        submissionJobs: {
          where: { tenantId, status: "AUTHORIZED", environment: "PRODUCTION" },
          orderBy: { authorizedAt: "desc" },
          take: 1,
          select: { sriAuthorizationNumber: true },
        },
        withholdingLines: { include: { withholdingCode: true } },
      },
      orderBy: [{ issuedAt: "asc" }, { id: "asc" }],
    }),
    db.purchaseDocument.findMany({
      where: { tenantId, issueDate: date },
      include: {
        items: true,
        supplier: {
          select: {
            tenantId: true,
            name: true,
            identification: true,
            identificationType: true,
          },
        },
      },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    }),
    db.purchaseInboxItem.findMany({
      where: { tenantId, issueDate: date },
      orderBy: [{ issueDate: "asc" }, { id: "asc" }],
    }),
    db.sriDocument.count({
      where: {
        tenantId,
        issuedAt: null,
        environment: "PRODUCTION",
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    }),
    db.purchaseDocument.count({
      where: {
        tenantId,
        issueDate: null,
        status: { notIn: ["CANCELLED", "REJECTED"] },
      },
    }),
    db.purchaseInboxItem.count({
      where: {
        tenantId,
        issueDate: null,
        purchaseDocumentId: null,
        status: { not: "IGNORED" },
      },
    }),
  ]);
  const documents: TaxDocument[] = sales.map((d) => ({
    id: d.id,
    tenantId: d.tenantId,
    direction: "SALE",
    type: d.documentType,
    status: d.status,
    environment: d.environment,
    number:
      d.sequentialNumber === null
        ? null
        : `${d.establishment.code}-${d.issuePoint.code}-${String(d.sequentialNumber).padStart(9, "0")}`,
    establishment:
      d.establishment.tenantId === tenantId ? d.establishment.code : null,
    issuePoint: d.issuePoint.tenantId === tenantId ? d.issuePoint.code : null,
    identification: d.customerIdentification,
    identificationType: d.customerIdentificationType,
    name: d.customerName,
    date: d.issuedAt?.toISOString() ?? null,
    accessKey: d.accessKey,
    authorization: d.submissionJobs[0]?.sriAuthorizationNumber ?? null,
    base: money(d.subtotal),
    iva: money(d.taxTotal),
    total: money(d.grandTotal),
    lines: d.lines.map((l) => ({
      base: money(l.subtotal),
      rate: l.taxRate.toString(),
      iva: money(l.taxAmount),
    })),
    category: null,
    deductibility: null,
    fiscalClassification: null,
    relatedDocument: null,
    withholding: d.withholdingLines.map((l) => ({
      type: l.taxType,
      code: l.code,
      base: money(l.taxBase),
      rate: l.percentage.toString(),
      amount: money(l.retainedAmount),
      purchaseNumber: l.purchaseDocumentNumber,
      catalogValid:
        !!l.withholdingCode &&
        l.withholdingCode.code === l.code &&
        l.withholdingCode.taxType === l.taxType &&
        l.withholdingCode.percentage.eq(l.percentage) &&
        !!d.issuedAt &&
        l.withholdingCode.validFrom <= d.issuedAt &&
        (!l.withholdingCode.validTo || l.withholdingCode.validTo >= d.issuedAt),
    })),
    href: `/sri/documents/${d.id}`,
  }));
  for (const d of purchases)
    documents.push({
      id: d.id,
      tenantId: d.tenantId,
      direction: "PURCHASE",
      type: d.documentType,
      status: d.status,
      environment: null,
      number: d.supplierDocumentNumber,
      establishment: d.supplierDocumentNumber?.split("-")[0] ?? null,
      issuePoint: d.supplierDocumentNumber?.split("-")[1] ?? null,
      identification:
        d.supplierIdentification ??
        (d.supplier?.tenantId === tenantId ? d.supplier.identification : null),
      identificationType:
        d.supplier?.tenantId === tenantId
          ? d.supplier.identificationType
          : null,
      name:
        d.supplierName ??
        (d.supplier?.tenantId === tenantId ? d.supplier.name : null),
      date: d.issueDate?.toISOString() ?? null,
      accessKey: d.accessKey,
      authorization: d.authorizationNumber,
      base: money(
        sum([d.subtotal0, d.subtotal15, d.subtotalNoTax, d.subtotalExempt]),
      ),
      iva: money(d.ivaTotal),
      total: money(d.total),
      lines: d.items.map((l) => ({
        base: money(l.subtotal),
        rate: l.taxRate.toString(),
        iva: money(l.taxAmount),
      })),
      category: d.accountingCategoryId,
      deductibility: d.deductibilityStatus,
      fiscalClassification: null,
      relatedDocument: null,
      withholding: [],
      href: `/facturacion/purchases/documents/${d.id}`,
    });
  return {
    tenantId,
    period,
    profile: profile
      ? {
          ruc: profile.ruc,
          legalName: profile.legalName,
          regime: profile.taxRegimeCode,
        }
      : null,
    documents,
    inbox: inbox.map((i) => ({
      id: i.id,
      tenantId: i.tenantId,
      purchaseDocumentId: i.purchaseDocumentId,
      status: i.status,
      type: i.documentType,
      number: i.documentNumber,
      name: i.supplierName,
      identification: i.supplierRuc,
      accessKey: i.accessKey,
      date: i.issueDate?.toISOString() ?? null,
      base: money(i.subtotal),
      iva: money(i.ivaTotal),
      total: money(i.total),
      origin: i.origin,
      hasXml: !!i.xmlStorageKey,
    })),
    undatedCount: undatedSales + undatedPurchases + undatedInbox,
  };
}
