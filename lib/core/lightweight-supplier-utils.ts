export type SupplierLookupData = {
  legalName?: string;
  tradeName?: string;
  province?: string;
  city?: string;
  parish?: string;
};

export function applySupplierLookup(
  current: {
    name: string;
    tradeName: string;
    province: string;
    city: string;
    parish: string;
  },
  found: SupplierLookupData,
) {
  const conflicts = Object.entries({
    name: found.legalName,
    tradeName: found.tradeName,
    province: found.province,
    city: found.city,
    parish: found.parish,
  }).some(([key, value]) =>
    Boolean(
      value &&
      current[key as keyof typeof current] &&
      value !== current[key as keyof typeof current],
    ),
  );
  return {
    values: {
      name: current.name || found.legalName || "",
      tradeName: current.tradeName || found.tradeName || "",
      province: current.province || found.province || "",
      city: current.city || found.city || "",
      parish: current.parish || found.parish || "",
    },
    conflicts,
  };
}

export function supplierTenantWhere(tenantId: string, supplierId?: string) {
  return { tenantId, ...(supplierId ? { id: supplierId } : {}) };
}

export function supplierUniqueKey(tenantId: string, identification: string) {
  return `${tenantId}:${identification}`;
}

export function supplierExportRow(supplier: {
  identification: string | null;
  name: string;
  tradeName: string | null;
  email: string | null;
  phone: string | null;
  province: string | null;
  city: string | null;
  createdAt: Date;
  isActive: boolean;
}) {
  return {
    ...supplier,
    createdAt: supplier.createdAt.toLocaleDateString("es-EC"),
    status: supplier.isActive ? "Activo" : "Inactivo",
  };
}

export function supplierPdfLine(
  index: number,
  supplier: {
    identification: string | null;
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    isActive: boolean;
  },
) {
  return `${index + 1}. ${supplier.identification ?? "—"} | ${supplier.name} | ${supplier.email ?? "—"} | ${supplier.phone ?? "—"} | ${supplier.city ?? "—"} | ${supplier.isActive ? "Activo" : "Inactivo"}`;
}
