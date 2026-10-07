import assert from "node:assert/strict";
import test from "node:test";

import { defaultSriPaymentCode, fiscalSelection } from "./pos-checkout";

test("recibo interno no transporta configuración fiscal", () => {
  assert.deepEqual(fiscalSelection("internal_receipt", "est", "pto"), {
    establishmentId: undefined,
    issuePointId: undefined,
  });
});

test("factura SRI transporta establecimiento y punto reales", () => {
  assert.deepEqual(fiscalSelection("sri_invoice", "est", "pto"), {
    establishmentId: "est",
    issuePointId: "pto",
  });
});

test("forma de pago comercial sugiere códigos SRI sin fijar siempre 01", () => {
  assert.equal(defaultSriPaymentCode("cash"), "01");
  assert.equal(defaultSriPaymentCode("card"), "19");
  assert.equal(defaultSriPaymentCode("transfer"), "20");
  assert.equal(defaultSriPaymentCode("credit"), "20");
});
