import "@/lib/security/server-only";
import { getPrismaClient } from "@/lib/db/prisma";
import type { DeductibilityStatus } from "@prisma/client";

export type ClassificationResult = {
  categoryId: string | null;
  categoryName: string | null;
  deductibility: DeductibilityStatus;
  confidence: "rule" | "none";
};

export interface PurchaseClassifier {
  classify(params: {
    tenantId: string;
    supplierName?: string | null;
    supplierRuc?: string | null;
    description?: string | null;
    items?: Array<{ description: string }>;
  }): Promise<ClassificationResult>;
}

export class RuleBasedPurchaseClassifier implements PurchaseClassifier {
  async classify(params: {
    tenantId: string;
    supplierName?: string | null;
    supplierRuc?: string | null;
    description?: string | null;
    items?: Array<{ description: string }>;
  }): Promise<ClassificationResult> {
    const prisma = getPrismaClient();
    const rules = await prisma.purchaseClassificationRule.findMany({
      where: { tenantId: params.tenantId, isActive: true },
      include: { category: { select: { id: true, name: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (rules.length === 0) {
      return { categoryId: null, categoryName: null, deductibility: "UNREVIEWED", confidence: "none" };
    }

    const textFields: Record<string, string> = {
      supplier_name: params.supplierName ?? "",
      supplier_ruc: params.supplierRuc ?? "",
      description: params.description ?? "",
      items: (params.items ?? []).map((i) => i.description).join(" "),
    };

    for (const rule of rules) {
      const fieldValue = (textFields[rule.field] ?? "").toLowerCase();
      const ruleValue = rule.value.toLowerCase();

      let match = false;
      if (rule.operator === "contains") {
        match = fieldValue.includes(ruleValue);
      } else if (rule.operator === "equals") {
        match = fieldValue === ruleValue;
      } else if (rule.operator === "starts_with") {
        match = fieldValue.startsWith(ruleValue);
      }

      if (match) {
        return {
          categoryId: rule.category.id,
          categoryName: rule.category.name,
          deductibility: "LIKELY_DEDUCTIBLE",
          confidence: "rule",
        };
      }
    }

    return { categoryId: null, categoryName: null, deductibility: "UNREVIEWED", confidence: "none" };
  }
}

export async function classifyPurchaseDocument(
  tenantId: string,
  purchaseDocumentId: string,
): Promise<ClassificationResult> {
  const prisma = getPrismaClient();
  const doc = await prisma.purchaseDocument.findFirst({
    where: { id: purchaseDocumentId, tenantId },
    include: { items: { select: { description: true } } },
  });
  if (!doc) throw new Error("Documento no encontrado.");

  const classifier = new RuleBasedPurchaseClassifier();
  const result = await classifier.classify({
    tenantId,
    supplierName: doc.supplierName,
    supplierRuc: doc.supplierIdentification,
    items: doc.items,
  });

  if (result.categoryId) {
    await prisma.purchaseDocument.update({
      where: { id: purchaseDocumentId },
      data: {
        accountingCategoryId: result.categoryId,
        deductibilityStatus: result.deductibility,
      },
    });
  }

  return result;
}

export async function listClassificationRules(tenantId: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseClassificationRule.findMany({
    where: { tenantId },
    include: { category: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createClassificationRule(
  tenantId: string,
  data: { field: string; operator: string; value: string; categoryId: string },
) {
  const prisma = getPrismaClient();
  return prisma.purchaseClassificationRule.create({
    data: { tenantId, ...data },
  });
}

export async function deleteClassificationRule(tenantId: string, ruleId: string) {
  const prisma = getPrismaClient();
  return prisma.purchaseClassificationRule.deleteMany({
    where: { id: ruleId, tenantId },
  });
}
