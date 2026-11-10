# Verificación local de pagos y contratación — 10 de noviembre de 2026

Repositorio: `dressoria/appsolux-dashboard`. Base de trabajo y HEAD conservado: `b3bdda6a6dc157df4de2919ff14502eb8085449b`. Cambios preparados en el árbol de trabajo, sin commit nuevo, push ni despliegue.

## Resultado comprobado

| Validación | Resultado |
| --- | --- |
| `prisma validate` | Correcto |
| `prisma generate` | Correcto, Prisma 6.19.3 |
| `tsc --noEmit` | Correcto |
| `git diff --check` | Correcto |
| `npm run build` | Correcto; 21 avisos de tracing dinámico ya existentes |
| `test:billing` | 55/55 |
| `test:bank-transfer` | 88/88 |
| `test:paddle-portal` | 7/7 |
| `test:billing-contracts`, PostgreSQL real local | 35/35, ninguno omitido |
| `test:billing-http`, servidor local con Clerk habilitado | 6/6, ninguno omitido |
| `test:billing-migration`, base local vacía y esquema de referencia | 1/1 |
| `test:api`, incluidas pruebas PostgreSQL | 43/43 |
| `test:sri-regressions` | 11/11 |
| `test:sri-sales-stability` | 13/13 |
| Navegador desktop/móvil contra build de producción local | Correcto; sin errores de navegador ni desbordamiento horizontal |
| ESLint sobre los 31 archivos fuente nuevos | Correcto, cero errores/avisos |
| ESLint general | 45 errores y 54 avisos; **no es un lint global limpio** |

Total: **259 pruebas automáticas satisfactorias**, más la verificación de navegador. Los fallos deliberadamente inyectados en las pruebas PostgreSQL producen mensajes Prisma de error esperados; las aserciones comprueban rollback e integridad, y las suites terminan sin fallos.

Para distinguir deuda previa de errores nuevos se extrajo una copia limpia de HEAD a un directorio temporal y se ejecutó el mismo ESLint con los mismos node_modules. Esa base tiene 45 errores y 55 avisos. No se modificaron componentes ajenos para corregir esa deuda. El alcance nuevo no introduce errores de lint.

## Evidencia por flujo

- HTTP con `APPSOLUX_AUTH_PROVIDER=clerk`: solicitudes sin firma e incorrectas devolvieron **400**, sin encabezado Location ni redirección. Un evento subscription.activated sintético firmado mediante el SDK llegó al handler, devolvió **200**, quedó persistido y activó solamente la empresa de su intención. Una entrega duplicada conservó un evento y una activación. Las otras rutas billing no están en la excepción de Clerk. Sin configuración local de Clerk, estas rutas privadas siguen siendo interceptadas; no se presenta esa configuración local ausente como una prueba de login real de Clerk.
- PostgreSQL: activación mensual/anual desde active/internal; período legítimo retrasado; rechazo de precio, ciclo, entorno o mapping inválidos; dos tenants y usos repetidos; plan change con evidencia; pausa, mora, recuperación, cancelación inmediata/programada y orden de eventos; cancelación de precio retirado; rollback completo y reintento, lease vencido, agotamiento automático y reintento explícito; ambigüedad histórica de providerSubscriptionId retenida para revisión.
- Transferencias: solicitud válida y duplicados concurrentes; aprobación concurrente y repetida; mensual/anual y renovación sin perder horas; un único registro administrativo pendiente; rollback por fallo de factura, conservación de las dos auditorías históricas y recuperación; revisión de Paddle cobrable, permisos, rechazo y prohibición de autoaprobación.
- Legal: publicación explícita y hashes; borrador/versiones no aceptables, manipulación, representación, aislamiento; triggers de inmutabilidad; evidencia exacta de operación; metadatos técnicos separados y expirables; onboarding sin aceptación, fallo posterior y concurrencia; usuarios previos sin aceptación retroactiva.
- Migración: se generó el esquema de la referencia b3bdda6 en una base local vacía, se insertaron una transferencia ENTERPRISE/YEARLY pendiente con invoiceStatus=pending, sus dos auditorías, una intención Paddle vencida y una suscripción active/internal. Se aplicó el SQL aditivo completo. Se conservaron estados, auditorías y registros; las nuevas FK legales y el entorno permanecieron nulos para los datos previos. No se inventó una aceptación ni se publicó un documento.
- Navegador: dos casillas visibles desmarcadas, cinco enlaces a versiones, botón bloqueado hasta acción afirmativa, rechazo backend de aceptación ausente/hash falsificado, intención local vinculada a evidencia, historial de la propia empresa ignorando tenant inyectado, query checkout=success incapaz de activar, consulta del estado y activación firmada sintética que refresca el plan principal sin otra compra, preferencias opcionales con rechazo que conserva sesión, y diseño desktop/móvil. Todo tráfico externo del navegador estuvo bloqueado; no se abrió el checkout Paddle real ni se generó una transacción Sandbox.

