import assert from "node:assert/strict";
import test from "node:test";

type ParsedAuthorizedSriInvoice = import("./sri-authorized-xml-parser.ts").ParsedAuthorizedSriInvoice;

async function loadParser() {
  return import("./sri-authorized-xml-parser.ts");
}

async function loadGenerator() {
  return import("./sri-ride-generator.ts");
}

function buildAuthorizedXml(opts: {
  details: Array<{
    codigo?: string;
    descripcion?: string;
    cantidad?: string;
    precioUnitario?: string;
    descuento?: string;
    precioTotalSinImpuesto?: string;
    subsidio?: string;
    precioSinSubsidio?: string;
    impuestos: Array<{
      codigo: string;
      codigoPorcentaje: string;
      tarifa: string;
      baseImponible: string;
      valor: string;
    }>;
  }>;
  totalImpuestos: Array<{
    codigo: string;
    codigoPorcentaje: string;
    baseImponible: string;
    valor: string;
    tarifa?: string;
  }>;
  totalSinImpuestos?: string;
  totalDescuento?: string;
  propina?: string;
  importeTotal?: string;
}): string {
  const detailsXml = opts.details
    .map((d) => {
      const impXml = d.impuestos
        .map(
          (imp) =>
            `<impuesto><codigo>${imp.codigo}</codigo><codigoPorcentaje>${imp.codigoPorcentaje}</codigoPorcentaje><tarifa>${imp.tarifa}</tarifa><baseImponible>${imp.baseImponible}</baseImponible><valor>${imp.valor}</valor></impuesto>`,
        )
        .join("");
      const subsidioTag = d.subsidio ? `<subsidio>${d.subsidio}</subsidio>` : "";
      const pssTag = d.precioSinSubsidio
        ? `<precioSinSubsidio>${d.precioSinSubsidio}</precioSinSubsidio>`
        : "";
      return `<detalle>
        <codigoPrincipal>${d.codigo ?? "PROD001"}</codigoPrincipal>
        <descripcion>${d.descripcion ?? "Producto"}</descripcion>
        <cantidad>${d.cantidad ?? "1"}</cantidad>
        <precioUnitario>${d.precioUnitario ?? "10.00"}</precioUnitario>
        ${subsidioTag}${pssTag}
        <descuento>${d.descuento ?? "0.00"}</descuento>
        <precioTotalSinImpuesto>${d.precioTotalSinImpuesto ?? "10.00"}</precioTotalSinImpuesto>
        <impuestos>${impXml}</impuestos>
      </detalle>`;
    })
    .join("\n");

  const totImpXml = opts.totalImpuestos
    .map((t) => {
      const tarifaTag = t.tarifa !== undefined ? `<tarifa>${t.tarifa}</tarifa>` : "";
      return `<totalImpuesto><codigo>${t.codigo}</codigo><codigoPorcentaje>${t.codigoPorcentaje}</codigoPorcentaje>${tarifaTag}<baseImponible>${t.baseImponible}</baseImponible><valor>${t.valor}</valor></totalImpuesto>`;
    })
    .join("");

  return `<autorizacion>
    <estado>AUTORIZADO</estado>
    <numeroAutorizacion>0710202601179323041100120010100000003901234567811</numeroAutorizacion>
    <fechaAutorizacion>07/10/2026 12:30:00</fechaAutorizacion>
    <comprobante><![CDATA[<?xml version="1.0" encoding="UTF-8"?>
      <factura id="comprobante" version="2.1.0">
        <infoTributaria>
          <ambiente>2</ambiente>
          <tipoEmision>1</tipoEmision>
          <razonSocial>EMPRESA TEST S.A.</razonSocial>
          <nombreComercial>EMPRESA TEST</nombreComercial>
          <ruc>1793230411001</ruc>
          <claveAcceso>0710202601179323041100120010100000003901234567811</claveAcceso>
          <codDoc>01</codDoc>
          <estab>001</estab>
          <ptoEmi>010</ptoEmi>
          <secuencial>000000390</secuencial>
          <dirMatriz>Quito</dirMatriz>
        </infoTributaria>
        <infoFactura>
          <fechaEmision>07/10/2026</fechaEmision>
          <dirEstablecimiento>Quito</dirEstablecimiento>
          <obligadoContabilidad>SI</obligadoContabilidad>
          <tipoIdentificacionComprador>04</tipoIdentificacionComprador>
          <razonSocialComprador>CLIENTE TEST</razonSocialComprador>
          <identificacionComprador>1790016919001</identificacionComprador>
          <totalSinImpuestos>${opts.totalSinImpuestos ?? "10.00"}</totalSinImpuestos>
          <totalDescuento>${opts.totalDescuento ?? "0.00"}</totalDescuento>
          <totalConImpuestos>${totImpXml}</totalConImpuestos>
          <propina>${opts.propina ?? "0.00"}</propina>
          <importeTotal>${opts.importeTotal ?? "11.50"}</importeTotal>
          <moneda>DOLAR</moneda>
          <pagos>
            <pago>
              <formaPago>01</formaPago>
              <total>${opts.importeTotal ?? "11.50"}</total>
              <plazo>0</plazo>
              <unidadTiempo>Dias</unidadTiempo>
            </pago>
          </pagos>
        </infoFactura>
        <detalles>${detailsXml}</detalles>
        <infoAdicional>
          <campoAdicional nombre="EMAIL CLIENTE">test@test.com</campoAdicional>
        </infoAdicional>
      </factura>
    ]]></comprobante>
  </autorizacion>`;
}

