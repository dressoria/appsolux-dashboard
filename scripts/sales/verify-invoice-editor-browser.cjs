/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS verification script. */
/* Real invoice components + CSS in an isolated browser. HTTP is mocked; no SRI send is simulated or requested. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.FACTUROM_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'facturom-invoice-ui-'));
  const project = path.resolve(__dirname, '../..');
  let server;
  let browser;
  let count = 0;
  const pass = (label) => { count++; console.log(`PASS ${label}`); };
  try {
    await esbuild.build({
      stdin: { resolveDir: project, loader: 'tsx', sourcefile: 'invoice-browser-harness.tsx', contents: `
        import React from 'react';
        import { renderToString } from 'react-dom/server';
        import { hydrateRoot } from 'react-dom/client';
        import { InvoiceEditor } from '@/components/appsolux/sales/invoice-editor';
        import '@/app/globals.css';
        const params = new URLSearchParams(location.search);
        const draft = params.has('draft') ? JSON.parse(params.get('draft')) : undefined;
        const ui = <InvoiceEditor
          issueDateLabel="19 nov 2026" submissionEnabled={!params.has('restricted')}
          sellerContext={{ defaultSellerId: 'seller-a', canSelectSeller: !params.has('locked'), sellers: [
            { id: 'seller-a', name: 'Usuario de prueba', email: 'a@example.test' },
            { id: 'seller-b', name: 'Sofía Vendedora Autorizada', email: 'sofia@example.test' }
          ] }}
          customers={[
            { id: 'customer-a', name: 'Cliente de prueba', tradeName: 'Comercial prueba', identification: '1790016919001', email: 'cliente@example.test', phone: '+593 99 123 4567', address: 'Calle de prueba y avenida principal' },
            { id: 'customer-b', name: 'Otro cliente', tradeName: null, identification: '1710034065', email: null, phone: null, address: null }
          ]}
          products={[{ id: 'product-a', name: 'Servicio de prueba', primaryCode: 'TEST-01', auxiliaryCode: null, description: null, price: '100', price2: '90', price3: null, stock: 999999, taxRate: '15', taxCategory: 'TAXABLE', cost: '40', trackInventory: false, type: 'SERVICE' }]}
          warehouses={[{ id: 'warehouse-a', code: 'TEST', name: 'Bodega de prueba', isDefault: true }]}
          warehouseStocks={[]} shipmentGuides={[]} treasuryAccounts={[]}
          establishments={[{ id: 'est-a', code: '001', name: 'Establecimiento de prueba' }]}
          issuePoints={[{ id: 'point-a', code: '002', name: 'Punto de prueba', establishmentId: 'est-a' }]}
          draftPayload={draft} draftId={draft ? 'draft-browser' : undefined}
        />;
        document.getElementById('root').innerHTML = renderToString(ui);
        hydrateRoot(document.getElementById('root'), ui);
      ` },
      absWorkingDir: project, bundle: true, outfile: path.join(temporary, 'app.js'), jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"development"' },
      plugins: [{ name: 'isolated-harness', setup(build) {
        build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'next-test' }));
        build.onLoad({ filter: /.*/, namespace: 'next-test' }, () => ({ contents: `import React from 'react'; export default function Link(props) { return React.createElement('a', props); }`, loader: 'js', resolveDir: project }));
        build.onLoad({ filter: /app\/globals\.css$/ }, async () => {
          const file = path.join(project, 'app/globals.css');
          const result = await require('postcss')([require('@tailwindcss/postcss')()]).process(await fs.readFile(file, 'utf8'), { from: file });
          return { contents: result.css, loader: 'css', resolveDir: project };
        });
      } }],
    });
    server = http.createServer(async (req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const name = pathname === '/app.js' ? 'app.js' : pathname === '/app.css' ? 'app.css' : null;
      res.setHeader('Content-Type', name === 'app.js' ? 'application/javascript' : name === 'app.css' ? 'text/css' : 'text/html');
      res.end(name ? await fs.readFile(path.join(temporary, name)) : '<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invoice UI test</title><link rel="stylesheet" href="/app.css"><style>#root{max-width:1700px;margin:auto;padding:12px}@media(min-width:640px){#root{padding:20px}}</style><div id="root"></div><script src="/app.js"></script></html>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, ...(process.env.FACTUROM_CHROME_PATH ? { executablePath: process.env.FACTUROM_CHROME_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const requests = [];
    let draftPayload;
    let salePayload;
    let journalStatus = 200;
    let journal = null;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const pathname = new URL(request.url()).pathname;
      requests.push({ path: pathname, method: request.method() });
      if (pathname.startsWith('/api/facturacion/drafts')) {
        const body = request.postDataJSON();
        if (body.payload) draftPayload = body.payload;
        return route.fulfill({ json: { ok: true, draft: { id: 'draft-browser' } } });
      }
      if (pathname === '/api/basic/sales') {
        salePayload = request.postDataJSON();
        assert.equal(salePayload.outputMode, 'internal_receipt');
        return route.fulfill({ json: { ok: true, sale: { id: 'sale-browser' } } });
      }
      if (pathname === '/api/basic/sales/sale-browser/journal') return route.fulfill({ status: journalStatus, json: journalStatus === 200 ? { entry: journal } : { message: 'Tu acceso actual no permite consultar información contable.' } });
      throw new Error(`Unexpected request: ${request.method()} ${pathname}`);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const open = async (params = {}) => { await page.goto(`${origin}?${new URLSearchParams(params)}`); await page.getByRole('heading', { name: 'Nueva factura' }).waitFor(); };
    const field = (label) => page.getByLabel(label, { exact: true });
    const details = page.getByRole('radio', { name: 'Detalles', exact: true });
    const asiento = page.getByRole('radio', { name: 'Asiento', exact: true });
    const exportSwitch = page.getByRole('switch', { name: 'Factura de Exportación' });
    const refundSwitch = page.getByRole('switch', { name: 'Factura Reembolso' });
    const selectedCustomer = page.getByRole('region', { name: 'Cliente seleccionado', exact: true });

    await open();
    assert.equal(await field('Forma de pago SRI').inputValue(), '20');
    assert.equal(await field('Forma de pago').inputValue(), 'cash');
    assert.match(await page.locator('#invoice-sri-payment-description').innerText(), /20 — Otros con utilización del sistema financiero/);
    assert.equal(await page.getByRole('button', { name: 'Guardar factura', exact: true }).isDisabled(), true);
    await field('Forma de pago SRI').selectOption('19');
    assert.equal(await field('Forma de pago').inputValue(), 'cash');
    await field('Forma de pago SRI').selectOption('20');
    pass('Forma de pago SRI legible y diferenciada del método comercial; código 20 conservado');

    await page.getByRole('button', { name: 'Cambiar vendedor', exact: true }).click();
    await field('Buscar vendedor por nombre').fill('Sofía');
    await page.getByRole('button', { name: /Sofía Vendedora Autorizada/ }).press('Enter');
    assert.match(await page.getByRole('button', { name: 'Cambiar vendedor', exact: true }).innerText(), /Sofía Vendedora Autorizada[\s\S]*Seleccionado/);
    pass('Vendedor buscable y seleccionable con teclado y estado visible');

    await field('Buscar cliente').fill('Cliente de prueba');
    await page.getByRole('button', { name: /Cliente de prueba · 1790016919001/ }).press('Enter');
    assert.equal(await selectedCustomer.getByRole('heading', { name: 'Cliente de prueba' }).count(), 1);
    assert.match(await selectedCustomer.innerText(), /Identificación[\s\S]*Teléfono[\s\S]*Correo[\s\S]*Dirección/);
    await field('Observación de factura').fill('Observación independiente');
    await page.getByRole('button', { name: 'Cambiar cliente', exact: true }).click();
    assert.equal(await field('Buscar cliente').evaluate((el) => el === document.activeElement), true);
    await field('Buscar cliente').fill('Otro cliente');
    await page.getByRole('button', { name: /Otro cliente · 1710034065/ }).click();
    await page.getByRole('button', { name: 'Limpiar selección de cliente', exact: true }).click();
    assert.equal(await selectedCustomer.count(), 0);
    assert.equal(await field('Observación de factura').inputValue(), 'Observación independiente');
    assert.equal(await page.getByRole('link', { name: '+ Nuevo cliente' }).getAttribute('href'), '/facturacion/customers/new');
    await field('Buscar cliente').fill('Cliente de prueba');
    await page.getByRole('button', { name: /Cliente de prueba · 1790016919001/ }).click();
    pass('Tarjeta de cliente organizada; cambiar y limpiar conservan la observación de factura');

    await exportSwitch.focus();
    await exportSwitch.press('Space');
    assert.equal(await exportSwitch.getAttribute('aria-checked'), 'true');
    await field('Incoterm').fill('FOB');
    await refundSwitch.click();
    assert.equal(await exportSwitch.getAttribute('aria-checked'), 'false');
    assert.equal(await refundSwitch.getAttribute('aria-checked'), 'true');
    await field('Nro. doc. reembolso').fill('Documento de prueba');
    await exportSwitch.click();
    assert.equal(await refundSwitch.getAttribute('aria-checked'), 'false');
    assert.equal(await field('Incoterm').inputValue(), 'FOB');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await page.getByText('Borrador guardado.', { exact: true }).waitFor();
    assert.equal(draftPayload.sellerId, 'seller-b');
    assert.equal(draftPayload.invoiceKind, 'EXPORT');
    assert.equal(draftPayload.reimbursementData.reimbursementDocNumber, 'Documento de prueba');
    const storedDraft = draftPayload;
    await open({ draft: JSON.stringify(storedDraft) });
    assert.match(await page.getByRole('button', { name: 'Cambiar vendedor', exact: true }).innerText(), /Sofía/);
    assert.equal(await exportSwitch.getAttribute('aria-checked'), 'true');
    assert.equal(await field('Incoterm').inputValue(), 'FOB');
    await page.getByRole('button', { name: 'Guardar borrador' }).click();
    await page.getByText('Borrador actualizado.', { exact: true }).waitFor();
    assert.equal(draftPayload.sellerId, 'seller-b');
    pass('Switches excluyentes y persistencia de vendedor y modalidades en borrador/reapertura');

    const beforeJournal = requests.length;
    await details.focus();
    await details.press('ArrowRight');
    assert.equal(await asiento.getAttribute('aria-checked'), 'true');
    await page.getByText('Asiento contable no disponible todavía para esta factura.', { exact: true }).waitFor();
    assert.equal(requests.length, beforeJournal);
    assert.equal(await page.getByRole('region', { name: 'Asiento de la factura' }).getByText('—', { exact: true }).count(), 3);
    await details.click();
    await field('Buscar producto').fill('Servicio');
    await page.getByRole('button', { name: /Servicio de prueba · TEST-01/ }).click();
    await asiento.click();
    await details.click();
    assert.equal(await page.getByRole('cell').filter({ hasText: 'Servicio de prueba' }).count(), 1);
    pass('Detalles conserva líneas al alternar; Asiento vacío no inventa totales ni llama al servidor antes de guardar');

    const totalText = () => page.locator('aside strong').innerText();
    await field('Cantidad de Servicio de prueba').fill('2');
    await field('Cantidad de Servicio de prueba').press('Tab');
    assert.match(await totalText(), /230[,.]00/);
    await field('Descuento porcentual de Servicio de prueba').fill('10');
    await field('Descuento porcentual de Servicio de prueba').press('Tab');
    assert.match(await totalText(), /207[,.]00/);
    await field('Descuento global $').fill('7');
    await field('Descuento global $').press('Tab');
    assert.match(await totalText(), /198[,.]95/);
    await field('Cantidad de Servicio de prueba').fill('1');
    await field('Cantidad de Servicio de prueba').press('Tab');
    await field('Descuento porcentual de Servicio de prueba').fill('0');
    await field('Descuento porcentual de Servicio de prueba').press('Tab');
    await field('Descuento global $').fill('0');
    await field('Descuento global $').press('Tab');
    assert.match(await totalText(), /115[,.]00/);
    pass('Cantidades, descuentos e impuestos conservan los totales existentes');

    const screenshots = process.env.FACTUROM_INVOICE_SCREENSHOTS;
    const prepareScreenshot = () => page.evaluate(() => {
      document.activeElement?.blur();
      window.scrollTo(0, 0);
      const table = document.querySelector('[aria-label="Productos de la factura"]');
      if (table) table.scrollLeft = 0;
    });
    if (screenshots) { await fs.mkdir(screenshots, { recursive: true }); await prepareScreenshot(); await page.screenshot({ path: path.join(screenshots, 'invoice-desktop.png'), fullPage: true }); }
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      const sriBox = await field('Forma de pago SRI').boundingBox();
      assert.ok(sriBox.x >= 0 && sriBox.x + sriBox.width <= width);
      for (const view of [asiento, details]) {
        await view.click();
        const size = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(size.scroll <= size.width, `Page overflow at ${width}px: ${size.scroll}/${size.width}`);
      }
    }
    if (screenshots) { await page.setViewportSize({ width: 390, height: 844 }); await prepareScreenshot(); await page.screenshot({ path: path.join(screenshots, 'invoice-mobile.png'), fullPage: true }); }
    pass('Sin superposición SRI ni desbordamiento global en escritorio, tablet y móvil');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    assert.equal(await exportSwitch.locator('span').evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
    assert.equal(await selectedCustomer.evaluate((el) => getComputedStyle(el).animationName), 'none');
    pass('Switches y tarjeta respetan reduced motion');

    // Exercise saving only as internal_receipt; SRI actions are never requested by this harness.
    await exportSwitch.click();
    await page.getByRole('button', { name: 'Guardar factura', exact: true }).click();
    await page.getByText('Venta guardada. Ya puedes enviarla al SRI.', { exact: true }).waitFor();
    assert.equal(salePayload.customerId, 'customer-a');
    assert.equal(salePayload.notes, 'Observación independiente');
    assert.equal(salePayload.sriPaymentCode, '20');
    assert.equal(salePayload.items[0].unitPrice, 100);
    assert.equal(salePayload.items[0].quantity, 1);
    assert.equal('sellerId' in salePayload, false);
    assert.equal(await field('Forma de pago SRI').isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Guardar borrador' }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'RIDE', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Ticket', exact: true }).isEnabled(), true);
    pass('Guardado conserva el contrato de venta y bloquea edición sin simular envíos SRI');

    journal = { id: 'entry-test', number: 'ASIENTO-TEST', description: 'Asiento almacenado de prueba', status: 'POSTED', lines: [
      { id: 'line-a', accountCode: 'TEST-A', accountName: 'Cuenta real de prueba A', debit: '115.00', credit: '0.00' },
      { id: 'line-b', accountCode: 'TEST-B', accountName: 'Cuenta real de prueba B', debit: '0.00', credit: '115.00' }
    ], totalDebit: '115.00', totalCredit: '115.00', difference: '0.00' };
    await asiento.click();
    await page.getByText('ASIENTO-TEST', { exact: true }).waitFor();
    await page.getByText('Contabilizado', { exact: true }).waitFor();
    assert.equal(await page.getByRole('cell', { name: /TEST-A/ }).count(), 1);
    journal = { ...journal, status: 'DRAFT', totalCredit: '114.00', difference: '1.00', lines: [journal.lines[0], { ...journal.lines[1], credit: '114.00' }] };
    await page.getByRole('button', { name: 'Actualizar consulta' }).click();
    await page.getByText('Borrador contable · No contabilizado', { exact: true }).waitFor();
    const difference = page.getByRole('region', { name: 'Asiento de la factura' }).locator('dl > div').filter({ has: page.getByText('Diferencia', { exact: true }) });
    assert.match(await difference.innerText(), /1,00|1\.00/);
    journalStatus = 403;
    await page.getByRole('button', { name: 'Actualizar consulta' }).click();
    await page.getByText('Tu acceso actual no permite consultar información contable.', { exact: true }).waitFor();
    assert.equal(await page.getByText('ASIENTO-TEST', { exact: true }).count(), 0);
    journalStatus = 200;
    journal = null;
    await page.getByRole('button', { name: 'Actualizar consulta' }).click();
    await page.getByText('Asiento contable no disponible todavía para esta factura.', { exact: true }).waitFor();
    assert.ok(requests.filter((request) => request.path.endsWith('/journal')).every((request) => request.method === 'GET'));
    assert.ok(!requests.some((request) => request.path.startsWith('/api/sri/')));
    pass('Asiento consultable tras guardar: cuentas, estado, diferencia real, vacío y acceso denegado');

    await open({ locked: '1', restricted: '1' });
    assert.equal(await page.getByRole('button', { name: 'Cambiar vendedor', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Guardar y enviar al SRI', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Guardar factura', exact: true }).isDisabled(), true);
    assert.deepEqual(errors.filter((message) => !message.includes('403 (Forbidden)')), []);
    pass('Configuración y desactivación existente respetadas; SSR/hidratación sin errores');
    console.log(`${count} browser checks passed (isolated HTTP fixtures, no live SRI requests).`);
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
