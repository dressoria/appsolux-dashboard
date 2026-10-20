import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { canRequestSriCancellation, sriCancellationLabel } from "../sri-cancellation-status";
import type { BillingDocumentListItem } from "./billing/billing-documents";

mock.module("next/navigation", { namedExports: { useRouter: () => ({ refresh() {} }) } });
let ui: typeof import("../../components/appsolux/sri/sri-cancellation-modal");
let billing: typeof import("../../components/appsolux/billing/billing-documents-list");
test.before(async () => {
  ui = await import("../../components/appsolux/sri/sri-cancellation-modal");
  billing = await import("../../components/appsolux/billing/billing-documents-list");
});
const doc = (cancellationStatus: string | null, sriStatus = "AUTHORIZED") => ({
  id: "document-a", sriDocumentId: "sri-a", sriStatus, sriStatusLabel: sriStatus === "CANCELLED" ? "Anulado" : "Autorizado", cancellationStatus, cancellationStatusLabel: "Stale label", internalStatus: "paid", internalStatusLabel: "Pagado",
} as BillingDocumentListItem);
for (const [status, label] of Object.entries({ QUEUED: "Anulación en cola", RUNNING: "Procesando anulación", SUBMITTED: "Pendiente de confirmación SRI", HUMAN_VERIFICATION_REQUIRED: "Requiere verificación manual", FAILED: "Anulación fallida", CONFIRMED: "Anulado" })) {
  test(`unified document status ${status} displays ${label} and gates duplicate requests`, () => {
    const html = renderToStaticMarkup(createElement(billing.BillingDocumentStatus, { doc: doc(status) }));
    assert.ok(html.includes(label));
    const button = renderToStaticMarkup(createElement(ui.SriCancellationAction, { sriStatus: "AUTHORIZED", cancellationStatus: status, onClick() {} }));
    assert.equal(button.includes("Anular factura"), status === "FAILED");
    if (status === "SUBMITTED") assert.ok(!html.includes("Anulado"));
  });
}
test("authorized invoice with no request offers Anular factura; CANCELLED never does", () => {
  assert.equal(canRequestSriCancellation("AUTHORIZED", null), true);
  assert.ok(renderToStaticMarkup(createElement(ui.SriCancellationAction, { sriStatus: "AUTHORIZED", onClick() {} })).includes("Anular factura"));
  assert.equal(canRequestSriCancellation("CANCELLED", null), false);
  assert.equal(sriCancellationLabel("CANCELLED", null), "Anulado");
  assert.equal(renderToStaticMarkup(createElement(ui.SriCancellationAction, { sriStatus: "CANCELLED", onClick() {} })), "");
});
test("all three screens use the shared modal and the unified Actions menu includes the guarded action", () => {
  for (const path of ["components/appsolux/basic/sales-list.tsx", "components/appsolux/basic/sale-detail-actions.tsx", "components/appsolux/billing/billing-documents-list.tsx"]) {
    const source = readFileSync(path, "utf8");
    assert.ok(source.includes("@/components/appsolux/sri/sri-cancellation-modal"));
    assert.ok(source.includes("<SriCancellationModal"));
    assert.ok(!source.includes("function SriCancellationModal"));
  }
  assert.ok(readFileSync("components/appsolux/billing/billing-documents-list.tsx", "utf8").includes("<SriCancellationAction"));
  const modal = readFileSync("components/appsolux/sri/sri-cancellation-modal.tsx", "utf8");
  assert.ok(modal.includes('fetch(`/api/sri/documents/${sriDocumentId}/cancel`'));
  assert.ok(modal.includes('method: "POST"'));
  assert.ok(modal.includes("useEffect("));
  assert.match(readFileSync("lib/core/sri-cancellation.ts", "utf8"), /LIVE_SRI_CANCELLATION_VERIFICATION_PENDING = true/);
});

test("authorized credit notes do not offer invoice cancellation", () => {
  assert.equal(canRequestSriCancellation("AUTHORIZED", null, "CREDIT_NOTE"), false);
  assert.equal(renderToStaticMarkup(createElement(ui.SriCancellationAction, { sriStatus: "AUTHORIZED", documentType: "CREDIT_NOTE", onClick() {} })), "");
});