// ── G-A: totalImpuesto code 2 + codigoPorcentaje 4 sin tarifa → 15% ──

test("G-A: totalImpuesto code 2 + codigoPorcentaje 4 without tarifa → resolves 15%", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "304.50",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "304.50", valor: "45.68" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "304.50", valor: "45.68" },
    ],
    totalSinImpuestos: "304.50",
    importeTotal: "350.18",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  const taxed15 = result.totals.subtotalTaxed.find((r) => r.label === "SUBTOTAL 15%");
  assert.ok(taxed15, "Should have SUBTOTAL 15%");
  assert.equal(taxed15.baseAmount, "304.50");
});

// ── G-B: base 304.50 → SUBTOTAL 15% 304.50 ──

test("G-B: base 304.50 → SUBTOTAL 15% 304.50", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "304.50",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "304.50", valor: "45.68" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "304.50", valor: "45.68" },
    ],
    totalSinImpuestos: "304.50",
    importeTotal: "350.18",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  assert.equal(result.totals.subtotalTaxed[0]?.baseAmount, "304.50");
});

// ── G-C: valor 45.68 → IVA 15% 45.68 ──

test("G-C: valor 45.68 → IVA 15% 45.68", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "304.50",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "304.50", valor: "45.68" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "304.50", valor: "45.68" },
    ],
    totalSinImpuestos: "304.50",
    importeTotal: "350.18",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  const iva15 = result.totals.iva.find((r) => r.label === "IVA 15%");
  assert.ok(iva15, "Should have IVA 15%");
  assert.equal(iva15.value, "45.68");
});

// ── G-D: base 0% 468 → SUBTOTAL 0% 468 ──

test("G-D: base 0% 468 → SUBTOTAL 0% 468.00", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "304.50",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "304.50", valor: "45.68" },
        ],
      },
      {
        precioTotalSinImpuesto: "468.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "0", tarifa: "0.00", baseImponible: "468.00", valor: "0.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "304.50", valor: "45.68" },
      { codigo: "2", codigoPorcentaje: "0", baseImponible: "468.00", valor: "0.00" },
    ],
    totalSinImpuestos: "772.50",
    importeTotal: "818.18",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  assert.equal(result.totals.subtotalZero, "468.00");
});

// ── G-E: no aparece IVA 0% 45.68 ──

test("G-E: IVA 0% 45.68 must NOT appear (that value belongs to IVA 15%)", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "304.50",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "304.50", valor: "45.68" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "304.50", valor: "45.68" },
    ],
    totalSinImpuestos: "304.50",
    importeTotal: "350.18",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  const bad = result.totals.iva.find((r) => r.label === "IVA 0%" && r.value === "45.68");
  assert.equal(bad, undefined, "IVA 0% 45.68 must not exist");
});

// ── G-F: no aparece IVA 0% 0.00 innecesario ──

test("G-F: IVA 0% $0.00 row must not appear when value is zero", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "304.50",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "304.50", valor: "45.68" },
        ],
      },
      {
        precioTotalSinImpuesto: "468.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "0", tarifa: "0.00", baseImponible: "468.00", valor: "0.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "304.50", valor: "45.68" },
      { codigo: "2", codigoPorcentaje: "0", baseImponible: "468.00", valor: "0.00" },
    ],
    totalSinImpuestos: "772.50",
    importeTotal: "818.18",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  const ivaZero = result.totals.iva.find((r) => r.label === "IVA 0%");
  assert.equal(ivaZero, undefined, "IVA 0% $0.00 row should not exist");
});

// ── G-G: No objeto = 0.00 ──

test("G-G: No objeto IVA defaults to 0.00", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "100.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "100.00", valor: "15.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "100.00", valor: "15.00" },
    ],
    totalSinImpuestos: "100.00",
    importeTotal: "115.00",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  assert.equal(result.totals.subtotalNoObjetoIva, "0.00");
});

// ── G-H: Exento = 0.00 ──

