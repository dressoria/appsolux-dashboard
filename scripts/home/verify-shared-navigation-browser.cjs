/* eslint-disable @typescript-eslint/no-require-imports -- Real App Router in a temporary, isolated fixture application. */
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.FACTUROM_PLAYWRIGHT_MODULE || 'playwright');

async function main() {
  const project = path.resolve(__dirname, '../..');
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'facturom-next-navigation-'));
  const captures = process.env.FACTUROM_HOME_SCREENSHOTS;
  const logPath = process.env.FACTUROM_NAVIGATION_LOG || path.join(os.tmpdir(), 'facturom-shared-navigation-next.log');
  let child;
  let browser;
  let logs = '';
  let passed = 0;
  const pass = (message) => { passed++; console.log(`PASS ${message}`); };
  try {
    // Production UI and DashboardShell run through real Next.js SSR, hydration
    // and client navigation. Only auth/data providers and internal page bodies
    // are fixtures: no production DB, login, credentials or write endpoints.
    const write = async (name, contents) => {
      const file = path.join(temporary, name);
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, contents);
    };
    await fs.symlink(path.join(project, 'node_modules'), path.join(temporary, 'node_modules'));
    await fs.symlink(path.join(project, 'public'), path.join(temporary, 'public'));
    await write('package.json', JSON.stringify({ name: 'facturom-navigation-fixture', private: true }));
    const fixtures = {
      '@/lib/security/server-only': '',
      '@/lib/core/require-dashboard-session': `export async function requireDashboardSession() { return { user: { id: 'fixture-user', name: '131 studio' }, tenant: { id: 'fixture-company', name: '131 studio' } }; }`,
      '@/lib/auth/provider': 'export const isClerkAuth = () => true;',
      '@/lib/core/tenant-mode': `export async function getTenantModeState() { return { planName: 'Plan inferido: no mostrar', canAccessAiInvoicing: true }; }`,
      '@/lib/core/plans': `import { headers } from 'next/headers'; export async function getTenantSubscription(tenantId) { if (tenantId !== 'fixture-company') throw new Error('Unexpected tenant'); const h = await headers(); if (h.get('x-fixture-no-plan') === '1') return null; if (h.get('x-fixture-no-plan') === 'error') throw new Error('Fixture subscription lookup unavailable'); return { plan: { name: 'Negocio' } }; }`,
      '@/lib/core/lightweight-pos': 'export const getBasicReports = async () => ({ salesToday: 340, salesMonth: 1800 });',
      '@/lib/core/sri': 'export const getSriDocuments = async () => [];',
      '@/lib/db/prisma': `
        const sum = async () => ({ _sum: { total: 1800, balance: 450 }, _count: 2 });
        const db = { userHomePreference: { findUnique: async () => null }, lightweightSale: { findMany: async () => [], aggregate: sum }, sriDocument: { findMany: async () => [] }, purchaseDocument: { aggregate: sum }, treasuryObligation: { aggregate: sum } };
        export const getPrismaClient = () => db;`,
      '@clerk/nextjs': `'use client'; export function UserButton() { return <button aria-label="Acceso de usuario" style={{ width:32, height:32, borderRadius:'50%', background:'#000345', color:'white', fontSize:11 }}>AS</button>; }`,
    };
    const aliases = {};
    for (const [index, [name, source]] of Object.entries(fixtures).entries()) {
      const file = `fixtures/provider-${index}.jsx`;
      await write(file, source);
      aliases[`${name}$`] = path.join(temporary, file);
    }
    aliases['@'] = project;
    await write('next.config.js', `module.exports = { devIndicators: false, experimental: { externalDir: true }, webpack(config) { config.resolve.alias = { ...config.resolve.alias, ...${JSON.stringify(aliases)} }; return config; } };`);
    await write('postcss.config.js', `module.exports = { plugins: { '@tailwindcss/postcss': { base: ${JSON.stringify(project)} } } };`);
    await write('app/layout.jsx', `import ${JSON.stringify(path.join(project, 'app/globals.css'))};export default function Layout({ children }) { return <html lang="es"><body>{children}</body></html>; }`);
    await write('app/facturacion/page.jsx', `export { default } from ${JSON.stringify(path.join(project, 'app/facturacion/page.tsx'))};`);
    await write('app/facturacion/[...section]/page.jsx', `
      import { DashboardShell } from '@/components/appsolux/layout/dashboard-shell';
      export default async function Page({ params }) {
        const { section } = await params;
        const labels = { customers:'Clientes · Personas', 'sales/new':'Facturar · Transacciones', sri:'Centro tributario SRI', treasury:'Tesorería', products:'Productos · Inventario', 'accounting/journal':'Libro diario · Contabilidad', reports:'Reportes', settings:'Empresa', 'settings/users':'Usuarios · Seguridad' };
        return <DashboardShell><h1 className="text-2xl font-semibold">{labels[section.join('/')] || section.join('/')}</h1><p className="mt-3 text-sm text-slate-500">Contenido de prueba: se verifica el layout compartido sin cargar ni modificar datos empresariales.</p></DashboardShell>;
      }`);
    const probe = net.createServer();
    await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
    const port = probe.address().port;
    await new Promise((resolve) => probe.close(resolve));
    const origin = `http://127.0.0.1:${port}`;
    child = spawn(process.execPath, [path.join(project, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(port)], {
      cwd: temporary, env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (chunk) => { logs += chunk; });
    child.stderr.on('data', (chunk) => { logs += chunk; });
    const deadline = Date.now() + 90000;
    while (!logs.includes('Ready in')) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Next startup failed; see ${logPath}`);
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    browser = await chromium.launch({ headless: true, ...(process.env.FACTUROM_CHROME_PATH ? { executablePath: process.env.FACTUROM_CHROME_PATH } : {}) });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1024 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem('facturom.cookie-preferences.v1', JSON.stringify({ functional: true }));
      window.__navigationDocument = Math.random();
    });
    await page.goto(origin + '/facturacion');
    await page.getByRole('heading', { name: 'Hola, 131 studio 👋', exact: true }).waitFor();
    const gradient = await page.locator('aside:visible').evaluate((el) => getComputedStyle(el).backgroundImage);
    assert.match(gradient, /255, 0, 153/);
    const checkChrome = async () => {
      assert.equal(await page.locator('aside:visible').evaluate((el) => getComputedStyle(el).backgroundImage), gradient);
      assert.equal(await page.getByRole('link', { name: 'Planes', exact: true }).count(), 1);
      assert.equal(await page.getByRole('link', { name: 'Mi plan', exact: true }).count(), 0);
      assert.equal(await page.getByText('Cuenta activa', { exact: true }).count(), 0);
      assert.match(await page.locator('header').first().innerText(), /Plan actual:\s+Negocio/);
    };
    const shot = async (name) => {
      if (!captures) return;
      await fs.mkdir(captures, { recursive: true });
      await page.waitForTimeout(250);
      await page.screenshot({ path: path.join(captures, name), fullPage: false });
    };
    await checkChrome();
    await shot('next-inicio.png');
    const nav = () => page.getByRole('navigation', { name: 'Navegación principal' });
    const expand = async (title) => {
      const button = nav().getByRole('button', { name: title, exact: true });
      if (await button.getAttribute('aria-expanded') !== 'true') await button.click();
    };
    await expand('Personas');
    await checkChrome();
    await shot('next-personas.png');
    pass('Inicio y Personas muestran el mismo degradado con el DashboardShell real');
    const beforeDocument = await page.evaluate(() => window.__navigationDocument);
    await nav().getByRole('link', { name: 'Clientes', exact: true }).click();
    await page.waitForURL(origin + '/facturacion/customers');
    await page.getByRole('heading', { name: 'Clientes · Personas', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => window.__navigationDocument), beforeDocument, 'real Next Link uses client navigation');
    await checkChrome();
    await shot('next-clientes.png');
    await page.reload(); await page.getByRole('heading', { name: 'Clientes · Personas', exact: true }).waitFor(); await checkChrome();
    pass('Next Link navega a Clientes sin recargar el documento y conserva el gradiente al refrescar');
    for (const [group, submenu, link, route] of [
      ['Transacciones', 'Ventas', 'Facturar', '/facturacion/sales/new'],
      ['SRI', null, 'Resumen tributario', '/facturacion/sri'],
    ]) {
      await expand(group); if (submenu) await expand(submenu);
      await nav().getByRole('link', { name: link, exact: true }).first().click();
      await page.waitForURL(origin + route); await page.getByRole('heading', { level: 1 }).waitFor(); await checkChrome();
      await page.reload(); await page.getByRole('heading', { level: 1 }).waitFor(); await checkChrome();
    }
    pass('Transacciones y SRI mantienen sidebar y cabecera al navegar y recargar');
    for (const route of ['/facturacion/treasury', '/facturacion/products', '/facturacion/accounting/journal', '/facturacion/reports', '/facturacion/settings', '/facturacion/settings/users', '/facturacion']) {
      await page.goto(origin + route); await page.getByRole('heading', { level: 1 }).waitFor(); await checkChrome();
      await page.reload(); await page.getByRole('heading', { level: 1 }).waitFor(); await checkChrome();
    }
    pass('Tesorería, Inventario, Contabilidad, Reportes, Empresa, Seguridad e Inicio: mismas superficies tras recarga');
    await page.getByRole('button', { name: 'Contraer sidebar' }).last().click();
    await page.waitForTimeout(350); await checkChrome();
    assert.equal(await page.locator('aside:visible').evaluate((el) => el.getBoundingClientRect().width), 80);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    let drawer = page.getByRole('dialog', { name: 'Menú de navegación' });
    await drawer.waitFor(); assert.equal(await drawer.evaluate((el) => getComputedStyle(el).backgroundImage), gradient);
    await shot('next-menu-mobile.png');
    const mobilePeople = drawer.getByRole('button', { name: 'Personas', exact: true });
    if (await mobilePeople.getAttribute('aria-expanded') !== 'true') await mobilePeople.click();
    await drawer.getByRole('link', { name: 'Clientes', exact: true }).click();
    await page.waitForURL(origin + '/facturacion/customers'); await drawer.waitFor({ state: 'hidden' });
    await page.reload(); await page.getByRole('heading', { level: 1 }).waitFor();
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    drawer = page.getByRole('dialog', { name: 'Menú de navegación' });
    await drawer.waitFor(); assert.equal(await drawer.evaluate((el) => getComputedStyle(el).backgroundImage), gradient);
    await page.keyboard.press('Escape');
    pass('Colapsado, navegación móvil, cierre del drawer y recarga conservan el diseño');
    for (const state of ['1', 'error']) {
      await page.setExtraHTTPHeaders({ 'x-fixture-no-plan': state });
      await page.reload(); await page.getByRole('heading', { level: 1 }).waitFor();
      assert.match(await page.locator('header').first().innerText(), /Sin información/);
      assert.equal(await page.getByText('Negocio', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Plan inferido: no mostrar', { exact: true }).count(), 0);
    }
    pass('DashboardShell muestra únicamente el plan de la suscripción; ausencia o error quedan neutrales');
    assert.deepEqual(errors, []);
    console.log(`PASS ${passed} App Router checks; providers and internal content use isolated fixtures.`);
  } finally {
    if (browser) await browser.close();
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      await new Promise((resolve) => { child.once('exit', resolve); setTimeout(resolve, 5000); });
    }
    await fs.writeFile(logPath, logs);
    await fs.rm(temporary, { recursive: true, force: true });
  }
}
main().catch((error) => { console.error(error); process.exitCode = 1; });