## Reproducir sin producción

Usar exclusivamente PostgreSQL local, con bases dedicadas terminadas en `_test`; la prueba de migración exige una base vacía terminada en `_migration_test` y se niega a reutilizar tablas existentes. No apuntar estos comandos a la VM ni a una copia que no sea de pruebas.

- `FACTUROM_BILLING_TEST_DATABASE_URL=URL_LOCAL npm run test:billing-contracts`. Requiere el esquema migrado localmente. Las pruebas preparan documentos y operator sintéticos exclusivamente dentro de esa base, jamás para publicación real.
- `FACTUROM_BILLING_MIGRATION_TEST_DATABASE_URL=URL_LOCAL_VACIA npm run test:billing-migration`. Lee el esquema del commit de referencia por Git y aplica la migración SQL únicamente en esa base local vacía. No borra tablas para facilitar la repetición: crear otra base de pruebas si hace falta.
- `FACTUROM_BILLING_TEST_BASE_URL=http://127.0.0.1:PUERTO FACTUROM_BILLING_TEST_DATABASE_URL=URL_LOCAL npm run test:billing-http`. Iniciar antes un servidor **local** con Clerk habilitado, keyless deshabilitado, precios sintéticos `pri_basic_monthly`, `pri_basic_yearly`, `pri_business_monthly`, `pri_business_yearly`, `pri_enterprise_monthly`, `pri_enterprise_yearly`, PADDLE_ENV=sandbox y el secreto exclusivamente sintético `synthetic-local-endpoint-secret`. Sin CRON_SECRET para comprobar el 503 cerrado. La suite PostgreSQL prepara los planes/documentos ficticios del entorno aislado. No se necesita API key real de Paddle ni una compra.
- `test:billing-browser` utiliza Playwright ya disponible por `FACTUROM_PLAYWRIGHT_MODULE` y opcionalmente `FACTUROM_BROWSER_EXECUTABLE`. No se agregó una dependencia de producción. Requiere los dos URL locales anteriores, `FACTUROM_BILLING_BROWSER_AUTH_SECRET` igual a un APPSOLUX_AUTH_SECRET **sintético** del servidor local y `FACTUROM_BILLING_BROWSER_WEBHOOK_SECRET` igual al secreto sintético local. El servidor usa provider=current y dev session deshabilitada; PUBLIC_URL debe apuntar a ese localhost, todos los precios y claves son sintéticos, y billing primary provider es paddle. No se navega a la URL de intención que cargaría Paddle. Puede guardar capturas si se configura un directorio local existente en `FACTUROM_BROWSER_ARTIFACT_DIR`. Este perfil verifica UI/API/datos; la excepción de Clerk se verifica en el perfil HTTP independiente.
- Las pruebas PostgreSQL/HTTP se omiten cuando no se proporciona su configuración explícita. Los resultados anteriores corresponden a ejecuciones **habilitadas**, no a pruebas omitidas.

## Operación pendiente y límites

La validación local no acredita todavía el secreto del destino desplegado, el estado real de la compra Sandbox o de la transferencia, envío de avisos legales, corrección tributaria ni disponibilidad de producción. No se consultó Paddle con credenciales reales, no se ejecutaron replays, no se aprobaron transferencias reales y no se modificó la VM. Se ejecutaron únicamente los modos predeterminados sin llamadas/escrituras de los asistentes de recuperación y diagnóstico.

La publicación contractual requiere identidad jurídica real, anexos completos, aprobación profesional ecuatoriana, vigencia y operación verificadas. Los avisos de renovación/entrega de copias, conservación y proveedores reales deben acreditarse antes de publicar; no se presenta la funcionalidad local como certificación de cumplimiento. Hasta publicar un conjunto válido, **nuevas contrataciones quedan cerradas**; el acceso existente y la recuperación legítima de compras anteriores no exigen aceptación retroactiva.

Detalles: `README.md` (borradores, datos faltantes, revisión/publicación/evidencia y fuentes), `PAYMENT-RECOVERY-RUNBOOK.md` (causas, migración, scheduler, Sandbox, transferencia y secuencia de despliegue que no se ejecutó).