test("G-H: Exento IVA defaults to 0.00", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "100.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "100.00", valor: "15.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "100.00", valor: "15.00" },
    ],
    totalSinImpuestos: "100.00",
    importeTotal: "115.00",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  assert.equal(result.totals.subtotalExentoIva, "0.00");
});

// ── G-I: orden exacto rows ──

test("G-I: exact row order for the spec example (304.50 + 468 + IVA 45.68)", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "304.50",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "304.50", valor: "45.68" },
        ],
      },
      {
        precioTotalSinImpuesto: "468.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "0", tarifa: "0.00", baseImponible: "468.00", valor: "0.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "304.50", valor: "45.68" },
      { codigo: "2", codigoPorcentaje: "0", baseImponible: "468.00", valor: "0.00" },
    ],
    totalSinImpuestos: "772.50",
    importeTotal: "818.18",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);

  assert.deepEqual(result.totals.subtotalTaxed, [
    { label: "SUBTOTAL 15%", baseAmount: "304.50", value: "45.68" },
  ]);
  assert.equal(result.totals.subtotalZero, "468.00");
  assert.equal(result.totals.subtotalNoObjetoIva, "0.00");
  assert.equal(result.totals.subtotalExentoIva, "0.00");
  assert.equal(result.totals.subtotalSinImpuestos, "772.50");
  assert.equal(result.totals.totalDescuento, "0.00");
  assert.equal(result.totals.ice, "0.00");
  assert.deepEqual(result.totals.iva, [
    { label: "IVA 15%", baseAmount: "304.50", value: "45.68" },
  ]);
  assert.equal(result.totals.irbpnr, "0.00");
  assert.equal(result.totals.propina, "0.00");
  assert.equal(result.totals.importeTotal, "818.18");
});

// ── G-J: VALOR TOTAL SIN SUBSIDIO aparece ──

test("G-J: valorTotalSinSubsidio field exists", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "100.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "100.00", valor: "15.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "100.00", valor: "15.00" },
    ],
    totalSinImpuestos: "100.00",
    importeTotal: "115.00",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  assert.equal(typeof result.totals.valorTotalSinSubsidio, "string");
});

// ── G-K: AHORRO POR SUBSIDIO aparece ──

test("G-K: ahorroPorSubsidio field exists", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "100.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "100.00", valor: "15.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "100.00", valor: "15.00" },
    ],
    totalSinImpuestos: "100.00",
    importeTotal: "115.00",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  assert.equal(typeof result.totals.ahorroPorSubsidio, "string");
});

// ── G-L: factura sin subsidio → ambos 0.00 ──

test("G-L: invoice without subsidy → both subsidy fields are 0.00", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "100.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "100.00", valor: "15.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "100.00", valor: "15.00" },
    ],
    totalSinImpuestos: "100.00",
    importeTotal: "115.00",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  assert.equal(result.totals.valorTotalSinSubsidio, "0.00");
  assert.equal(result.totals.ahorroPorSubsidio, "0.00");
});

// ── G-M: factura con subsidio → totalSinSubsidio - ahorro ≈ importeTotal ──

test("G-M: invoice with subsidy → totalSinSubsidio - ahorro ≈ importeTotal", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        cantidad: "2",
        precioUnitario: "8.00",
        precioSinSubsidio: "10.00",
        subsidio: "2.00",
        precioTotalSinImpuesto: "16.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "16.00", valor: "2.40" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "16.00", valor: "2.40" },
    ],
    totalSinImpuestos: "16.00",
    importeTotal: "18.40",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  const vtss = Number(result.totals.valorTotalSinSubsidio);
  const ahorro = Number(result.totals.ahorroPorSubsidio);
  const total = Number(result.totals.importeTotal);
  assert.ok(vtss > 0, "valorTotalSinSubsidio should be > 0");
  assert.ok(ahorro > 0, "ahorroPorSubsidio should be > 0");
  assert.ok(
    Math.abs(vtss - ahorro - total) < 0.02,
    `vtss(${vtss}) - ahorro(${ahorro}) should ≈ total(${total})`,
  );
});

// ── G-N: múltiples tasas mantienen labels correctos ──

test("G-N: multiple tax rates maintain correct labels", async () => {
  const mod = await loadParser();
  if (!mod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "100.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "100.00", valor: "15.00" },
        ],
      },
      {
        precioTotalSinImpuesto: "50.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "5", tarifa: "5.00", baseImponible: "50.00", valor: "2.50" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "100.00", valor: "15.00" },
      { codigo: "2", codigoPorcentaje: "5", baseImponible: "50.00", valor: "2.50" },
    ],
    totalSinImpuestos: "150.00",
    importeTotal: "167.50",
  });

  const result = mod.parseAuthorizedSriInvoiceXml(xml);
  const labels = result.totals.subtotalTaxed.map((r) => r.label);
  assert.ok(labels.includes("SUBTOTAL 15%"), "Should have SUBTOTAL 15%");
  assert.ok(labels.includes("SUBTOTAL 5%"), "Should have SUBTOTAL 5%");

  const ivaLabels = result.totals.iva.map((r) => r.label);
  assert.ok(ivaLabels.includes("IVA 15%"), "Should have IVA 15%");
  assert.ok(ivaLabels.includes("IVA 5%"), "Should have IVA 5%");
});

