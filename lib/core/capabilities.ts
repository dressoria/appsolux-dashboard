import "@/lib/security/server-only";

import { cache } from "react";

import type { CommercialPlan } from "../../node_modules/.prisma/client";

import { getTenantSubscription } from "./plans";
import { mapLegacyPlanKeyToCommercialPlan } from "./commercial-plans";

export type ModuleKey =
  | "purchases"
  | "suppliers"
  | "advanced_inventory"
  | "accounting"
  | "treasury"
  | "advanced_reports";

type ModuleGate = {
  name: string;
  description: string;
  minimumPlan: CommercialPlan;
};

const PLAN_RANK: Record<CommercialPlan, number> = {
  BASIC: 0,
  PLUS: 1,
  ADVANCED: 2,
  ENTERPRISE: 3,
};

const PLAN_DISPLAY_NAME: Record<CommercialPlan, string> = {
  BASIC: "Básico",
  PLUS: "Negocio",
  ADVANCED: "Avanzado",
  ENTERPRISE: "Empresarial",
};

export function planMeetsMinimum(
  current: CommercialPlan,
  required: CommercialPlan,
): boolean {
  return PLAN_RANK[current] >= PLAN_RANK[required];
}

export function getPlanDisplayName(plan: CommercialPlan): string {
  return PLAN_DISPLAY_NAME[plan];
}

const MODULE_GATES: Record<ModuleKey, ModuleGate> = {
  purchases: {
    name: "Compras",
    description:
      "Registra compras, gestiona documentos de compra y controla tus gastos con documentos electrónicos.",
    minimumPlan: "PLUS",
  },
  suppliers: {
    name: "Proveedores",
    description:
      "Administra tu directorio de proveedores, historial de compras y condiciones comerciales.",
    minimumPlan: "PLUS",
  },
  advanced_inventory: {
    name: "Inventario avanzado",
    description:
      "Kardex, ajustes de inventario, transferencias entre bodegas, valoración de stock y guías de remisión.",
    minimumPlan: "PLUS",
  },
  accounting: {
    name: "Contabilidad",
    description:
      "Plan de cuentas, asientos contables, libro diario, libro mayor y reportes financieros.",
    minimumPlan: "ENTERPRISE",
  },
  treasury: {
    name: "Tesorería",
    description:
      "Cuentas por cobrar, cuentas por pagar, gestión de bancos, tarjetas y flujo de caja.",
    minimumPlan: "PLUS",
  },
  advanced_reports: {
    name: "Reportes avanzados",
    description:
      "Reportes comerciales detallados, análisis de ventas y compras, y métricas de negocio.",
    minimumPlan: "PLUS",
  },
};

export type ModuleAccessDecision =
  | { allowed: true }
  | {
      allowed: false;
      moduleName: string;
      moduleDescription: string;
      requiredPlan: CommercialPlan;
      requiredPlanName: string;
    };

export function checkModuleAccess(
  commercialPlan: CommercialPlan,
  moduleKey: ModuleKey,
): ModuleAccessDecision {
  const gate = MODULE_GATES[moduleKey];

  if (planMeetsMinimum(commercialPlan, gate.minimumPlan)) {
    return { allowed: true };
  }

  return {
    allowed: false,
    moduleName: gate.name,
    moduleDescription: gate.description,
    requiredPlan: gate.minimumPlan,
    requiredPlanName: getPlanDisplayName(gate.minimumPlan),
  };
}

export function getModuleGate(moduleKey: ModuleKey) {
  return MODULE_GATES[moduleKey];
}

export const getTenantCommercialPlan = cache(
  async function getTenantCommercialPlan(
    tenantId: string,
  ): Promise<CommercialPlan> {
    const subscription = await getTenantSubscription(tenantId);
    return mapLegacyPlanKeyToCommercialPlan(subscription?.plan.key);
  },
);

export class ModuleAccessError extends Error {
  readonly status = 403;
  readonly code = "MODULE_PLAN_REQUIRED";

  constructor(
    readonly moduleName: string,
    readonly requiredPlanName: string,
  ) {
    super(`${moduleName} está incluido desde el plan ${requiredPlanName}.`);
  }
}

export async function requireModuleApiAccess(
  tenantId: string,
  moduleKey: ModuleKey,
) {
  const commercialPlan = await getTenantCommercialPlan(tenantId);
  const access = checkModuleAccess(commercialPlan, moduleKey);

  if (!access.allowed) {
    throw new ModuleAccessError(access.moduleName, access.requiredPlanName);
  }
}

export function getModuleAccessErrorResponse(error: unknown) {
  if (!(error instanceof ModuleAccessError)) return null;

  return {
    status: error.status,
    body: {
      ok: false,
      code: error.code,
      message: error.message,
      requiredPlan: error.requiredPlanName,
    },
  };
}

export async function gateModuleApiAccess(
  tenantId: string,
  moduleKey: ModuleKey,
): Promise<{ status: 403; body: { ok: false; code: string; message: string; requiredPlan: string } } | null> {
  const commercialPlan = await getTenantCommercialPlan(tenantId);
  const access = checkModuleAccess(commercialPlan, moduleKey);

  if (access.allowed) return null;

  return {
    status: 403,
    body: {
      ok: false,
      code: "MODULE_PLAN_REQUIRED",
      message: `${access.moduleName} está incluido desde el plan ${access.requiredPlanName}.`,
      requiredPlan: access.requiredPlanName,
    },
  };
}
