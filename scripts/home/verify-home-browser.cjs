/* eslint-disable @typescript-eslint/no-require-imports -- Isolated browser verification, no production services. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const esbuild = require('esbuild');
const { chromium } = require(process.env.FACTUROM_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const project = path.resolve(__dirname, '../..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'facturom-home-browser-'));
  const screenshots = process.env.FACTUROM_HOME_SCREENSHOTS;
  let server;
  let browser;
  let savedKeys = null;
  let failSave = false;
  const writes = [];
  let passed = 0;
  const pass = (label) => { passed++; console.log(`PASS ${label}`); };
  try {
    // The real page and client components run with local service fixtures.
    // No Prisma connection, login, SRI request or production write is performed.
    const fixtures = {
      '@/lib/security/server-only': '',
      '@/lib/db/prisma': `
        const sum = async () => ({ _sum: { total: 1800, balance: 450 }, _count: 2 });
        const db = {
          userHomePreference: { findUnique: async () => window.__HOME_KEYS ? { shortcutKeys: window.__HOME_KEYS } : null },
          lightweightSale: { findMany: async () => Array.from({ length: 20 }, (_, i) => ({ total: 50 + i * 15, createdAt: new Date(Date.now() - i * 86400000) })), aggregate: sum },
          sriDocument: { findMany: async () => [] },
          purchaseDocument: { aggregate: sum }, treasuryObligation: { aggregate: sum },
        }; export const getPrismaClient = () => db;`,
      '@/lib/core/require-dashboard-session': `export const requireDashboardSession = async () => ({ user: { id: 'fixture-user', name: '131 studio' }, tenant: { id: 'fixture-company', name: '131 studio' } });`,
      '@/lib/core/lightweight-pos': `export const getBasicReports = async () => ({ salesToday: 340, salesMonth: 1800 });`,
      '@/lib/core/sri': 'export const getSriDocuments = async () => [];',
      '@/lib/core/tenant-mode': `export const getTenantModeState = async () => ({ planName: 'Negocio', canAccessAiInvoicing: true });`,
      '@/components/appsolux/layout/dashboard-shell': `
        import React from 'react';
        import { DashboardFrame } from '@/components/appsolux/layout/dashboard-frame';
        import { buildSidebarNavigation } from '@/components/appsolux/layout/sidebar';
        export const referenceProps = { mainClassName: 'px-6 py-8', contentClassName: 'mx-auto max-w-6xl', userName: '131 studio', tenantName: '131 studio', planName: new URLSearchParams(location.search).has('noPlan') ? undefined : 'Negocio', navigationGroups: buildSidebarNavigation({}), clerkActive: true };
        export function DashboardShell(props) { return <DashboardFrame {...referenceProps} {...props} />; }`,
      'next/link': `import React from 'react';export default function Link({ children, ...props }) { return <a {...props}>{children}</a>; }`,
      'next/navigation': `export const usePathname = () => location.pathname; export const useRouter = () => ({ push: () => {}, refresh: () => {} });`,
      '@clerk/nextjs': `import React from 'react';export const UserButton = () => <button aria-label="Acceso de usuario" style={{ borderRadius: '50%', width: 32, height: 32, background: '#000345', color: 'white', fontSize: 11 }}>AS</button>;`,
    };
    await esbuild.build({
      stdin: { sourcefile: 'home-browser-harness.tsx', resolveDir: project, loader: 'tsx', contents: `
        import React from 'react';
        import { renderToString } from 'react-dom/server';
        import { hydrateRoot } from 'react-dom/client';
        import FacturacionPage from '@/app/facturacion/page';
        import { DashboardShell } from '@/components/appsolux/layout/dashboard-shell';
        import { BlobButton } from '@/components/ui/blob-button';
        import '@/app/globals.css';
        (async () => {
          const ui = location.pathname === '/facturacion'
            ? await FacturacionPage()
            : <DashboardShell><h1>Página de referencia fuera de Inicio</h1><BlobButton>Control compartido</BlobButton></DashboardShell>;
          const root = document.getElementById('root');
          root.innerHTML = renderToString(ui); hydrateRoot(root, ui);
        })();
      ` },
      bundle: true, absWorkingDir: project, outfile: path.join(temporary, 'app.js'), jsx: 'automatic',
      define: { 'process.env.NODE_ENV': '"development"' },
      plugins: [{ name: 'local-ui-fixtures', setup(build) {
        build.onResolve({ filter: /.*/ }, ({ path: requested }) => Object.hasOwn(fixtures, requested) ? { path: requested, namespace: 'fixture' } : undefined);
        build.onLoad({ filter: /.*/, namespace: 'fixture' }, ({ path: requested }) => ({ contents: fixtures[requested], loader: 'tsx', resolveDir: project }));
        build.onLoad({ filter: /app\/globals\.css$/ }, async () => {
          const file = path.join(project, 'app/globals.css');
          const result = await require('postcss')([require('@tailwindcss/postcss')()]).process(await fs.readFile(file, 'utf8'), { from: file });
          return { contents: result.css, loader: 'css', resolveDir: project };
        });
      } }],
    });
    server = http.createServer(async (req, res) => {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      if (pathname === '/api/home-preferences' && req.method === 'PUT') {
        let body = ''; for await (const chunk of req) body += chunk;
        const payload = JSON.parse(body); writes.push(payload);
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = failSave ? 500 : 200;
        if (!failSave) savedKeys = payload.keys;
        return res.end(JSON.stringify(failSave ? { error: 'No se pudo guardar en la prueba.' } : { ok: true }));
      }
      if (pathname.startsWith('/api/')) { res.statusCode = 500; return res.end('Unexpected API request'); }
      if (pathname.startsWith('/brand/')) {
        res.setHeader('Content-Type', 'image/png');
        return res.end(await fs.readFile(path.join(project, 'public', pathname)));
      }
      const file = pathname === '/app.js' ? 'app.js' : pathname === '/app.css' ? 'app.css' : null;
      res.setHeader('Content-Type', file === 'app.js' ? 'application/javascript' : file === 'app.css' ? 'text/css' : 'text/html');
      res.end(file ? await fs.readFile(path.join(temporary, file)) : `<!doctype html><html lang="es"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Inicio · prueba visual aislada</title><link rel="stylesheet" href="/app.css"><div id="root"></div><script>window.__HOME_KEYS=${JSON.stringify(savedKeys)}</script><script src="/app.js"></script></html>`);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    browser = await chromium.launch({ headless: true, ...(process.env.FACTUROM_CHROME_PATH ? { executablePath: process.env.FACTUROM_CHROME_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
    await page.addInitScript(() => localStorage.setItem('facturom.cookie-preferences.v1', JSON.stringify({ functional: true })));
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error' && !message.text().includes('status of 500')) errors.push(message.text()); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    const open = async (route = '/facturacion') => { await page.goto(origin + route); await page.getByRole('heading', { level: 1 }).waitFor(); };
    const shot = async (name) => {
      if (!screenshots) return;
      await fs.mkdir(screenshots, { recursive: true });
      await page.waitForTimeout(260);
      await page.screenshot({ path: path.join(screenshots, name), fullPage: !/menu-mobile|editar/.test(name) });
    };
    await open();
    await page.getByRole('heading', { name: 'Hola, 131 studio 👋', exact: true }).waitFor();
    assert.match(await page.locator('header').first().innerText(), /Plan actual:\s+Negocio/);
    assert.equal(await page.getByRole('link', { name: 'Planes', exact: true }).count(), 1);
    assert.equal(await page.getByText('Mi plan', { exact: true }).count(), 0);
    assert.equal(await page.getByText('Cuenta activa', { exact: true }).count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Acceso de usuario' }).count(), 1);
    const sidebarGradient = await page.locator('aside:visible').evaluate((el) => getComputedStyle(el).backgroundImage);
    assert.match(sidebarGradient, /255, 0, 153/);
    pass('Empresa, plan único, avatar y degradado rosado #FF0099');

    const actions = page.getByRole('region', { name: 'Acciones rápidas' });
    const expected = {
      'Documentos': '/facturacion/documents', 'Emitir factura': '/facturacion/pos',
      'Libro diario': '/facturacion/accounting/journal', 'Crear compra': '/facturacion/purchases/new',
      'Productos': '/facturacion/products', 'Clientes': '/facturacion/customers',
      'Caja': '/facturacion/cash', 'Empresa': '/facturacion/settings',
    };
    assert.equal(await actions.getByRole('link').count(), 8);
    for (const [name, href] of Object.entries(expected)) assert.equal(await actions.getByRole('link', { name: new RegExp(`^${name}`) }).getAttribute('href'), href);
    await shot('inicio-desktop.png');
    pass('Las ocho tarjetas conservan sus rutas y descripciones');

    const card = actions.getByRole('link').first();
    const transform = (locator, pseudo) => locator.evaluate((el, pseudo) => getComputedStyle(el, pseudo).transform, pseudo);
    const circles = (host) => host.locator(':scope > span[aria-hidden="true"] > span');
    const editButton = page.getByRole('button', { name: 'Editar accesos rápidos' });
    const timing = (host) => circles(host).evaluateAll((nodes) => nodes.map((el) => {
      const s = getComputedStyle(el);
      return [s.transitionDuration, s.transitionTimingFunction, s.transitionDelay, s.backgroundColor];
    }));
    const referenceTiming = await timing(editButton);
    assert.equal(referenceTiming.length, 4);
    assert.ok(referenceTiming.every((values) => values[0] === '0.42s' && values[3] === 'rgb(255, 0, 153)'));
    const start = await transform(circles(card).first());
    await card.hover(); await page.waitForTimeout(90);
    const midway = await transform(circles(card).first());
    await page.waitForTimeout(550);
    assert.notEqual(start, midway);
    assert.notEqual(midway, await transform(circles(card).first()));
    await shot('inicio-hover.png');
    for (const link of await actions.getByRole('link').all()) {
      assert.deepEqual(await timing(link), referenceTiming, 'each card shares the Edit mechanism, color, timing and stagger');
      await link.hover(); await page.waitForTimeout(600);
      assert.ok(await link.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const blobs = [...el.querySelectorAll(':scope > span[aria-hidden="true"] > span')].map((blob) => blob.getBoundingClientRect());
        return [[rect.left + 3, rect.top + 3], [rect.right - 3, rect.top + 3], [rect.left + 3, rect.bottom - 3], [rect.right - 3, rect.bottom - 3], [rect.x + rect.width / 2, rect.y + rect.height / 2]].every(([x, y]) => blobs.some((b) => ((x - b.x - b.width / 2) / (b.width / 2)) ** 2 + ((y - b.y - b.height / 2) / (b.height / 2)) ** 2 <= 1));
      }), 'the expanded circles cover the whole card');
    }
    await editButton.hover(); await page.waitForTimeout(600);
    await shot('editar-hover.png');
    assert.equal(await editButton.evaluate((el) => getComputedStyle(el).color), 'rgb(0, 3, 69)');
    await page.mouse.move(1400, 100); await page.waitForTimeout(600);
    assert.equal(await transform(circles(card).first()), start, 'fill reverses smoothly to its initial transform');
    pass('Las ocho tarjetas y Editar comparten cuatro blobs, 420ms, escalonado y relleno completo reversible');

    const navigation = page.getByRole('navigation', { name: 'Navegación principal' });
    const people = navigation.getByRole('button', { name: 'Personas', exact: true });
    const menuStart = await transform(people, '::before');
    await people.hover(); await page.waitForTimeout(500);
    assert.notEqual(menuStart, await transform(people, '::before'));
    await people.click();
    assert.equal(await navigation.getByRole('link', { name: 'Clientes', exact: true }).getAttribute('href'), '/facturacion/customers');
    await page.getByRole('button', { name: 'Contraer sidebar' }).last().click();
    await page.waitForTimeout(350);
    assert.equal(await page.locator('aside:visible').evaluate((el) => Math.round(el.getBoundingClientRect().width)), 80);
    assert.equal(await navigation.getByRole('link', { name: 'Panel de control' }).getAttribute('aria-current'), 'page');
    await shot('inicio-sidebar-colapsado.png');
    await page.getByRole('button', { name: 'Expandir sidebar' }).click();
    pass('Menú animado, jerarquía y colapsado de 80px preservados');

    await page.getByRole('tab', { name: 'Accesos directos' }).focus();
    await page.keyboard.press('ArrowRight');
    await page.getByRole('heading', { name: 'Resumen financiero', exact: true }).waitFor();
    assert.equal(await page.getByRole('tab', { name: 'Resumen y estadísticas' }).getAttribute('aria-selected'), 'true');
    await page.getByRole('button', { name: '7 días', exact: true }).click();
    assert.equal(await page.getByRole('button', { name: '7 días', exact: true }).getAttribute('aria-pressed'), 'true');
    await shot('inicio-resumen-desktop.png');
    await page.getByRole('tab', { name: 'Resumen y estadísticas' }).focus();
    await page.keyboard.press('ArrowLeft');
    await actions.waitFor();
    pass('Tabs Radix conservan teclado, aria-selected, paneles y gráfica interactiva');

    const edit = page.getByRole('button', { name: 'Editar accesos rápidos' });
    await edit.click();
    let dialog = page.getByRole('dialog', { name: 'Personalizar accesos' });
    await shot('inicio-editar-accesos.png');
    await dialog.getByRole('button', { name: 'Bajar', exact: true }).first().click();
    failSave = true;
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
    await dialog.getByRole('status').filter({ hasText: 'No se pudo guardar en la prueba.' }).waitFor();
    assert.equal(await dialog.isVisible(), true);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Editar accesos rápidos');
    assert.equal(await edit.evaluate((el) => document.activeElement === el), true);
    failSave = false;
    await edit.click();
    dialog = page.getByRole('dialog', { name: 'Personalizar accesos' });
    assert.match(await dialog.locator('li').first().innerText(), /Emitir factura/);
    await dialog.getByRole('button', { name: 'Bajar', exact: true }).first().click();
    await dialog.getByRole('button', { name: 'Guardar cambios' }).click();
    await page.waitForURL(origin + '/facturacion');
    await page.waitForFunction(() => !document.querySelector('[role="dialog"]'));
    await actions.waitFor();
    assert.match(await actions.getByRole('link').first().innerText(), /Crear compra/);
    assert.equal(writes.length, 2);
    assert.deepEqual(writes[1].keys.slice(0, 2), ['create_purchase', 'emit_invoice']);
    pass('Editar, cancelar por Escape, error y guardado mantienen el contrato real de preferencias con HTTP simulado');

    savedKeys = null;
    await open();
    await page.getByRole('button', { name: 'Contraer sidebar' }).last().click();
    for (const width of [1280, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.waitForTimeout(100);
      const overflow = await page.evaluate(() => ({
        width: innerWidth, scroll: document.documentElement.scrollWidth,
        elements: [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > innerWidth + 1).slice(0, 6).map((el) => `${el.tagName}.${el.className}`),
      }));
      if (overflow.scroll > overflow.width + 1) await shot(`inicio-overflow-${width}.png`);
      assert.ok(overflow.scroll <= overflow.width + 1, `no horizontal overflow at ${width}: ${JSON.stringify(overflow)}`);
      assert.equal(await page.getByRole('link', { name: 'Planes', exact: true }).isVisible(), true);
      assert.equal(await actions.getByRole('link').count(), 8);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await shot('inicio-mobile.png');
    pass('Responsive 320, 390, 768, 1024 y 1280px sin desbordamiento');

    await page.setViewportSize({ width: 320, height: 568 });
    await edit.click();
    dialog = page.getByRole('dialog', { name: 'Personalizar accesos' });
    const dialogBounds = await dialog.boundingBox();
    assert.ok(dialogBounds.x >= 0 && dialogBounds.y >= 0 && dialogBounds.x + dialogBounds.width <= 320 && dialogBounds.y + dialogBounds.height <= 568);
    assert.ok(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1));
    await shot('inicio-editar-mobile.png');
    await page.keyboard.press('Escape');
    await page.setViewportSize({ width: 390, height: 844 });
    pass('Editor de accesos usable a 320×568, sin desbordamiento y con cierre por teclado');

    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const drawer = page.getByRole('dialog', { name: 'Menú de navegación' });
    await drawer.waitFor();
    await drawer.getByRole('button', { name: 'Personas', exact: true }).waitFor();
    await shot('inicio-menu-mobile.png');
    for (let i = 0; i < 18; i++) {
      await page.keyboard.press('Tab');
      assert.ok(await drawer.evaluate((el) => el.contains(document.activeElement)), 'mobile focus remains in the dialog');
    }
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'Abrir menú');
    assert.equal(await page.getByRole('button', { name: 'Abrir menú' }).evaluate((el) => document.activeElement === el), true);
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    await page.setViewportSize({ width: 1440, height: 1024 });
    await drawer.waitFor({ state: 'hidden' });
    pass('Menú móvil con foco contenido, Escape, retorno al botón y cierre al pasar a desktop');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await card.focus();
    assert.equal(await card.evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
    assert.equal(await circles(card).first().evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
    assert.notEqual(await card.evaluate((el) => getComputedStyle(el).outlineStyle), 'none');
    pass('Reduced motion y foco visible en accesos');

    for (const route of ['/facturacion/customers', '/facturacion/sales/new', '/facturacion/sri', '/facturacion/treasury', '/facturacion/products', '/facturacion/accounting/journal', '/facturacion/reports', '/facturacion/settings', '/facturacion/settings/users', '/facturacion']) {
      await open(route);
      assert.equal(await page.locator('aside:visible').evaluate((el) => getComputedStyle(el).backgroundImage), sidebarGradient);
      assert.equal(await page.getByRole('link', { name: 'Planes', exact: true }).count(), 1);
      assert.equal(await page.getByText('Cuenta activa', { exact: true }).count(), 0);
      await page.reload();
      await page.getByRole('heading', { level: 1 }).waitFor();
      assert.equal(await page.locator('aside:visible').evaluate((el) => getComputedStyle(el).backgroundImage), sidebarGradient);
    }
    await open('/facturacion/customers?noPlan=1');
    assert.match(await page.locator('header').first().innerText(), /Sin información/);
    pass('Sidebar y cabecera iguales en diez rutas y sus recargas; plan ausente muestra estado neutral');
    assert.equal(await circles(page.getByRole('button', { name: 'Control compartido' })).first().evaluate((el) => getComputedStyle(el).backgroundColor), 'rgb(201, 0, 119)');
    pass('BlobButton conserva su color y comportamiento predeterminados fuera de Inicio');
    assert.deepEqual(errors, [], 'no hydration, JavaScript or accessibility warnings');
    console.log(`PASS ${passed} browser checks; screenshots: ${screenshots || '(not requested)'}`);
  } finally {
    if (browser) await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
