import "@/lib/security/server-only";

import type { Prisma } from "@prisma/client";

import { getErpnextCompanies } from "@/lib/api/erpnext/companies";
import {
  createErpnextItemGroup,
  getErpnextItemGroups,
} from "@/lib/api/erpnext/item-groups";
import { createErpnextUom, getErpnextUoms } from "@/lib/api/erpnext/uoms";
import {
  createErpnextWarehouse,
  getErpnextWarehouses,
} from "@/lib/api/erpnext/warehouses";
import { getTenantIntegrationByProvider, updateTenantIntegration } from "@/lib/core/integrations";
import type {
  ErpnextCompany,
  ErpnextItemGroup,
  ErpnextUom,
  ErpnextWarehouse,
} from "@/types/erpnext";

export type ResolvedErpnextMasterData = {
  companyName: string | null;
  warehouseName: string | null;
  itemGroupName: string | null;
  uomName: string | null;
  territory: string | null;
  warnings: string[];
  blockers: string[];
};

function normalizeLabel(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))
  );
}

function findCompanyByName(companies: ErpnextCompany[], candidate?: string | null) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);

  return (
    companies.find((company) => normalizeLabel(company.name) === normalized) ??
    companies.find((company) => normalizeLabel(company.company_name) === normalized) ??
    null
  );
}

function isUsableItemGroup(group: ErpnextItemGroup) {
  return group.is_group !== 1 && (group.disabled ?? 0) !== 1;
}

function isActiveUom(uom: ErpnextUom) {
  return uom.enabled !== 0;
}

function findItemGroupByCandidate(itemGroups: ErpnextItemGroup[], candidate?: string | null) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);

  return (
    itemGroups.find((group) => normalizeLabel(group.name) === normalized) ??
    itemGroups.find((group) => normalizeLabel(group.item_group_name) === normalized) ??
    null
  );
}

function findUomByCandidate(uoms: ErpnextUom[], candidate?: string | null) {
  if (!candidate?.trim()) return null;
  const normalized = normalizeLabel(candidate);

  return (
    uoms.find((uom) => normalizeLabel(uom.name) === normalized) ??
    uoms.find((uom) => normalizeLabel(uom.uom_name) === normalized) ??
    null
  );
}

function detectRootItemGroup(itemGroups: ErpnextItemGroup[]) {
  return (
    itemGroups.find((group) => normalizeLabel(group.name) === "all item groups") ??
    itemGroups.find((group) => normalizeLabel(group.item_group_name) === "all item groups") ??
    itemGroups.find(
      (group) =>
        group.is_group === 1 &&
        (!group.parent_item_group ||
          normalizeLabel(group.parent_item_group) === normalizeLabel(group.name))
    ) ??
    itemGroups.find((group) => group.is_group === 1) ??
    null
  );
}

function resolveExistingWarehouse(
  warehouses: ErpnextWarehouse[],
  companyName: string | null,
  preferredWarehouse?: string | null
) {
  const active = warehouses.filter((warehouse) => !warehouse.disabled && !warehouse.is_group);
  if (active.length === 0) return null;

  if (preferredWarehouse?.trim()) {
    const preferred = active.find(
      (warehouse) =>
        normalizeLabel(warehouse.name) === normalizeLabel(preferredWarehouse) ||
        normalizeLabel(warehouse.warehouse_name) === normalizeLabel(preferredWarehouse)
    );
    if (preferred) return preferred;
  }

  if (!companyName) return active[0] ?? null;

  return (
    active.find((warehouse) => warehouse.company === companyName) ??
    active.find((warehouse) =>
      normalizeLabel(warehouse.name).includes(normalizeLabel(companyName))
    ) ??
    active[0] ??
    null
  );
}

function formatMissingItemGroupMessage() {
  return "No se puede migrar productos porque no se encontró un Item Group válido en ERPNext. Configura o crea un grupo de productos y vuelve a ejecutar.";
}

function formatMissingUomMessage() {
  return "No se puede migrar productos porque no se encontró una Unidad de Medida válida en ERPNext.";
}

function formatMissingCompanyMessage() {
  return "No se pudo resolver una compañía ERPNext válida para este tenant.";
}

type IntegrationConfigRecord = Record<string, unknown>;

function getIntegrationConfigObject(config: Prisma.JsonValue | null | undefined) {
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    return {} as IntegrationConfigRecord;
  }

  return config as IntegrationConfigRecord;
}

function getBusinessSuiteConfig(config: Prisma.JsonValue | null | undefined) {
  const record = getIntegrationConfigObject(config);
  const businessSuite =
    record.businessSuite && typeof record.businessSuite === "object" && !Array.isArray(record.businessSuite)
      ? (record.businessSuite as IntegrationConfigRecord)
      : {};

  return {
    record,
    businessSuite,
  };
}

export async function getTenantPreferredWarehouseName(tenantId: string) {
  const integration = await getTenantIntegrationByProvider(tenantId, "erpnext").catch(() => null);
  const { record, businessSuite } = getBusinessSuiteConfig(integration?.config);

  const candidate =
    (typeof businessSuite.defaultWarehouseName === "string"
      ? businessSuite.defaultWarehouseName
      : null) ??
    (typeof record.defaultWarehouseName === "string" ? record.defaultWarehouseName : null);

  return candidate?.trim() || null;
}

