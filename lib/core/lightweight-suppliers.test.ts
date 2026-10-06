import assert from "node:assert/strict";
import test from "node:test";
import { IndexedSriTaxpayerProvider } from "./sri-taxpayer-lookup.ts";
import {
  validateSriTaxpayerResource,
  SRI_OPEN_DATA_SOURCE,
} from "./sri-data-service.ts";
import {
  applySupplierLookup,
  supplierExportRow,
  supplierPdfLine,
  supplierTenantWhere,
  supplierUniqueKey,
} from "./lightweight-supplier-utils.ts";

const taxpayer = {
  ruc: "1790016919001",
  legalName: "PROVEEDOR UNO",
  tradeName: "UNO",
  province: "PICHINCHA",
  city: "QUITO",
  parish: "IÑAQUITO",
  taxpayerStatus: "ACTIVO",
  taxpayerType: "SOCIEDAD",
  economicActivity: "SERVICIOS",
  source: SRI_OPEN_DATA_SOURCE,
};

test("supplier create conserva valores normalizados", () => {
  const result = applySupplierLookup(
    { name: "", tradeName: "", province: "", city: "", parish: "" },
    taxpayer,
  );
  assert.equal(result.values.name, "PROVEEDOR UNO");
});
test("supplier update no reemplaza contenido existente", () => {
  const result = applySupplierLookup(
    { name: "Manual", tradeName: "", province: "", city: "", parish: "" },
    taxpayer,
  );
  assert.equal(result.values.name, "Manual");
  assert.equal(result.conflicts, true);
});
test("duplicate identification usa tenant e identificación", () => {
  assert.notEqual(
    supplierUniqueKey("a", taxpayer.ruc),
    supplierUniqueKey("b", taxpayer.ruc),
  );
});
test("tenant isolation incluye tenantId en el predicado", () => {
  assert.deepEqual(supplierTenantWhere("tenant-a", "supplier-a"), {
    tenantId: "tenant-a",
    id: "supplier-a",
  });
});
test("RUC lookup proveedor devuelve registro indexado", async () => {
  const provider = new IndexedSriTaxpayerProvider({
    findByRuc: async () => taxpayer,
  });
  const result = await provider.lookup(taxpayer.ruc);
  assert.equal(result.found, true);
});
test("RUC no encontrado devuelve found false", async () => {
  const provider = new IndexedSriTaxpayerProvider({
    findByRuc: async () => null,
  });
  assert.equal((await provider.lookup(taxpayer.ruc)).found, false);
});
test("autocompletado llena ubicación vacía", () => {
  const result = applySupplierLookup(
    { name: "", tradeName: "", province: "", city: "", parish: "" },
    taxpayer,
  );
  assert.equal(result.values.city, "QUITO");
});
test("export Excel produce fila administrativa", () => {
  const row = supplierExportRow({
    identification: taxpayer.ruc,
    name: taxpayer.legalName,
    tradeName: null,
    email: null,
    phone: null,
    province: "PICHINCHA",
    city: "QUITO",
    createdAt: new Date("2026-10-06T00:00:00Z"),
    isActive: true,
  });
  assert.equal(row.status, "Activo");
});
test("export PDF produce línea limitada por el consumidor", () => {
  assert.match(
    supplierPdfLine(0, {
      identification: taxpayer.ruc,
      name: taxpayer.legalName,
      email: null,
      phone: null,
      city: "QUITO",
      isActive: true,
    }),
    /PROVEEDOR UNO/,
  );
});
test("dry-run valida URL y firma ZIP sin base de datos", async () => {
  const fetcher = (() =>
    Promise.resolve(
      new Response(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), { status: 206 }),
    )) as typeof fetch;
  assert.equal(
    await validateSriTaxpayerResource(
      {
        province: "Napo",
        url: "https://descargas.sri.gob.ec/download/datosAbiertos/SRI_RUC_Napo.zip",
      },
      fetcher,
    ),
    true,
  );
});
