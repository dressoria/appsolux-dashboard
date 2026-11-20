/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS verification script. */
/* Isolated browser harness: real components + SSR/hydration, mocked HTTP and navigation.
 * Requires Playwright (or FACTUROM_PLAYWRIGHT_MODULE); never connects to a real tenant/DB.
 */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.FACTUROM_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'facturom-customer-ui-'));
  const project = path.resolve(__dirname, '../..');
  const checks = [];
    const pass = (message) => { checks.push(message); console.log(`PASS ${message}`); };
  let server;
  let browser;
  try {
    await esbuild.build({
      stdin: {
        contents: `
          import React from 'react';
          import { renderToString } from 'react-dom/server';
          import { hydrateRoot } from 'react-dom/client';
          import { CustomerEditor } from '@/components/appsolux/customers/customer-editor';
          import '@/app/globals.css';
          const ui = <CustomerEditor existingGroups={['VIP']} />;
          document.getElementById('root').innerHTML = renderToString(ui);
          hydrateRoot(document.getElementById('root'), ui);
        `,
        resolveDir: project, loader: 'tsx', sourcefile: 'customer-browser-harness.tsx',
      },
      absWorkingDir: project, bundle: true, outfile: path.join(temporary, 'app.js'),
      jsx: 'automatic', define: { 'process.env.NODE_ENV': '"development"' },
      plugins: [{
        name: 'isolate-next',
        setup(build) {
          build.onResolve({ filter: /^next\/(navigation|link)$/ }, (args) => ({ path: args.path, namespace: 'next-test' }));
          build.onLoad({ filter: /.*/, namespace: 'next-test' }, (args) => ({
            contents: args.path.endsWith('navigation')
              ? `export const useRouter = () => ({ push: (url) => window.__customerNavigation = url, refresh() {} });`
              : `import React from 'react'; export default function Link(props) { return React.createElement('a', props); }`,
            loader: 'js', resolveDir: project,
          }));
          // Compile the actual Tailwind sources using the project's installed compiler.
          build.onLoad({ filter: /app\/globals\.css$/ }, async () => {
            const postcss = require('postcss');
            const tailwind = require('@tailwindcss/postcss');
            const file = path.join(project, 'app/globals.css');
            const result = await postcss([tailwind()]).process(await fs.readFile(file, 'utf8'), { from: file });
            return { contents: result.css, loader: 'css', resolveDir: project };
          });
        },
      }],
    });
    server = http.createServer(async (req, res) => {
      const name = req.url === '/app.js' ? 'app.js' : req.url === '/app.css' ? 'app.css' : null;
      res.setHeader('Content-Type', name === 'app.js' ? 'application/javascript' : name === 'app.css' ? 'text/css' : 'text/html');
      res.end(name ? await fs.readFile(path.join(temporary, name)) : '<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/app.css"><title>Customer editor test</title><div id="root" style="max-width:1152px;margin:auto;padding:24px"></div><script src="/app.js"></script></html>');
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({
      ...(process.env.FACTUROM_CHROME_PATH ? { executablePath: process.env.FACTUROM_CHROME_PATH } : {}),
      headless: true,
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    const payloads = [];
    let failSave = false;
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/basic/customers') {
        payloads.push(route.request().postDataJSON());
        if (failSave) return route.fulfill({ status: 400, json: { message: 'Este código interno ya existe.' } });
        return route.fulfill({ json: { ok: true, customer: { id: 'customer-browser' } } });
      }
      if (url.pathname === '/api/sri/taxpayer-lookup') return route.fulfill({ json: { found: true, legalName: 'CLIENTE SRI', tradeName: 'Comercial SRI', address: 'Dirección SRI', source: 'test' } });
      return route.fulfill({ json: { members: [] } });
    });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const open = async () => { await page.goto(origin); await page.getByRole('radio', { name: 'Completo' }).waitFor(); };
    const full = page.getByRole('radio', { name: 'Completo' });
    const quick = page.getByRole('radio', { name: 'Rápido' });
    const save = page.getByRole('button', { name: 'Guardar cliente' });
    const field = (name) => page.getByLabel(name, { exact: true });
    const indicator = () => page.getByRole('radiogroup').locator(':scope > span');
    const status = page.getByRole('switch', { name: 'Cliente activo', exact: true });

    await open();
    assert.equal(await full.getAttribute('aria-checked'), 'true');
    assert.ok((await full.boundingBox()).x < (await quick.boundingBox()).x);
    pass('Completo inicial y a la izquierda');
    const initialX = (await indicator().boundingBox()).x;
    // Pause the real CSS transition at a known time to avoid timing flakes under build load.
    await indicator().evaluate((el) => {
      el.addEventListener('transitionrun', () => {
        const animation = el.getAnimations()[0];
        if (animation) {
          animation.pause();
          animation.currentTime = 100;
          window.__indicatorPaused = true;
        }
      }, { once: true });
    });
    await full.focus();
    await full.press('ArrowRight');
    assert.equal(await quick.getAttribute('aria-checked'), 'true');
    assert.equal(await quick.evaluate((el) => el === document.activeElement), true);
    await page.waitForFunction(() => window.__indicatorPaused);
    const intermediateX = (await indicator().boundingBox()).x;
    await indicator().evaluate((el) => el.getAnimations().forEach((animation) => animation.finish()));
    const finalX = (await indicator().boundingBox()).x;
    assert.ok(intermediateX > initialX && intermediateX < finalX, `Indicator positions: ${initialX}, ${intermediateX}, ${finalX}`);
    pass('Selector accesible con desplazamiento físico de la píldora');
    await field('Nombre del cliente o razón social *').fill('Solo nombre');
    await save.focus();
    await save.press('Enter');
    await page.waitForFunction(() => window.__customerNavigation);
    assert.equal(payloads.at(-1).name, 'Solo nombre');
    assert.equal(payloads.at(-1).identificationType, null);
    assert.equal(payloads.at(-1).identification, '');
    assert.equal(payloads.at(-1).phone, '');
    assert.equal(payloads.at(-1).isActive, true);
    pass('Creación rápida solo con nombre y envío mediante teclado');

    await open();
    await field('Razón social / Nombres completos').fill('Cliente persistente');
    await field('Nombre comercial').fill('Comercial persistente');
    await field('Número de identificación').fill('1790016919001');
    await field('Tipo de cliente').selectOption('Mayorista');
    await field('Correos electrónicos: principal').fill('cliente@example.com');
    await field('Teléfonos: principal').fill('+593 99 123 4567');
    await field('Dirección').fill('Av. de prueba');
    await field('Código interno de cliente (opcional)').fill('CLI-007');
    await field('Observación interna (opcional)').fill('Nota privada compartida');
    await status.focus();
    await status.press('Space');
    assert.equal(await status.getAttribute('aria-checked'), 'false');
    await quick.click();
    assert.equal(await field('Nombre del cliente o razón social *').inputValue(), 'Cliente persistente');
    assert.equal(await field('Teléfono (opcional)').inputValue(), '+593 99 123 4567');
    assert.equal(await field('Dirección (opcional)').inputValue(), 'Av. de prueba');
    assert.equal(await field('Observación interna (opcional)').inputValue(), 'Nota privada compartida');
    assert.equal(await status.getAttribute('aria-checked'), 'false');
    await full.click();
    assert.equal(await field('Tipo de cliente').inputValue(), 'Mayorista');
    assert.equal(await field('Nombre comercial').inputValue(), 'Comercial persistente');
    assert.equal(await field('Correos electrónicos: principal').inputValue(), 'cliente@example.com');
    assert.equal(await field('Número de identificación').inputValue(), '1790016919001');
    pass('Alternar modos conserva campos comunes, clasificación y contactos');
    await quick.click();
    await save.click();
    await page.waitForFunction(() => window.__customerNavigation);
    assert.equal(payloads.at(-1).notes, 'Nota privada compartida');
    assert.equal(payloads.at(-1).isActive, false);
    assert.equal(payloads.at(-1).internalCode, 'CLI-007');
    assert.equal(payloads.at(-1).customerType, 'Mayorista');
    assert.equal(payloads.at(-1).identification, '1790016919001');
    pass('Guardar desde rápido conserva también los datos escritos en completo');

    await open();
    await field('Número de identificación').fill('1790016919001');
    await page.getByRole('button', { name: 'Consultar datos tributarios' }).click();
    await page.waitForFunction(() => document.querySelector('input[aria-label="Número de identificación"]')?.value === '1790016919001');
    await field('Razón social / Nombres completos').waitFor();
    await page.getByText('✓ Datos del SRI cargados', { exact: true }).waitFor();
    assert.equal(await field('Razón social / Nombres completos').inputValue(), 'CLIENTE SRI');
    await field('Observación interna (opcional)').fill('Nota completa');
    await save.click();
    await page.waitForFunction(() => window.__customerNavigation);
    assert.equal(payloads.at(-1).notes, 'Nota completa');
    assert.equal(payloads.at(-1).taxDataSource, 'test');
    pass('Completo mantiene la consulta tributaria y envía la nota interna');

    await open();
    await quick.click();
    await field('Nombre del cliente o razón social *').fill('Prueba error');
    failSave = true;
    await save.click();
    await page.getByRole('alert').waitFor();
    assert.equal(await field('Nombre del cliente o razón social *').inputValue(), 'Prueba error');
    assert.equal(await save.isEnabled(), true);
    failSave = false;
    // Expected HTTP 400 logs are excluded from hydration/JS error assertions.
    const unexpectedErrors = errors.filter((error) => !error.includes('400 (Bad Request)'));
    pass('Error del servidor conserva el formulario y permite reintentar');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await quick.focus();
    await quick.press('Home');
    assert.equal(await full.getAttribute('aria-checked'), 'true');
    assert.equal(await indicator().evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
    const circle = page.getByRole('switch', { name: 'Cliente activo', exact: true }).locator('span');
    assert.equal(await circle.evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
    const blob = save.locator('span[aria-hidden] > span').first();
    assert.equal(await blob.evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
    pass('Reduced motion desactiva desplazamientos y transiciones');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await save.focus();
    await page.waitForTimeout(550);
    const focusedTransform = await blob.evaluate((el) => getComputedStyle(el).transform);
    await full.focus();
    await page.mouse.move(0, 0);
    await page.waitForTimeout(550);
    const restingTransform = await blob.evaluate((el) => getComputedStyle(el).transform);
    assert.notEqual(focusedTransform, restingTransform);
    pass('Blob button mueve círculos al enfocar y los devuelve al salir');

    const screenshots = process.env.FACTUROM_CUSTOMER_SCREENSHOTS;
    if (screenshots) {
      await fs.mkdir(screenshots, { recursive: true });
      await open();
      await page.screenshot({ path: path.join(screenshots, 'customer-full-desktop.png'), fullPage: true });
    }
    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      for (const mode of [full, quick]) {
        await mode.click();
        await page.waitForTimeout(350);
        const dimensions = await page.evaluate(() => ({ content: document.documentElement.scrollWidth, viewport: window.innerWidth }));
        assert.ok(dimensions.content <= dimensions.viewport, `Horizontal overflow at ${width}px`);
      }
    }
    if (screenshots) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.screenshot({ path: path.join(screenshots, 'customer-quick-mobile.png'), fullPage: true });
    }
    pass('Sin desbordamiento a 320, 390, 768 y 1280 px en ambos modos');
    assert.deepEqual(unexpectedErrors, []);
    pass('SSR/hidratación sin errores de React ni excepciones de JavaScript');
    console.log(`${checks.length} browser checks passed (HTTP and navigation mocked).`);
  } finally {
    await browser?.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
