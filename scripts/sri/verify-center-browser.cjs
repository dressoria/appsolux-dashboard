/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS browser verification. */
/* Isolated UI fixtures only: never contacts SRI, starts a real job, imports into a DB or submits an ATS. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.FACTUROM_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const project = path.resolve(__dirname, '../..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'facturom-sri-center-'));
  let browser;
  let server;
  let count = 0;
  const pass = (label) => { count++; console.log(`PASS ${label}`); };
  try {
    await esbuild.build({
      stdin: { resolveDir: project, loader: 'tsx', sourcefile: 'sri-center-harness.tsx', contents: `
        import React from 'react'; import { renderToString } from 'react-dom/server'; import { hydrateRoot } from 'react-dom/client';
        import { TaxCenterClient } from '@/components/appsolux/sri-tax/tax-center-client';
        import { TaxNavigation } from '@/components/appsolux/sri-tax/tax-navigation';
        import styles from '@/components/appsolux/sri-tax/sri-center.module.css'; import '@/app/globals.css';
        const paths = {'/facturacion/sri':'summary','/facturacion/sri/received':'received','/facturacion/sri/ats':'ats','/facturacion/sri/ats/summary':'ats-summary','/facturacion/sri/iva-104':'iva-104','/facturacion/sri/validations':'validations'};
        const view = paths[location.pathname] ?? 'summary';
        const ui = <main className={styles.center}><h1 className="mb-5 text-xl font-semibold">Centro tributario · Empresa de prueba A</h1><TaxNavigation activeHref={location.pathname} /><div className="mt-5"><TaxCenterClient view={view} initialYear={2026} initialMonth={9} /></div></main>;
        document.getElementById('root').innerHTML = renderToString(ui); hydrateRoot(document.getElementById('root'), ui);
      ` },
      absWorkingDir: project, bundle: true, outfile: path.join(temporary, 'app.js'), jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
      plugins: [{ name: 'test-environment', setup(build) {
        build.onResolve({ filter: /^next\/link$/ }, () => ({ path: 'link', namespace: 'next-test' }));
        build.onLoad({ filter: /.*/, namespace: 'next-test' }, () => ({ contents: `import React from 'react';export default function Link(props){return React.createElement('a',props)}`, loader: 'js', resolveDir: project }));
        build.onLoad({ filter: /app\/globals\.css$/ }, async () => { const file = path.join(project, 'app/globals.css'); const result = await require('postcss')([require('@tailwindcss/postcss')()]).process(await fs.readFile(file, 'utf8'), { from: file }); return { contents: result.css, loader: 'css', resolveDir: project }; });
      } }],
    });
    server = http.createServer(async (req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = pathname === '/app.js' ? 'app.js' : pathname === '/app.css' ? 'app.css' : null;
      res.setHeader('Content-Type', file === 'app.js' ? 'application/javascript' : file === 'app.css' ? 'text/css' : 'text/html');
      res.end(file ? await fs.readFile(path.join(temporary, file)) : '<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SRI center isolated UI test</title><link rel="stylesheet" href="/app.css"><div id="root" style="max-width:1250px;margin:auto;padding:20px"></div><script src="/app.js"></script></html>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, ...(process.env.FACTUROM_CHROME_PATH ? { executablePath: process.env.FACTUROM_CHROME_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const errors = [];
    const requests = [];
    const previews = [];
    let atsCase = 'blocked';
    let importCase = 'success';
    let syncCase = 'setup';
    const company = { legalName: 'Empresa de prueba A', ruc: '1790016919001', regime: null };
    const period = { year: 2026, month: 9, frequency: 'MONTHLY', key: '202609', label: '09/2026', start: '2026-09-01T05:00:00Z', end: '2026-10-01T05:00:00Z' };
    const totals = { sales: { count: 0, base: '0.00', iva: '0.00', total: '0.00' }, purchases: { count: 1, base: '100.00', iva: '15.00', total: '115.00' }, withholdings: { count: 0, amount: '0.00' }, cancelled: { count: 0 } };
    const issues = [
      { code: 'FISCAL_CLASSIFICATION_MISSING', severity: 'ERROR', type: 'PURCHASE', document: '001-001-000000001', description: 'Falta la clasificación fiscal del documento.', action: 'Completa la clasificación fiscal.', href: '/facturacion/purchases/documents/purchase-test' },
      { code: 'ATS_CATALOG_MAPPING_PENDING', severity: 'ERROR', type: 'ATS', document: null, description: 'Mapeo del catálogo ATS pendiente.', action: 'Verifica el catálogo ATS antes de exportar.', href: null },
      { code: 'RECEIVED_WITHHOLDINGS_UNAVAILABLE', severity: 'WARNING', type: 'PERIOD', document: null, description: 'No existe información de retenciones recibidas.', action: 'Verifica las retenciones recibidas.', href: null },
    ];
    const sync = { available: false, syncStatus: 'PENDING_SETUP', credentialStatus: null, lastSyncAt: null, nextSyncAt: null, activeJob: null };
    const rows = [...Array.from({ length: 26 }, (_, index) => ({ id: `inbox-${index + 1}`, source: 'INBOX', number: `001-001-${String(index + 1).padStart(9, '0')}`, type: 'INVOICE', name: `Proveedor ${index + 1}`, ruc: '1790016919001', date: '2026-09-10T12:00:00Z', authorizationDate: null, base: '100.00', iva: '15.00', total: '115.00', status: 'NEW', origin: 'XML_IMPORT', purchaseId: null, accessKey: null, canRegister: true, canIgnore: true, group: 'UNREGISTERED' })),
      { id: 'purchase-registered', source: 'PURCHASE', number: '001-002-000000001', type: 'INVOICE', name: 'Proveedor registrado', ruc: '1790016919001', date: '2026-09-10T12:00:00Z', authorizationDate: '2026-09-10T14:00:00Z', base: '100.00', iva: '15.00', total: '115.00', status: 'REGISTERED', origin: 'MANUAL', purchaseId: 'purchase-registered', canRegister: false, canIgnore: false, group: 'REGISTERED' },
      { id: 'purchase-cancelled', source: 'PURCHASE', number: '001-003-000000001', type: 'INVOICE', name: 'Proveedor cancelado', ruc: '1790016919001', date: '2026-09-10T12:00:00Z', authorizationDate: null, base: '100.00', iva: '15.00', total: '115.00', status: 'CANCELLED', origin: 'MANUAL', purchaseId: 'purchase-cancelled', canRegister: false, canIgnore: false, group: 'CANCELLED' },
    ];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/api/**', async (route) => {
      const request = route.request(); const url = new URL(request.url()); requests.push({ path: url.pathname, method: request.method(), query: url.search });
      if (url.pathname === '/api/sri-tax/summary') return route.fulfill({ json: { company, period, sales: totals.sales, purchases: totals.purchases, issuedWithholdings: '0.00', receivedWithholdings: null, problems: 1, atsStatus: 'Con observaciones', ivaStatus: 'Por revisar', received: { registered: 1, pending: 26 }, coverage: 'Registros internos; no acreditan integridad frente al SRI.', sync } });
      if (url.pathname === '/api/sri-tax/ats/preview') {
        previews.push(url.search);
        if (atsCase === 'http') return route.fulfill({ status: 500, json: { error: 'Error real del servidor de prueba.' } });
        if (atsCase === 'body-error') return route.fulfill({ json: { ok: false, error: 'Validación rechazada en respuesta HTTP 200.' } });
        return route.fulfill({ json: { company, period, totals, sales: [], purchases: [{ id: 'purchase-test', href: '/facturacion/purchases/documents/purchase-test', direction: 'PURCHASE', number: '001-001-000000001', type: 'INVOICE', status: 'REGISTERED', base: '100.00', iva: '15.00' }], withholdings: [], cancelled: [], hasInformation: true, issues: atsCase === 'blocked' ? issues : [], domainStatus: atsCase === 'blocked' ? 'DOMAIN_VALIDATION_ERROR' : 'DOMAIN_VALIDATION_OK', xmlStatus: atsCase === 'blocked' ? 'XML_NOT_GENERATED' : 'XML_GENERATED', xsdStatus: 'XSD_VALIDATION_PENDING', catalogMappingStatus: 'ATS_CATALOG_MAPPING_PENDING' } });
      }
      if (url.pathname === '/api/sri-tax/ats/summary') return route.fulfill({ json: { error: 'No hay un archivo PDF disponible.' } });
      if (url.pathname === '/api/sri-tax/received') {
        if (request.method() === 'POST') return route.fulfill({ json: { ok: true, purchaseId: 'new-purchase-review' } });
        const filtered = rows.filter((row) => !url.searchParams.get('q') || row.name.toLowerCase().includes(url.searchParams.get('q').toLowerCase()));
        const items = filtered.filter((row) => row.group === (url.searchParams.get('view') || 'UNREGISTERED'));
        const currentPage = Number(url.searchParams.get('page') || 1);
        return route.fulfill({ json: { items: items.slice((currentPage - 1) * 25, currentPage * 25), total: items.length, page: currentPage, pageSize: 25, totalPages: Math.ceil(items.length / 25), counts: { unregistered: filtered.filter((row) => row.group === 'UNREGISTERED').length, registered: filtered.filter((row) => row.group === 'REGISTERED').length, cancelled: filtered.filter((row) => row.group === 'CANCELLED').length }, supportedTypes: ['INVOICE'], xmlNotice: 'El XML original no está disponible en almacenamiento accesible.', sync: syncCase === 'setup' ? sync : { ...sync, available: true, syncStatus: 'ACTIVE', credentialStatus: 'VERIFIED' } } });
      }
      if (url.pathname === '/api/purchases/sri-sync/jobs') return route.fulfill({ json: { jobs: syncCase === 'setup' ? [] : [{ id: 'job-fixture', type: 'SYNC_RECEIVED_DOCUMENTS', status: syncCase === 'running' ? 'RUNNING' : syncCase === 'failed' ? 'FAILED' : 'SUCCEEDED', dateFrom: null, dateTo: null, checkpointDate: null, totalDays: 1, completedDays: syncCase === 'running' ? 0 : 1, currentDateLabel: null, documentsFound: 7, documentsImported: 4, documentsSkipped: 3, documentsFailed: 0, startedAt: '2026-09-10T12:00:00Z', finishedAt: syncCase === 'running' ? null : '2026-09-10T12:01:00Z', errorCode: syncCase === 'failed' ? 'TEST_ERROR' : null, errorMessage: syncCase === 'failed' ? 'Error registrado en el trabajo de prueba.' : null }] } });
      if (url.pathname === '/api/purchases/import-xml') return importCase === 'duplicate' ? route.fulfill({ status: 400, json: { ok: false, error: 'Este documento ya está registrado.' } }) : route.fulfill({ json: { ok: true, purchaseDocumentId: 'import-test', reviewRequired: true } });
      if (url.pathname === '/api/purchases/categories') return route.fulfill({ json: [] });
      throw new Error(`Unexpected request: ${request.method()} ${url.pathname}`);
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const open = async (suffix = '') => { await page.goto(`${origin}/facturacion/sri${suffix}`); await page.getByRole('navigation', { name: 'Centro tributario SRI' }).waitFor(); };
    const screenshot = async (name) => { if (!process.env.FACTUROM_SRI_SCREENSHOTS) return; await fs.mkdir(process.env.FACTUROM_SRI_SCREENSHOTS, { recursive: true }); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(process.env.FACTUROM_SRI_SCREENSHOTS, name), fullPage: true }); };

    await open();
    await page.getByRole('region', { name: 'Obligaciones tributarias' }).waitFor();
    assert.equal(await page.getByText('Sin verificar', { exact: true }).count(), 5);
    assert.equal(await page.getByText('Al día', { exact: true }).count(), 0);
    assert.match(await page.getByRole('region', { name: 'Obligaciones tributarias' }).innerText(), /1790016919001/);
    assert.equal(await page.getByText('Actividad registrada en Facturom', { exact: true }).count(), 1);
    await screenshot('sri-summary-desktop.png');
    pass('Resumen distingue obligaciones sin verificar de importes locales y muestra empresa/RUC del contexto');

    const nav = page.getByRole('navigation', { name: 'Centro tributario SRI' });
    assert.equal(await nav.getByRole('link').count(), 6);
    const current = nav.locator('[aria-current="page"]');
    await current.focus(); await current.press('ArrowRight');
    assert.equal(await page.evaluate(() => document.activeElement.textContent), 'Comprobantes recibidos');
    await page.keyboard.press('Enter');
    await page.waitForURL('**/facturacion/sri/received');
    await page.getByRole('radio', { name: 'Sin registrar (26)', exact: true }).waitFor();
    assert.equal(await nav.locator('[aria-current="page"]').innerText(), 'Comprobantes recibidos');
    pass('Seis rutas conservadas, navegación por teclado e indicador de sección activa');

    const listing = page.getByRole('region', { name: 'Listado de comprobantes recibidos' });
    assert.equal(await listing.getByRole('columnheader').count(), 13);
    assert.match(await listing.innerText(), /Sin información/);
    assert.equal(await page.getByRole('button', { name: 'Sincronizar ahora', exact: true }).isDisabled(), true);
    await page.getByRole('button', { name: 'Siguiente', exact: true }).click();
    await page.getByText('Página 2 de 2', { exact: true }).waitFor();
    assert.equal(await listing.getByRole('checkbox').count(), 1);
    await page.getByRole('radio', { name: 'Registradas (1)', exact: true }).click();
    await page.getByText('Página 1 de 1', { exact: true }).waitFor();
    assert.equal(await listing.getByText('Proveedor registrado', { exact: true }).count(), 1);
    await page.getByRole('radio', { name: 'Anuladas (1)', exact: true }).click();
    await listing.getByText('Cancelado internamente', { exact: false }).waitFor();
    assert.match(await listing.innerText(), /Anulación SRI: sin verificar/);
    pass('Tres vistas, conteos, paginación reiniciada, 13 columnas y estados internos separados del SRI');

    await page.getByRole('radio', { name: 'Sin registrar (26)', exact: true }).click();
    await listing.getByRole('button', { name: 'Acciones del comprobante 001-001-000000001', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Ver detalle', exact: true }).click();
    await page.getByRole('dialog').waitFor();
    assert.match(await page.getByRole('dialog').innerText(), /Datos del registro local/);
    await page.getByRole('button', { name: 'Cerrar detalle', exact: true }).click();
    await listing.getByRole('button', { name: 'Acciones del comprobante 001-001-000000001', exact: true }).click();
    assert.equal(await page.getByRole('menuitem', { name: /Ver XML original/ }).getAttribute('data-disabled'), '');
    await page.keyboard.press('Escape');
    const search = page.getByLabel('Proveedor / emisor o documento', { exact: true });
    await search.fill('no existe');
    await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
    await page.getByText('No hay comprobantes recibidos para estos filtros.', { exact: true }).waitFor();
    pass('Menú y detalle accesibles, XML no disponible deshabilitado y estado vacío filtrado');

    await page.getByLabel('Importar XML', { exact: true }).setInputFiles({ name: 'prueba.xml', mimeType: 'application/xml', buffer: Buffer.from('<archivo-de-prueba/>') });
    await page.getByRole('region', { name: 'Resultado de importación' }).waitFor();
    assert.match(await page.getByRole('region', { name: 'Resultado de importación' }).innerText(), /Importados: 1[\s\S]*Pendientes de revisión: 1/);
    importCase = 'duplicate';
    await page.getByLabel('Importar XML', { exact: true }).setInputFiles({ name: 'repetido.xml', mimeType: 'application/xml', buffer: Buffer.from('<archivo-de-prueba/>') });
    await page.getByText('Este documento ya está registrado.', { exact: true }).waitFor();
    assert.match(await page.getByRole('region', { name: 'Resultado de importación' }).innerText(), /Repetidos: 1/);
    assert.equal(await page.getByRole('link', { name: 'Importar TXT en Compras' }).getAttribute('href'), '/facturacion/purchases/txt-import');
    pass('Importación comunica importados/repetidos/revisión y conserva acceso al flujo TXT existente');

    syncCase = 'running';
    await open('/received');
    await page.getByText('En progreso', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Sincronización en proceso', exact: true }).isDisabled(), true);
    syncCase = 'failed';
    await open('/received');
    await page.getByText('TEST_ERROR: Error registrado en el trabajo de prueba.', { exact: true }).waitFor();
    syncCase = 'succeeded';
    await open('/received');
    await page.getByText('Completado', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Sincronizar ahora', exact: true }).isEnabled(), true);
    syncCase = 'setup';
    pass('Estados de sincronización reflejan el trabajo devuelto: en proceso, error y finalizado, sin ejecutar descargas');

    await open('/ats');
    await page.getByRole('radio', { name: 'Revisar', exact: true }).click();
    await page.getByRole('region', { name: 'Diagnósticos tributarios' }).waitFor();
    assert.equal(await page.getByText('2 errores bloqueantes', { exact: true }).count(), 1);
    await page.getByText('Ver detalles técnicos y documentos (3)', { exact: true }).click();
    await page.getByRole('cell', { name: 'ATS_CATALOG_MAPPING_PENDING', exact: true }).waitFor();
    await page.getByRole('cell', { name: 'RECEIVED_WITHHOLDINGS_UNAVAILABLE', exact: true }).waitFor();
    const before = previews.length;
    await Promise.all([page.waitForResponse((response) => response.url().includes('/ats/preview')), page.getByRole('button', { name: 'Generar ATS', exact: true }).click()]);
    await page.getByText('Errores que bloquean el anexo', { exact: true }).waitFor();
    assert.ok(previews.length > before);
    assert.equal(await page.getByRole('button', { name: 'Descargar XML ATS', exact: true }).isDisabled(), true);
    pass('ATS agrupa diagnósticos sin cambiar severidades; Generar solicita y muestra un resultado bloqueado explícito');

    const firstAttempt = previews.length;
    await Promise.all([page.waitForResponse((response) => response.url().includes('/ats/preview')), page.getByRole('button', { name: 'Generar ATS', exact: true }).click()]);
    await page.getByText('Errores que bloquean el anexo', { exact: true }).waitFor();
    assert.ok(previews.length > firstAttempt);
    atsCase = 'pending';
    await Promise.all([page.waitForResponse((response) => response.url().includes('/ats/preview')), page.getByRole('button', { name: 'Generar ATS', exact: true }).click()]);
    await page.getByText('Preparación pendiente de validación', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Descargar XML ATS', exact: true }).isDisabled(), true);
    pass('Generar vuelve a consultar el mismo período y mantiene XML bloqueado cuando el XSD está pendiente');

    atsCase = 'http';
    await page.getByRole('button', { name: 'Generar ATS', exact: true }).click();
    await page.getByText('Error real del servidor de prueba.', { exact: true }).waitFor();
    atsCase = 'body-error';
    await page.getByRole('button', { name: 'Preparar ATS', exact: true }).click();
    await page.getByText('Validación rechazada en respuesta HTTP 200.', { exact: true }).waitFor();
    atsCase = 'blocked';
    await page.getByRole('button', { name: 'Preparar ATS', exact: true }).click();
    await page.getByRole('button', { name: 'Resumen local (PDF)', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Resumen local (PDF)', exact: true }).click();
    await page.getByText('No hay un archivo PDF disponible.', { exact: true }).waitFor();
    pass('Errores HTTP, errores dentro de HTTP 200 y falsas descargas JSON son visibles');

    await page.getByRole('combobox', { name: 'Frecuencia de consulta', exact: true }).selectOption('SEMIANNUAL');
    await page.getByRole('combobox', { name: 'Semestre', exact: true }).selectOption('6');
    await Promise.all([page.waitForResponse((response) => response.url().includes('/ats/preview') && response.url().includes('frequency=SEMIANNUAL')), page.getByRole('button', { name: 'Preparar ATS', exact: true }).click()]);
    assert.ok(previews.some((query) => query.includes('frequency=SEMIANNUAL') && query.includes('month=6')));
    pass('Selector de período conserva el contrato mensual/semestral sin confirmar obligaciones por inferencia');

    await screenshot('sri-ats-desktop.png');
    for (const suffix of ['', '/received', '/ats']) {
      await open(suffix);
      if (suffix === '') await page.getByRole('region', { name: 'Obligaciones tributarias' }).waitFor();
      if (suffix === '/received') await page.getByRole('radio', { name: 'Sin registrar (26)', exact: true }).waitFor();
      if (suffix === '/ats') await page.getByRole('button', { name: 'Generar ATS', exact: true }).waitFor();
      for (const width of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.waitForFunction(() => { const link = document.querySelector('nav [aria-current="page"]')?.getBoundingClientRect(); return link && link.left >= 0 && link.right <= innerWidth; });
        const dimensions = await page.evaluate(() => ({ viewport: innerWidth, content: document.documentElement.scrollWidth }));
        assert.ok(dimensions.content <= dimensions.viewport, `Overflow in ${suffix || 'summary'} at ${width}: ${dimensions.content}`);
        if (width === 390 && suffix === '/received') await screenshot('sri-received-mobile.png');
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.getByRole('radio', { name: 'Revisar', exact: true }).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('radio', { name: 'Generar', exact: true }).getAttribute('aria-checked'), 'true');
    assert.equal(await page.getByRole('radiogroup', { name: 'Etapas del ATS' }).locator(':scope > span').evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
    await page.setViewportSize({ width: 390, height: 900 });
    await screenshot('sri-ats-mobile.png');
    const unexpected = errors.filter((message) => !/400 \(Bad Request\)|500 \(Internal Server Error\)/.test(message));
    assert.deepEqual(unexpected, []);
    assert.ok(!requests.some((request) => request.path === '/api/purchases/sri-sync/run'));
    pass('Responsive, reduced motion, teclado y SSR/hidratación correctos; ninguna sincronización real solicitada');
    console.log(`${count} isolated browser checks passed. All HTTP data are fixtures, not SRI evidence.`);
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