// ── G-O: no se modifica ninguna otra sección RIDE ──

test("G-O: RIDE PDF still generates successfully with corrected parser", async () => {
  const parserMod = await loadParser();
  const genMod = await loadGenerator();
  if (!parserMod || !genMod) return;

  const xml = buildAuthorizedXml({
    details: [
      {
        precioTotalSinImpuesto: "304.50",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "4", tarifa: "15.00", baseImponible: "304.50", valor: "45.68" },
        ],
      },
      {
        precioTotalSinImpuesto: "468.00",
        impuestos: [
          { codigo: "2", codigoPorcentaje: "0", tarifa: "0.00", baseImponible: "468.00", valor: "0.00" },
        ],
      },
    ],
    totalImpuestos: [
      { codigo: "2", codigoPorcentaje: "4", baseImponible: "304.50", valor: "45.68" },
      { codigo: "2", codigoPorcentaje: "0", baseImponible: "468.00", valor: "0.00" },
    ],
    totalSinImpuestos: "772.50",
    importeTotal: "818.18",
  });

  const parsed = parserMod.parseAuthorizedSriInvoiceXml(xml);

  assert.equal(parsed.emitter.legalName, "EMPRESA TEST S.A.");
  assert.equal(parsed.customer.name, "CLIENTE TEST");
  assert.equal(parsed.document.number, "001-010-000000390");

  const buffer = await genMod.generateRidePdfFromAuthorizedXml(parsed);
  assert.ok(buffer instanceof Buffer);
  assert.ok(buffer.length > 500);

  const header = buffer.subarray(0, 5).toString("ascii");
  assert.equal(header, "%PDF-");
});

test("RIDE resolves the codigoPorcentaje map when both total and detail tarifa are absent", async () => {
  const { parseAuthorizedSriInvoiceXml } = await loadParser();
  const invoice = parseAuthorizedSriInvoiceXml(buildAuthorizedXml({ details: [{ impuestos: [] }], totalImpuestos: [{ codigo: "2", codigoPorcentaje: "4", baseImponible: "100.00", valor: "15.00" }] }));
  assert.equal(invoice.totals.iva[0].label, "IVA 15%");
  assert.ok(!invoice.totals.iva.some((row) => row.label === "IVA 0%"));
});
test("RIDE uses detail tarifa before the code map and explicit total tarifa before detail", async () => {
  const { parseAuthorizedSriInvoiceXml } = await loadParser();
  const fixture = { details: [{ impuestos: [{ codigo: "2", codigoPorcentaje: "4", tarifa: "8", baseImponible: "100", valor: "8" }] }], totalImpuestos: [{ codigo: "2", codigoPorcentaje: "4", baseImponible: "100", valor: "8" }] };
  assert.equal(parseAuthorizedSriInvoiceXml(buildAuthorizedXml(fixture)).totals.iva[0].label, "IVA 8%");
  assert.equal(parseAuthorizedSriInvoiceXml(buildAuthorizedXml({ ...fixture, totalImpuestos: [{ ...fixture.totalImpuestos[0], tarifa: "12" }] })).totals.iva[0].label, "IVA 12%");
});
test("subsidy totals preserve discounts and each detail's VAT instead of applying average VAT to the whole invoice", async () => {
  const { parseAuthorizedSriInvoiceXml } = await loadParser();
  const invoice = parseAuthorizedSriInvoiceXml(buildAuthorizedXml({
    details: [
      { cantidad: "2", precioUnitario: "8", precioSinSubsidio: "10", subsidio: "2", descuento: "1", precioTotalSinImpuesto: "15", impuestos: [{ codigo: "2", codigoPorcentaje: "4", tarifa: "15", baseImponible: "15", valor: "2.25" }] },
      { cantidad: "1", precioUnitario: "10", precioTotalSinImpuesto: "10", impuestos: [{ codigo: "2", codigoPorcentaje: "0", tarifa: "0", baseImponible: "10", valor: "0" }] },
    ],
    totalImpuestos: [ { codigo: "2", codigoPorcentaje: "4", baseImponible: "15", valor: "2.25" }, { codigo: "2", codigoPorcentaje: "0", baseImponible: "10", valor: "0" } ],
    totalSinImpuestos: "25", totalDescuento: "1", importeTotal: "27.25",
  }));
  assert.equal(invoice.totals.valorTotalSinSubsidio, "31.85");
  assert.equal(invoice.totals.ahorroPorSubsidio, "4.60");
});
