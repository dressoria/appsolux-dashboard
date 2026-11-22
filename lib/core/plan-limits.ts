import "@/lib/security/server-only";

import { getPrismaClient } from "@/lib/db/prisma";
import { getTenantPlanState, type PlanLimitKey } from "./plans";

export type LimitCheckResult =
  | { allowed: true; current: number; limit: number }
  | { allowed: false; current: number; limit: number; limitName: string };

const LIMIT_DISPLAY_NAMES: Record<PlanLimitKey, string> = {
  products: "productos",
  customers: "clientes",
  receipts: "comprobantes",
  openOrders: "pedidos abiertos",
  activeCredits: "créditos activos",
  users: "usuarios",
  warehouses: "bodegas",
  issuePoints: "puntos de emisión",
};

async function countUsage(
  tenantId: string,
  limitKey: PlanLimitKey,
): Promise<number> {
  const prisma = getPrismaClient();

  switch (limitKey) {
    case "products":
      return prisma.lightweightProduct.count({
        where: { tenantId, isActive: true },
      });
    case "customers":
      return prisma.lightweightCustomer.count({
        where: { tenantId },
      });
    case "users":
      return prisma.membership.count({
        where: { tenantId, status: "active" },
      });
    case "warehouses":
      return prisma.inventoryWarehouse.count({
        where: { tenantId, active: true },
      });
    case "issuePoints":
      return prisma.sriIssuePoint.count({
        where: { tenantId, isActive: true },
      });
    case "receipts":
    case "openOrders":
    case "activeCredits":
      return 0;
    default:
      return 0;
  }
}

export async function checkPlanLimit(
  tenantId: string,
  limitKey: PlanLimitKey,
  adding: number = 1,
): Promise<LimitCheckResult> {
  const plan = await getTenantPlanState(tenantId);
  const limit = plan.limits[limitKey];
  const current = await countUsage(tenantId, limitKey);

  if (current + adding <= limit) {
    return { allowed: true, current, limit };
  }

  return {
    allowed: false,
    current,
    limit,
    limitName: LIMIT_DISPLAY_NAMES[limitKey],
  };
}

export function planLimitErrorResponse(result: LimitCheckResult & { allowed: false }) {
  return {
    status: 403 as const,
    body: {
      ok: false,
      code: "PLAN_LIMIT_REACHED" as const,
      message: `Has alcanzado el límite de ${result.limitName} de tu plan (${result.current}/${result.limit}). Mejora tu plan para continuar.`,
      current: result.current,
      limit: result.limit,
    },
  };
}
