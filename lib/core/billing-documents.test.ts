import assert from "node:assert/strict";
import test from "node:test";
import { Prisma } from "@prisma/client";
import { treasuryStore } from "./treasury/test-store";
import { loadCoreDocuments, loadErpDocuments } from "./billing/billing-documents";

function setup(t: Parameters<typeof treasuryStore>[0]) {
  const store = treasuryStore(t, ["sriDocument", "sriCancellationRequest"]);
  for (const [saleId, status, sriStatus] of [["canceled-sale", "canceled", "CANCELLED"], ["canceled-sri", "confirmed", "CANCELLED"], ["confirmed-request", "confirmed", "AUTHORIZED"], ["pending-request", "confirmed", "AUTHORIZED"], ["normal", "confirmed", "AUTHORIZED"], ["internal-canceled", "canceled", null]] as const) {
    store.seed("lightweightSale", { id: saleId, status, paymentStatus: "paid", total: new Prisma.Decimal(100), items: [] });
    if (sriStatus) store.seed("sriDocument", { id: `doc-${saleId}`, sourceType: "BASIC_SALE", sourceId: saleId, status: sriStatus, grandTotal: new Prisma.Decimal(100), submissionJobs: [], sequentialNumber: 1, establishment: { code: "001" }, issuePoint: { code: "001" } });
  }
  store.seed("sriCancellationRequest", { sriDocumentId: "doc-confirmed-request", status: "CONFIRMED" });
  store.seed("sriCancellationRequest", { sriDocumentId: "doc-pending-request", status: "FAILED", createdAt: new Date("2026-01-01") });
  store.seed("sriCancellationRequest", { sriDocumentId: "doc-pending-request", status: "SUBMITTED", createdAt: new Date("2026-10-17") });
  store.seed("lightweightSale", { id: "other-tenant", tenantId: "tenant-b", status: "canceled", paymentStatus: "paid", total: new Prisma.Decimal(100), items: [] });
  store.seed("sriDocument", { id: "other-doc", tenantId: "tenant-b", status: "CANCELLED", sourceType: "BASIC_SALE", sourceId: "other-tenant", submissionJobs: [], grandTotal: new Prisma.Decimal(100) });
  return store;
}
test("Core Cancelados keeps internally canceled sales and SRI-canceled/confirmed invoices in history", async (t) => {
  setup(t);
  const canceled = await loadCoreDocuments("tenant-a", { type: "canceled" });
  assert.deepEqual(new Set(canceled.items.map((i) => i.id)), new Set(["canceled-sale", "canceled-sri", "confirmed-request", "internal-canceled"]));
  assert.equal(canceled.total, 4);
  const all = await loadCoreDocuments("tenant-a");
  assert.equal(all.items.length, 6);
  assert.equal(all.items.find((i) => i.id === "pending-request")!.cancellationStatus, "SUBMITTED");
  assert.equal(all.items.find((i) => i.id === "pending-request")!.cancellationStatusLabel, "Pendiente de confirmación SRI");
  assert.ok(!all.items.some((i) => i.id === "other-tenant"));
});
test("ERP Cancelados filters SRI documents and retains canceled basic history", async (t) => {
  setup(t);
  const canceled = await loadErpDocuments("tenant-a", { type: "canceled", includeBasicHistory: true });
  const sriItems = canceled.items.filter((i) => i.type === "SRI_DOCUMENT");
  assert.deepEqual(new Set(sriItems.map((i) => i.id)), new Set(["doc-canceled-sale", "doc-canceled-sri", "doc-confirmed-request"]));
  assert.ok(canceled.items.some((i) => i.id === "internal-canceled" && i.source === "BASIC_HISTORY"));
  assert.ok(!canceled.items.some((i) => i.id.includes("pending-request") || i.id.includes("other")));
  const documentIds = canceled.items.flatMap((i) => i.sriDocumentId ? [i.sriDocumentId] : []);
  assert.equal(new Set(documentIds).size, documentIds.length, "linked invoices must not be duplicated as basic history");
});
test("SUBMITTED stays authorized and outside Cancelados; confirmed is presented as Anulado", async (t) => {
  setup(t);
  const result = await loadCoreDocuments("tenant-a");
  const submitted = result.items.find((i) => i.id === "pending-request")!;
  assert.equal(submitted.sriStatus, "AUTHORIZED");
  assert.ok(!submitted.cancellationStatusLabel?.includes("Anulado"));
  assert.equal(result.items.find((i) => i.id === "confirmed-request")!.cancellationStatusLabel, "Anulado");
});