## Archivos incluidos

- `.env.example`
- `app/acuerdo-tratamiento-datos/page.tsx`
- `app/api/admin/billing/bank-transfers/[id]/approve/route.ts`
- `app/api/billing/bank-transfer/route.ts`
- `app/api/billing/checkout/route.ts`
- `app/api/billing/status/route.ts`
- `app/api/billing/webhooks/paddle/route.ts`
- `app/api/cron/billing/paddle/route.ts`
- `app/api/legal/current/route.ts`
- `app/api/legal/history/route.ts`
- `app/api/onboarding/register/route.ts`
- `app/billing/contracts/page.tsx`
- `app/billing/paddle/checkout/page.tsx`
- `app/billing/page.tsx`
- `app/layout.tsx`
- `app/onboarding/actions.ts`
- `app/pagos-y-suscripciones/page.tsx`
- `app/politica-de-cookies/page.tsx`
- `app/politica-de-privacidad/page.tsx`
- `app/terminos-y-condiciones/page.tsx`
- `components/appsolux/admin/bank-transfer-admin-table.tsx`
- `components/appsolux/billing/bank-transfer-form.tsx`
- `components/appsolux/billing/billing-activation-status.tsx`
- `components/appsolux/billing/billing-module-sidebar.tsx`
- `components/appsolux/billing/commercial-plan-catalog.tsx`
- `components/appsolux/billing/paddle-checkout-client.tsx`
- `components/appsolux/billing/paddle-checkout-review.tsx`
- `components/appsolux/layout/dashboard-frame.tsx`
- `components/appsolux/legal/contract-acceptance.tsx`
- `components/appsolux/onboarding/onboarding-business-form.tsx`
- `components/public/cookie-preferences.tsx`
- `components/public/legal-document-page.tsx`
- `components/public/public-footer.tsx`
- `docs/legal/PAYMENT-RECOVERY-RUNBOOK.md`
- `docs/legal/README.md`
- `docs/legal/VERIFICATION.md`
- `docs/legal/drafts/cookies.md`
- `docs/legal/drafts/dpa.md`
- `docs/legal/drafts/payments.md`
- `docs/legal/drafts/privacy.md`
- `docs/legal/drafts/terms.md`
- `lib/core/billing/bank-transfer-billing.test.ts`
- `lib/core/billing/bank-transfer-service.ts`
- `lib/core/billing/commercial-invoicing.ts`
- `lib/core/billing/contracts-http.test.ts`
- `lib/core/billing/contracts-migration.test.ts`
- `lib/core/billing/contracts-postgres.test.ts`
- `lib/core/billing/paddle-availability-policy.ts`
- `lib/core/billing/paddle-billing.ts`
- `lib/core/billing/paddle-config.ts`
- `lib/core/billing/paddle-inbox.ts`
- `lib/core/billing/stripe-event-policy.ts`
- `lib/core/billing/subscription-periods.ts`
- `lib/legal/browser-storage.ts`
- `lib/legal/catalog.ts`
- `lib/legal/config.ts`
- `lib/legal/publication.ts`
- `lib/legal/request-evidence.ts`
- `lib/legal/service.ts`
- `lib/onboarding/bootstrap-authenticated-user.ts`
- `lib/onboarding/create-onboarding-request.ts`
- `lib/onboarding/register-account.ts`
- `lib/onboarding/types.ts`
- `lib/security/clerk-independent-routes.ts`
- `package.json`
- `prisma/migrations/20261110000000_billing_reliability_legal/migration.sql`
- `prisma/schema.prisma`
- `proxy.ts`
- `scripts/billing/inspect-bank-transfer.ts`
- `scripts/billing/process-paddle-inbox.ts`
- `scripts/billing/reconcile-paddle-sandbox.ts`
- `scripts/billing/verify-contracts-browser.cjs`
- `scripts/legal-contracts.ts`

## Migraciones anteriores conservadas

Sin cambios en sus archivos ni eliminación:

- `20261031700000_sales_sri_document_outcomes`.
- `20261109000000_add_bank_transfer_requests`.
- `20261109100000_add_paddle_checkout_intents`.
- `20261109180000_add_integration_api_keys`.

No se modificaron archivos de workers SRI, Facturom Mobile ni rutas o servicios de la API pública. Las suites de API y SRI indicadas pasaron. El cambio en el tipo auxiliar de estados de Stripe solo admite el nuevo valor de la enum compartida para mantener TypeScript compatible; no modifica su decisión de negocio.