export async function setTenantPreferredWarehouseName(
  tenantId: string,
  warehouseName: string
) {
  const integration = await getTenantIntegrationByProvider(tenantId, "erpnext");
  if (!integration) {
    throw new Error("No se encontró integración ERPNext activa para guardar la bodega principal.");
  }

  const { record, businessSuite } = getBusinessSuiteConfig(integration.config);
  const nextConfig: Prisma.InputJsonObject = {
    ...record,
    businessSuite: {
      ...businessSuite,
      defaultWarehouseName: warehouseName,
    },
  };

  await updateTenantIntegration(tenantId, "erpnext", {
    config: nextConfig,
  });
}

export async function resolveBusinessSuiteErpMasterData(
  tenantId: string,
  options: {
    dryRun: boolean;
    companyName?: string;
    defaultItemGroup?: string;
    defaultUom?: string;
    territory?: string;
    preferredWarehouse?: string | null;
  }
): Promise<ResolvedErpnextMasterData> {
  const [companies, itemGroups, uoms, warehouses, integration, storedPreferredWarehouse] =
    await Promise.all([
      getErpnextCompanies(),
      getErpnextItemGroups(),
      getErpnextUoms(),
      getErpnextWarehouses(),
      getTenantIntegrationByProvider(tenantId, "erpnext").catch(() => null),
      getTenantPreferredWarehouseName(tenantId).catch(() => null),
    ]);

  const warnings: string[] = [];
  const blockers: string[] = [];

  const companyCandidates = uniqueStrings([
    options.companyName,
    integration?.externalCompanyId,
  ]);
  let companyName: string | null = null;

  for (const candidate of companyCandidates) {
    const matched = findCompanyByName(companies, candidate);
    if (matched) {
      companyName = matched.name;
      break;
    }
  }

  if (!companyName && companies.length === 1) {
    companyName = companies[0].name;
  }

  if (!companyName) {
    blockers.push(formatMissingCompanyMessage());
  }

  let warehouseName: string | null = null;
  const matchedWarehouse = resolveExistingWarehouse(
    warehouses,
    companyName,
    options.preferredWarehouse ?? storedPreferredWarehouse
  );

  if (matchedWarehouse) {
    warehouseName = matchedWarehouse.name;
  } else if (!companyName) {
    blockers.push("No se pudo resolver una bodega válida porque falta una compañía ERPNext válida.");
  } else if (options.dryRun) {
    warehouseName = "Bodega principal";
    warnings.push(
      `No existe una bodega activa para ${companyName}. En operación real se intentará crear "Bodega principal".`
    );
  } else {
    try {
      const created = await createErpnextWarehouse({
        warehouse_name: "Bodega principal",
        company: companyName,
      });
      warehouseName = created.name;
      warnings.push(
        `No existía una bodega activa para ${companyName}; se creó "Bodega principal".`
      );
    } catch (error) {
      blockers.push(
        error instanceof Error
          ? `No se pudo resolver ni crear una bodega válida para ${companyName}: ${error.message}`
          : `No se pudo resolver ni crear una bodega válida para ${companyName}.`
      );
    }
  }

  const usableItemGroups = itemGroups.filter(isUsableItemGroup);
  const itemGroupCandidates = uniqueStrings([
    options.defaultItemGroup,
    "Productos",
    "Products",
  ]);

  let itemGroupName: string | null = null;
  for (const candidate of itemGroupCandidates) {
    const matched = findItemGroupByCandidate(usableItemGroups, candidate);
    if (matched) {
      itemGroupName = matched.name;
      break;
    }
  }

  if (!itemGroupName && usableItemGroups.length > 0) {
    itemGroupName = usableItemGroups[0].name;
  }

  if (!itemGroupName) {
    const rootGroup = detectRootItemGroup(itemGroups);
    if (!rootGroup) {
      blockers.push(formatMissingItemGroupMessage());
    } else if (options.dryRun) {
      itemGroupName = "Productos";
      warnings.push(
        `No existe un Item Group usable; en operación real se intentará crear "Productos" bajo ${rootGroup.name}.`
      );
    } else {
      try {
        const created = await createErpnextItemGroup({
          item_group_name: "Productos",
          parent_item_group: rootGroup.name,
          is_group: false,
        });
        itemGroupName = created.name;
        warnings.push(
          `No existía un Item Group usable; se creó "Productos" bajo ${rootGroup.name}.`
        );
      } catch (error) {
        blockers.push(
          error instanceof Error
            ? `${formatMissingItemGroupMessage()} ${error.message}`
            : formatMissingItemGroupMessage()
        );
      }
    }
  }

  const activeUoms = uoms.filter(isActiveUom);
  const uomCandidates = uniqueStrings([
    options.defaultUom,
    "Unidad",
    "Unit",
    "Nos",
  ]);

  let uomName: string | null = null;
  for (const candidate of uomCandidates) {
    const matched = findUomByCandidate(activeUoms, candidate);
    if (matched) {
      uomName = matched.name;
      break;
    }
  }

  if (!uomName && activeUoms.length > 0) {
    uomName = activeUoms[0].name;
  }

  if (!uomName) {
    if (options.dryRun) {
      uomName = "Unidad";
      warnings.push('No existe una UOM activa usable; en operación real se intentará crear "Unidad".');
    } else {
      try {
        const created = await createErpnextUom({ uom_name: "Unidad" });
        uomName = created.name;
        warnings.push('No existía una UOM activa usable; se creó "Unidad".');
      } catch (error) {
        blockers.push(
          error instanceof Error
            ? `${formatMissingUomMessage()} ${error.message}`
            : formatMissingUomMessage()
        );
      }
    }
  }

  return {
    companyName,
    warehouseName,
    itemGroupName,
    uomName,
    territory: options.territory ?? "All Territories",
    warnings: uniqueStrings(warnings),
    blockers: uniqueStrings(blockers),
  };
}
