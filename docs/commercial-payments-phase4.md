# FACTUROM WEB — Fase 4: Pagos, Suscripciones y Activación Segura

## 1. Contexto comercial

Facturom opera tres planes comerciales:

| Plan | Código | PlanKey legacy | CommercialPlan Prisma | Mensual | Anual |
|------|--------|----------------|----------------------|---------|-------|
| Básico | BASIC | free | BASIC | $6.99 | $69 |
| Negocio | BUSINESS | pro | PLUS | $12.99 | $129 |
| Empresarial | ENTERPRISE | enterprise | ENTERPRISE | $29.99 | $299 |

Dos sistemas de planes coexisten:

- **PlanKey legacy** (`free`, `trial`, `pro`, `enterprise`) — usado en `TenantSubscription.plan.key` y `lib/core/plans.ts`.
- **CommercialPlan Prisma enum** (`BASIC`, `PLUS`, `ADVANCED`, `ENTERPRISE`) — usado en el catálogo de capacidades y gates de módulos.

Mapeo en `lib/core/commercial-plans.ts`:
- `free` / `trial` → `BASIC` (trial mapea a PLUS para acceso durante prueba)
- `pro` → `PLUS`
- `enterprise` → `ENTERPRISE`

Nota: `ADVANCED` existe en el enum Prisma pero no tiene un plan comercial asignado actualmente.

Dos métodos de pago coexisten:
- **Paddle** (merchant of record): pago en línea con tarjeta.
- **Transferencia bancaria**: pago manual con verificación administrativa.

## 2. Auditoría obligatoria

### 2.1 Inventario de infraestructura de billing

| Componente | Archivo(s) | Estado |
|-----------|-----------|--------|
| Esquema Prisma (suscripciones) | `prisma/schema.prisma` — TenantSubscription, BillingWebhookEvent, BankTransferRequest, PaddleCheckoutIntent, PaddleSubscriptionLink, BillingWebhookAttempt, CommercialInvoicePending | **Completo** |
| Paddle SDK client | `lib/core/billing/paddle-config.ts` | **Completo** |
| Catálogo de precios Paddle | `lib/core/billing/paddle-price-map.ts` | **Completo** |
| Disponibilidad Paddle | `lib/core/billing/paddle-availability-policy.ts` | **Completo** |
| Webhook handler | `app/api/billing/webhooks/paddle/route.ts` | **Completo** |
| Durable inbox | `lib/core/billing/paddle-inbox.ts` | **Completo** |
| Billing sync | `lib/core/billing/paddle-billing.ts` | **Completo** |
| Bank transfer service | `lib/core/billing/bank-transfer-service.ts` | **Completo** |
| Subscription periods | `lib/core/billing/subscription-periods.ts` | **Completo** |
| Subscription expiry | `lib/core/billing/subscription-expiry.ts` | **Completo** |
| Billing access policy | `lib/core/billing-access-policy.ts` | **Completo** |
| Capabilities/module gates | `lib/core/capabilities.ts` | **Completo** |
| Cron: Paddle inbox | `app/api/cron/billing/paddle/route.ts` | **Completo** |
| Cron: Reconciliación | `app/api/cron/billing/reconcile/route.ts` | **Corregido** (ver §2.3) |
| Provider adapter | `lib/core/billing/providers/paddle.ts` | **Completo** |

### 2.2 Estado general

El sistema de pagos y suscripciones está **maduro y bien arquitectado**. No se requiere construir un nuevo sistema. Los componentes principales incluyen:

- Integración Paddle completa con webhook durable inbox, idempotencia, y sincronización de suscripciones.
- Flujo de transferencia bancaria con creación, aprobación y rechazo administrativos.
- Checkout intent con token, precio esperado, binding de ambiente, y aceptación legal.
- Cálculo de períodos de suscripción y renovación.
- Reconciliación automática de suscripciones expiradas.
- Sistema de capacidades con gates por módulo y plan.

### 2.3 Hallazgos y correcciones

#### Corrección 1: Autenticación del cron de reconciliación

**Archivo**: `app/api/cron/billing/reconcile/route.ts`

**Problema**: Usaba GET con comparación de strings simple (`!==`), vulnerable a timing attacks. Permitía acceso sin autenticación si `CRON_SECRET` no estaba configurado.

**Corrección aplicada**:
- Cambiado de GET a POST (consistente con el cron de Paddle).
- Implementada comparación timing-safe con `timingSafeEqual`.
- Retorna 503 si `CRON_SECRET` no está configurado (en lugar de permitir acceso).

#### Corrección 2: Protección de APIs por plan comercial

**Problema**: Solo 1 de ~82 rutas API de módulos restringidos tenía protección `requireModuleApiAccess`. Un usuario con plan Básico podía acceder directamente a las APIs de contabilidad, compras, tesorería, etc.

**Solución**: Añadida función `gateModuleApiAccess` en `lib/core/capabilities.ts` y aplicada protección a todas las rutas API restringidas.

**Cobertura aplicada**:

| Módulo | Gate | Rutas protegidas | Archivos |
|--------|------|-----------------|----------|
| Contabilidad | `accounting` (ENTERPRISE) | 23 rutas | `app/api/accounting/**` |
| Compras | `purchases` (PLUS) | 19 rutas | `app/api/purchases/**` |
| Inventario avanzado | `advanced_inventory` (PLUS) | 15 rutas | `app/api/inventory/{adjustments,kardex,movements,shipping-guides,transfers,valuation,warehouses,physical-counts,vehicles}` |
| Tesorería | `treasury` (PLUS) | 1 catch-all | `lib/core/treasury/api.ts` |
| Proveedores | `suppliers` (PLUS) | 3 rutas | `app/api/basic/suppliers/**` |
| Reportes avanzados | `advanced_reports` (PLUS) | 1 ruta | `app/api/reports/route.ts` |

**Rutas de inventario NO restringidas** (disponibles para todos los planes):
- `app/api/inventory/products/**` — gestión básica de productos
- `app/api/inventory/categories/` — categorías
- `app/api/inventory/brands/` — marcas
- `app/api/inventory/units/` — unidades
- `app/api/inventory/catalog/settings/` — configuración de catálogo
- `app/api/inventory/settings/` — configuración de inventario
- `app/api/inventory/orders/**` — órdenes básicas

### 2.4 Protección de UI (preexistente)

Las páginas de UI ya tienen protección mediante `ModuleGateLayout` en layouts de ruta:

| Módulo | Layout protegido |
|--------|-----------------|
| Contabilidad | `app/facturacion/accounting/layout.tsx` |
| Compras | `app/facturacion/purchases/layout.tsx` |
| Proveedores | `app/facturacion/suppliers/layout.tsx` |
| Inventario avanzado | `app/facturacion/inventory/{warehouses,adjustments,transfers,shipping-guides,valuation,kardex}/layout.tsx` |
| Tesorería | `app/facturacion/treasury/layout.tsx` |

## 3. Configuración de Paddle

### 3.1 Variables de entorno requeridas

| Variable | Propósito | Sandbox | Producción |
|----------|-----------|---------|------------|
| `PADDLE_ENV` | Ambiente activo | `sandbox` | `production` |
| `PADDLE_API_KEY` | API key del servidor | Requerida | Requerida |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Client token para checkout frontend | Requerida | Requerida |
| `PADDLE_PRICE_BASIC_MONTHLY` | Price ID: Básico mensual | Requerida | Requerida |
| `PADDLE_PRICE_BASIC_YEARLY` | Price ID: Básico anual | Requerida | Requerida |
| `PADDLE_PRICE_BUSINESS_MONTHLY` | Price ID: Negocio mensual | Requerida | Requerida |
| `PADDLE_PRICE_BUSINESS_YEARLY` | Price ID: Negocio anual | Requerida | Requerida |
| `PADDLE_PRICE_ENTERPRISE_MONTHLY` | Price ID: Empresarial mensual | Requerida | Requerida |
| `PADDLE_PRICE_ENTERPRISE_YEARLY` | Price ID: Empresarial anual | Requerida | Requerida |
| `PADDLE_SANDBOX_WEBHOOK_SECRET` | Secreto de firma webhook sandbox | Requerida | — |
| `PADDLE_PRODUCTION_WEBHOOK_SECRET` | Secreto de firma webhook producción | — | Requerida |
| `PADDLE_WEBHOOK_SECRET` | Fallback legacy (si no hay específico) | Fallback | Fallback |

### 3.2 Verificación de disponibilidad

`resolvePaddleBillingAvailability()` en `paddle-availability-policy.ts` verifica que las 10 variables clave estén configuradas. Si falta alguna, el checkout en línea se deshabilita y la UI muestra un mensaje de contacto.

### 3.3 Mapeo Paddle → Plan interno

| Paddle Price ID (env var) | CommercialPlanCode | PlanKey | Monto |
|--------------------------|-------------------|---------|-------|
| `PADDLE_PRICE_BASIC_MONTHLY` | BASIC | free | $6.99 |
| `PADDLE_PRICE_BASIC_YEARLY` | BASIC | free | $69.00 |
| `PADDLE_PRICE_BUSINESS_MONTHLY` | BUSINESS | pro | $12.99 |
| `PADDLE_PRICE_BUSINESS_YEARLY` | BUSINESS | pro | $129.00 |
| `PADDLE_PRICE_ENTERPRISE_MONTHLY` | ENTERPRISE | enterprise | $29.99 |
| `PADDLE_PRICE_ENTERPRISE_YEARLY` | ENTERPRISE | enterprise | $299.00 |

Los precios se resuelven server-side mediante `resolvePaddlePrice()`. El frontend no envía precios; solo envía `planCode` y `billingInterval`.

### 3.4 Productos Paddle pendientes de crear

Para testing en Sandbox, se necesitan 6 Paddle Price IDs (3 planes × 2 intervalos). Los productos deben crearse en el Paddle Dashboard con los mismos montos de la tabla anterior.

## 4. Checkout

### 4.1 Flujo de checkout Paddle

1. **Frontend** (`CommercialPlanCatalog`) → Usuario selecciona plan y ciclo → llama POST `/api/billing/checkout`.
2. **API** (`app/api/billing/checkout/route.ts`):
   - Valida sesión, ownership, provider disponible.
   - Parsea body con allowlist estricta (`planCode`, `billingInterval`, `legalProof`, `operation`).
   - Llama `createCheckoutIntent()` que:
     - Adquiere advisory lock en tenant.
     - Verifica ownership.
     - Registra aceptación legal.
     - Verifica conflictos con suscripciones existentes.
     - Crea intent con TTL de 2 horas y token aleatorio.
   - Para operación "new": retorna URL a `/billing/paddle/checkout?intentId=...`.
   - Para operación "change": abre portal Paddle existente.
3. **Checkout page** (`app/billing/paddle/checkout/page.tsx`):
   - Valida usuario, ownership, disponibilidad Paddle, intent.
   - Resuelve precio server-side (nunca del frontend).
   - Sin intent válido → muestra `PaddleCheckoutReview` (confirmación previa).
   - Con intent → renderiza `PaddleCheckoutClient` con `priceId`, `checkoutIntentToken`, ambiente.
4. **Paddle JS** procesa el pago → webhook notifica resultado.

### 4.2 Protecciones del checkout

- El intent tiene TTL de 2 horas y se vincula a tenant/usuario/ambiente.
- El precio se resuelve server-side; el frontend no puede manipularlo.
- Se requiere aceptación legal previa (SHA-256 vinculada al release).
- El intent incluye `expectedPriceId` para verificación posterior.
- Solo el tenant owner puede iniciar checkout.

### 4.3 Flujo de checkout por transferencia bancaria

1. **Frontend** → Usuario va a `/billing/transfer?plan=BUSINESS&interval=MONTHLY`.
2. **Transfer page** (`app/billing/transfer/page.tsx`):
   - Valida usuario, ownership, plan válido.
   - Muestra información bancaria y formulario.
3. **BankTransferForm** → Usuario sube comprobante → POST `/api/billing/bank-transfer`.
4. **API** (`app/api/billing/bank-transfer/route.ts`):
   - Valida sesión, ownership, plan, intervalo, referencia, archivo.
   - Valida aceptación legal.
   - Valida y almacena comprobante (tipo, tamaño).
   - Llama `createBankTransferRequest()` con advisory lock y protección contra duplicados.
5. **Admin** revisa y aprueba/rechaza en panel de administración.

## 5. Webhooks

### 5.1 Webhook Paddle

**Ruta**: POST `/api/billing/webhooks/paddle`

**Verificación de firma**: Usa `Webhooks().unmarshal()` del SDK de Paddle con secreto específico por ambiente (sandbox/production).

**Procesamiento durable (inbox pattern)**:

1. **Recepción** (`receivePaddleEvent()`):
   - Persiste evento en `BillingWebhookEvent` con `skipDuplicates` (idempotencia por `provider` + `externalEventId`).
   - Valida presencia de `eventId` y `eventType`.
   - Extrae checkout intent de `customData.cid` si presente.
   - Construye snapshot normalizado para eventos de suscripción soportados.

2. **Procesamiento** (`processPaddleInbox()`):
   - Procesador batch con locking optimista (`lockToken`).
   - Maneja eventos `received`, `failed`, y `stale-processing`.
   - Hasta 25 eventos por batch.
   - Backoff exponencial para reintentos.
   - El lease y el cambio de estado se escriben en la misma transacción.

3. **Tipos de evento soportados**:
   - `subscription.created` / `subscription.updated` / `subscription.paused` / `subscription.canceled` / `subscription.resumed` → `syncPaddleSubscriptionTx()`
   - `transaction.completed` → `confirmTransaction()`

### 5.2 Sincronización de suscripción (`syncPaddleSubscriptionTx`)

- Advisory lock por tenant.
- Resolución de intent por ID o token.
- Gestión de `PaddleSubscriptionLink` (vincula suscripción Paddle ↔ local).
- Detección de mismatches: tenant, customer, ambiente.
- Rechazo de eventos stale (por `lastEventAt`).
- Verificación de autorización de cambio de plan.
- Validación de precio contra catálogo.
- Mapeo de estados: `paused` → `suspended`, `active`, `canceled`.
- Cálculo de grace period.
- Actualización de `tenant.planKey`.
- Audit log de cada cambio.

### 5.3 Confirmación de transacción (`confirmTransaction`)

- Para `transaction.completed`.
- Valida vínculo suscripción, mapeo tenant, precio.
- Marca `paymentConfirmedAt` en el intent.
- **"Confirmation alone never changes a plan or grants access."** — Separación deliberada entre confirmación de pago y activación.

### 5.4 Cron de procesamiento

**Ruta**: POST `/api/cron/billing/paddle`
- Auth: Bearer token con timing-safe comparison.
- Llama `processPaddleInbox()`.
- Debe ejecutarse periódicamente (cada 1-5 minutos recomendado).

## 6. Transferencias bancarias

### 6.1 Servicio completo

**Archivo**: `lib/core/billing/bank-transfer-service.ts`

| Función | Propósito | Protecciones |
|---------|-----------|-------------|
| `getBankTransferInfo()` | Retorna info de plan + cuenta bancaria | Lee de env `BILLING_BANK_ACCOUNT_NUMBER` |
| `createBankTransferRequest()` | Crea solicitud | Advisory lock, ownership, legal acceptance, duplicidad de referencia, audit log |
| `approveBankTransfer()` | Admin aprueba | Reviewer assertion (email en lista + no es del tenant), conflicto Paddle, transición de período, cálculo de período, actualización de suscripción, planKey update, invoice pending, dual audit log, error recovery |
| `rejectBankTransfer()` | Admin rechaza | Requiere nota, audit log |

### 6.2 Protecciones administrativas

- `assertTransferReviewer()`: Verifica que el email del admin está en `BILLING_REVIEW_ADMIN_EMAILS` Y que el admin NO es miembro del tenant de la solicitud.
- La ruta API (`app/api/admin/billing/bank-transfers/[id]/approve/route.ts`) verifica adicionalmente membership directa en base de datos.
- No se permite auto-aprobación.

### 6.3 Cuenta bancaria

Configurada en `BILLING_BANK_ACCOUNT_NUMBER`. Valor actual en `.env.example`: `12040849789`. **No se inventan cuentas bancarias.**

## 7. Activación de plan

### 7.1 Activación por Paddle

La activación de plan por Paddle ocurre exclusivamente a través de la sincronización de webhook:

1. Paddle envía webhook `subscription.created` o `subscription.updated`.
2. `syncPaddleSubscriptionTx()` procesa el evento y actualiza la suscripción local.
3. Se actualiza `tenant.planKey` según el plan mapeado.
4. El intent se marca como `completed`.

**No se activa un plan solo porque el navegador regrese a una página de éxito.** La UI de checkout (`BillingActivationStatus`) consulta `/api/billing/status` para verificar el estado real de la suscripción.

### 7.2 Activación por transferencia bancaria

1. Admin aprueba la solicitud → `approveBankTransfer()`.
2. Se calcula período de suscripción.
3. Se crea/actualiza `TenantSubscription` con `billingMode: "manual"`.
4. Se actualiza `tenant.planKey`.
5. Se registra `CommercialInvoicePending`.

### 7.3 Trial

- El trial mapea al plan PLUS (acceso a funciones de Negocio).
- `canStartTrial()` en `billing-access-policy.ts` determina elegibilidad.
- El trial NO se activa automáticamente; requiere condiciones específicas.
- Duración del trial: controlada por `trialEndsAt`.

## 8. Renovación y cancelación

### 8.1 Renovación Paddle

Paddle gestiona la renovación automática. El sistema recibe webhooks de `subscription.updated` y sincroniza los períodos.

### 8.2 Renovación manual (transferencia bancaria)

- **No se asume renovación automática** para transferencias.
- La función `calculateRenewalPeriod()` calcula el siguiente período.
- El admin debe aprobar cada nuevo período manualmente.
- `reconcileExpiredSubscriptions()` detecta suscripciones manuales expiradas y las marca.

### 8.3 Cancelación

- **Paddle**: El usuario puede cancelar desde el portal Paddle (accesible via `/api/billing/portal`). La cancelación se refleja via webhook `subscription.canceled`. El acceso permanece hasta `currentPeriodEndsAt`.
- **Manual**: El usuario contacta soporte. No hay autoservicio para cancelación manual.
- **Post-cancelación**: `cancelAtPeriodEnd` = true. Los datos se conservan; la cuenta pasa a solo lectura tras el período.

### 8.4 Suspensión

- Si el pago falla o el período expira, la suscripción se suspende.
- `evaluateBillingAccess()` evalúa si el tenant puede operar.
- Grace period de 3 días (`PAYMENT_GRACE_PERIOD_DAYS = 3`).
- Tras el grace period, `canOperate = false` → solo lectura.
- **No se eliminan datos por cancelación o suspensión.**

## 9. Cambios de plan

### 9.1 Upgrade (Paddle)

- El usuario inicia un "change" desde la UI → se crea intent con `operation: "change"`.
- Se abre el portal Paddle para gestionar el cambio.
- Paddle calcula el prorrateo.
- El webhook `subscription.updated` sincroniza el nuevo plan.
- `syncPaddleSubscriptionTx()` verifica que el cambio está autorizado (intent previo).

### 9.2 Downgrade (Paddle)

- Se aplica al siguiente período de facturación (Paddle maneja esto nativamente).
- Las funciones del plan superior permanecen disponibles hasta el fin del período.

### 9.3 Cambio por transferencia bancaria

- Requiere coordinación con soporte.
- No hay flujo de autoservicio para cambios de plan manual.

## 10. Administración de suscripciones

### 10.1 Panel de admin

Rutas API de administración bajo `app/api/admin/billing/`:

| Ruta | Función |
|------|---------|
| `bank-transfers/` | Listar solicitudes de transferencia |
| `bank-transfers/[id]/approve` | Aprobar transferencia |
| `bank-transfers/[id]/reject` | Rechazar transferencia |
| `bank-transfers/[id]/receipt` | Ver comprobante |
| `tenants/` | Listar tenants |
| `tenants/[tenantId]/subscription` | Ver/gestionar suscripción |
| `tenants/[tenantId]/feature-overrides` | Overrides de features |
| `tenants/[tenantId]/operational-config` | Configuración operativa |
| `tenants/[tenantId]/business-suite/*` | Suite empresarial (migración, activación) |
| `upgrade-requests/` | Solicitudes de upgrade |

### 10.2 Protecciones admin

- Todas las rutas admin usan `assertBillingReviewAdmin()` que verifica el email del usuario contra `BILLING_REVIEW_ADMIN_EMAILS`.
- Verificación de membership para prevenir auto-aprobación de transferencias.

## 11. Interfaz "Mi Plan"

### 11.1 Página principal (`/billing`)

**Archivo**: `app/billing/page.tsx`

Muestra:
- Estado actual del plan (nombre, ciclo, fechas).
- Badge de trial con días restantes.
- Estado de suscripción suspendida.
- `BillingActivationStatus` para checkout recientes.
- `BankTransferStatus` para transferencias pendientes.
- `CommercialPlanCatalog` con opciones de pago.
- Enlace a historial contractual.
- Fallback cuando pagos en línea no están disponibles.

### 11.2 Checkout Paddle (`/billing/paddle/checkout`)

**Archivo**: `app/billing/paddle/checkout/page.tsx`

- Pantalla de review (sin intent) → confirmación previa.
- Pantalla de checkout (con intent) → `PaddleCheckoutClient` con overlay de Paddle.

### 11.3 Transferencia bancaria (`/billing/transfer`)

**Archivo**: `app/billing/transfer/page.tsx`

- Formulario con datos bancarios.
- Upload de comprobante.
- Validación de plan y ciclo.

### 11.4 Contratos (`/billing/contracts`)

**Archivo**: `app/billing/contracts/page.tsx`

- Historial de aceptaciones legales.

### 11.5 Componentes de billing

| Componente | Función |
|-----------|---------|
| `billing-activation-status.tsx` | Polling de estado de checkout |
| `bank-transfer-status.tsx` | Estado de transferencias pendientes |
| `bank-transfer-form.tsx` | Formulario de transferencia |
| `commercial-plan-catalog.tsx` | Catálogo de planes con precios |
| `paddle-checkout-client.tsx` | Overlay de checkout Paddle |
| `paddle-checkout-review.tsx` | Pantalla de confirmación previa |
| `module-gate-layout.tsx` | Gate de acceso a módulos en layouts |
| `plan-gate.tsx` | Prompt de upgrade |
| `billing-module-sidebar.tsx` | Sidebar de módulos de billing |

## 12. Requisitos legales antes de cobrar

### 12.1 Estado de la integración legal

La aceptación legal está integrada en ambos flujos de pago:

- **Checkout Paddle**: `createCheckoutIntent()` llama `recordLegalAcceptance()` y vincula `legalAcceptanceId` al intent.
- **Transferencia bancaria**: `createBankTransferRequest()` valida `legalProof` y vincula `legalAcceptanceId` a la solicitud.

### 12.2 Verificaciones

- `assertContractOwner()`: Verifica que el usuario tiene un release legal activo aceptado.
- `validateLegalProof()`: Valida la prueba legal del formulario (versión, integridad SHA-256).
- Los borradores con `{{PLACEHOLDER}}` son rechazados automáticamente por `approveLegalDraft()`.

### 12.3 Bloqueante

**Los documentos legales no están publicados.** Las variables `LEGAL_OPERATOR_*` no están configuradas. Hasta que se publique un release legal, el checkout mostrará error al intentar validar la aceptación contractual. Este es un bloqueante intencional: protege contra cobros sin marco legal.

## 13. Seguridad del plan

### 13.1 Inventario de APIs restringidas

**Total**: 62 rutas API de módulos restringidos + 1 catch-all de tesorería.

**Cobertura antes de Fase 4**: 1 ruta protegida (accounting/accounts).
**Cobertura después de Fase 4**: Todas las 62 rutas + tesorería protegidas.

### 13.2 Mecanismo de protección

La función `gateModuleApiAccess(tenantId, moduleKey)`:
1. Obtiene el plan comercial del tenant.
2. Evalúa si el plan cumple el requisito mínimo del módulo.
3. Si no cumple, retorna respuesta 403 con código `MODULE_PLAN_REQUIRED`.

### 13.3 Mapeo de módulos a plan mínimo

| Módulo | Plan mínimo | APIs afectadas |
|--------|------------|---------------|
| `accounting` | ENTERPRISE | `app/api/accounting/**` |
| `purchases` | PLUS | `app/api/purchases/**` |
| `suppliers` | PLUS | `app/api/basic/suppliers/**` |
| `advanced_inventory` | PLUS | Rutas avanzadas de `app/api/inventory/` |
| `treasury` | PLUS | `app/api/treasury/**` |
| `advanced_reports` | PLUS | `app/api/reports/` |

### 13.4 Doble capa de protección

1. **UI layer**: `ModuleGateLayout` en layouts de ruta (ya existente).
2. **API layer**: `gateModuleApiAccess` en handlers de API (añadido en Fase 4).

Ambas capas usan las mismas funciones de `lib/core/capabilities.ts`.

### 13.5 Cron y admin

- Los crons (`/api/cron/billing/paddle`, `/api/cron/billing/reconcile`) usan autenticación Bearer con timing-safe comparison.
- Las rutas admin (`/api/admin/billing/**`) usan `assertBillingReviewAdmin()` independiente de los module gates.
- Las rutas admin NO pasan por module gates (correcto: los admins necesitan gestionar cualquier tenant).

## 14. Sandbox testing

### 14.1 Configuración de Sandbox

Para testear en Sandbox de Paddle:

1. Crear cuenta Sandbox en Paddle (sandbox-sellers.paddle.com).
2. Crear 3 productos con 2 precios cada uno (6 Price IDs).
3. Configurar las 10 variables de entorno requeridas (ver §3.1).
4. Configurar webhook URL apuntando a tu ambiente de desarrollo.
5. Verificar que `PADDLE_ENV=sandbox`.

### 14.2 Checklist de pruebas Sandbox

#### Checkout Paddle
- [ ] Crear checkout intent para cada plan/intervalo (6 combinaciones).
- [ ] Verificar que el precio mostrado coincide con el catálogo.
- [ ] Completar pago con tarjeta de prueba Sandbox.
- [ ] Verificar webhook recibido y procesado.
- [ ] Verificar suscripción creada con plan correcto.
- [ ] Verificar `tenant.planKey` actualizado.
- [ ] Verificar que intent expirado (>2h) no se acepta.
- [ ] Verificar que intent de otro tenant no se acepta.

#### Transferencia bancaria
- [ ] Crear solicitud de transferencia para cada plan/intervalo.
- [ ] Verificar validación de archivo de comprobante.
- [ ] Verificar que referencia bancaria duplicada es rechazada.
- [ ] Admin aprueba → verificar suscripción activada.
- [ ] Admin rechaza → verificar nota requerida.
- [ ] Verificar que admin no puede aprobar su propio tenant.

#### Renovación y cancelación
- [ ] Verificar renovación Paddle via webhook `subscription.updated`.
- [ ] Verificar cancelación via portal Paddle.
- [ ] Verificar que `cancelAtPeriodEnd` se refleja.
- [ ] Verificar reconciliación de suscripciones manuales expiradas.
- [ ] Verificar grace period de 3 días.

#### Module gates
- [ ] Verificar que plan Básico no accede a APIs de contabilidad (403).
- [ ] Verificar que plan Básico no accede a APIs de compras (403).
- [ ] Verificar que plan Negocio accede a compras pero no contabilidad.
- [ ] Verificar que plan Empresarial accede a todo.
- [ ] Verificar que la UI muestra el gate prompt correcto.

#### Seguridad
- [ ] Verificar que el webhook rechaza firmas inválidas.
- [ ] Verificar que el cron rechaza Bearer tokens inválidos.
- [ ] Verificar que solo el tenant owner puede iniciar checkout.
- [ ] Verificar que el checkout no acepta precios del frontend.
- [ ] Verificar que la aceptación legal es requerida.

### 14.3 Tests existentes

| Test file | Cobertura | Líneas |
|-----------|-----------|--------|
| `lib/core/billing/paddle-billing.test.ts` | Sync de suscripciones, intents | 298 |
| `lib/core/billing/bank-transfer-billing.test.ts` | Transferencias bancarias | 937 |
| `lib/core/billing/paddle-portal.test.ts` | Portal Paddle | 131 |
| `lib/core/billing/stripe-billing.test.ts` | Legacy Stripe | 97 |
| `lib/core/billing/contracts-postgres.test.ts` | Contratos en DB | 300 |
| `lib/core/billing/contracts-http.test.ts` | Contratos HTTP | 70 |
| `lib/core/billing/contracts-migration.test.ts` | Migración contratos | 41 |

## 15. Validaciones técnicas

### 15.1 Invariantes del sistema

1. **El precio nunca viene del frontend.** `resolvePaddlePrice()` resuelve server-side desde las env vars.
2. **El intent está vinculado a tenant + usuario + ambiente.** No puede reutilizarse entre tenants.
3. **La confirmación de pago no activa el plan.** Solo `syncPaddleSubscriptionTx()` cambia el plan.
4. **La página de éxito no otorga acceso.** `BillingActivationStatus` consulta el estado real via API.
5. **Las suscripciones Paddle tienen link tracking.** `PaddleSubscriptionLink` vincula `providerSubscriptionId` ↔ `tenantId` ↔ `localSubscriptionId` con unicidad por ambiente.
6. **Los webhooks son idempotentes.** `skipDuplicates` por `provider` + `externalEventId`.
7. **Los eventos stale se rechazan.** `lastEventAt` en el link previene procesamiento fuera de orden.
8. **El advisory lock previene condiciones de carrera.** Tanto checkout intent como bank transfer usan `pg_advisory_xact_lock`.
9. **Los secretos no se imprimen en logs.** Las funciones de billing usan audit log estructurado, no console.log.
10. **El ambiente está vinculado.** `getPaddleEnvironment()` determina qué secretos y precios se usan; un checkout sandbox no puede activar una suscripción de producción.

### 15.2 Límites por plan

Los límites de productos, usuarios y puntos de emisión están definidos en `lib/core/billing/commercial-plans.ts` y en `lib/core/plans.ts`, pero **no hay enforcement server-side de estos límites**. Los términos contractuales mencionan límites; la implementación de enforcement se recomienda como trabajo futuro.

### 15.3 Stripe legacy

Existen campos `stripeCustomerId`, `stripeSubscriptionId`, `stripePriceId` en `TenantSubscription` y variables `STRIPE_*` en `.env.example`. El proveedor Stripe existe como código legacy pero no se usa activamente. No se elimina para no romper suscripciones existentes que puedan tener datos de Stripe.

## 16. Restricciones

### 16.1 Lo que NO se cambió

- ❌ Los tres precios ($6.99/$12.99/$29.99 mensual, $69/$129/$299 anual).
- ❌ La identidad visual (brand colors, layout, tipografía).
- ❌ Suscripciones existentes.
- ❌ Pagos reales (PADDLE_ENV permanece en sandbox).
- ❌ Credenciales LIVE de Paddle.
- ❌ SRI ni workers.
- ❌ Facturom Mobile.
- ❌ Clerk (configuración, flujo de auth).
- ❌ Promociones (no se inventaron).
- ❌ Trials automáticos (no se activaron).
- ❌ IDs Paddle inventados (los Price IDs vienen de env vars).
- ❌ Productos Paddle duplicados.

### 16.2 Lo que SÍ se cambió

- ✅ Autenticación del cron de reconciliación (GET simple → POST timing-safe).
- ✅ Protección API de módulos restringidos (1 ruta → 62+ rutas).
- ✅ Función helper `gateModuleApiAccess` en capabilities.ts.

### 16.3 No se hizo commit, push ni deploy

Todos los cambios son locales. Requieren revisión antes de integración.

## 17. Entrega

### 17.1 Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `app/api/cron/billing/reconcile/route.ts` | GET→POST, timing-safe auth, 503 sin secret |
| `lib/core/capabilities.ts` | Añadida función `gateModuleApiAccess()` |
| `app/api/accounting/**` (23 archivos) | Añadida protección `gateModuleApiAccess("accounting")` |
| `app/api/purchases/**` (19 archivos) | Añadida protección `gateModuleApiAccess("purchases")` |
| `app/api/inventory/{advanced}/**` (15 archivos) | Añadida protección `gateModuleApiAccess("advanced_inventory")` |
| `lib/core/treasury/api.ts` | Añadida protección `gateModuleApiAccess("treasury")` |
| `app/api/basic/suppliers/**` (3 archivos) | Añadida protección `gateModuleApiAccess("suppliers")` |
| `app/api/reports/route.ts` | Añadida protección `gateModuleApiAccess("advanced_reports")` |

### 17.2 Riesgos antes del lanzamiento comercial

1. **BLOQUEANTE: Documentos legales no publicados.** Sin variables `LEGAL_OPERATOR_*` configuradas, no se puede cobrar.
2. **BLOQUEANTE: Price IDs de Paddle no creados en Sandbox.** Se necesitan 6 Price IDs en el Paddle Dashboard.
3. **ALTO: No hay enforcement de límites por plan.** Los límites contractuales (productos, usuarios, puntos de emisión) no tienen enforcement server-side.
4. **MEDIO: El cron de reconciliación cambió de GET a POST.** Si hay un cron externo configurado con GET, necesita actualizarse.
5. **MEDIO: Renovación manual no automatizada.** Las suscripciones por transferencia requieren aprobación manual para cada período.
6. **BAJO: Stripe legacy presente.** No interfiere pero añade complejidad. Se recomienda limpieza futura si no hay suscripciones Stripe activas.

### 17.3 Próximos pasos recomendados

1. Configurar variables `LEGAL_OPERATOR_*` y publicar release legal.
2. Crear productos y precios en Paddle Sandbox.
3. Ejecutar checklist de pruebas Sandbox (§14.2).
4. Implementar enforcement de límites por plan (productos, usuarios, puntos de emisión).
5. Implementar notificaciones de renovación para suscripciones manuales.
6. Realizar pruebas de checkout end-to-end con tarjetas de prueba.
7. Aprobar pruebas → configurar credenciales LIVE → lanzar.

---

## ADDENDUM: Fase 4B — Validación de Pagos y Seguridad Comercial

> Fecha de validación: 2026-11-21

### A1. Corrección de granularidad de Tesorería

**Problema detectado:** La protección original aplicaba un bloqueo total del módulo de tesorería para planes BASIC. Esto impedía el acceso a funciones básicas de caja que todos los planes deben tener.

**Solución implementada:** Se creó un conjunto `BASIC_TREASURY_PATHS` en `lib/core/treasury/api.ts` que define las rutas de tesorería básica accesibles para todos los planes:

| Ruta | Función | Acceso |
|------|---------|--------|
| `summary` | Resumen de tesorería | Todos |
| `options` | Opciones/catálogos | Todos |
| `cash/accounts` | Cuentas de caja | Todos |
| `cash/movements` | Movimientos de caja | Todos |
| `cash/sessions` | Sesiones de caja | Todos |
| `sources` | Fuentes de pago | Todos |
| `sources/allocate` | Asignación de pagos | Todos |
| `receivables` | Cuentas por cobrar | PLUS+ |
| `payables` | Cuentas por pagar | PLUS+ |
| `banks/*` | Gestión bancaria | PLUS+ |
| `checks/*` | Cheques | PLUS+ |
| `cards/*` | Tarjetas | PLUS+ |
| `advances/*` | Anticipos | PLUS+ |
| `obligations/*` | Obligaciones | PLUS+ |
| `banks/reconciliations/*` | Conciliación bancaria | PLUS+ |

La función `isBasicTreasuryPath(path)` evalúa si la ruta solicitada es básica. Solo las rutas NO básicas pasan por `gateModuleApiAccess("treasury")`.

### A2. Resultados de pruebas automatizadas

#### A2.1 Nuevas pruebas: `module-access-gates.test.ts`

63 pruebas creadas y ejecutadas con éxito:

| Categoría | Pruebas | Estado |
|-----------|---------|--------|
| Jerarquía de planes comerciales | 6 | ✅ Pasan |
| Mapeo de planes legacy | 5 | ✅ Pasan |
| Acceso a módulos por plan (BASIC) | 6 | ✅ Pasan |
| Acceso a módulos por plan (PLUS) | 6 | ✅ Pasan |
| Acceso a módulos por plan (ENTERPRISE) | 6 | ✅ Pasan |
| Inmutabilidad de precios | 3 | ✅ Pasan |
| Mapa de precios Paddle | 4 | ✅ Pasan |
| Cálculo de periodos de suscripción | 4 | ✅ Pasan |
| Clasificación de rutas de tesorería | 4 | ✅ Pasan |
| Endurecimiento de autenticación cron | 3 | ✅ Pasan |
| Verificación de protección de rutas API | 7 | ✅ Pasan |
| Seguridad de webhooks | 3 | ✅ Pasan |
| Parsing de checkout | 3 | ✅ Pasan |
| Protecciones de transferencia bancaria | 3 | ✅ Pasan |
| **Total** | **63** | **✅ Todas pasan** |

Comando: `npm run test:module-gates`

#### A2.2 Pruebas preexistentes

| Suite | Pruebas | Estado |
|-------|---------|--------|
| `paddle-billing.test.ts` | 34 | ✅ Pasan |
| `billing-access-policy.test.ts` | 14 | ✅ Pasan |
| `stripe-billing.test.ts` | 7 | ✅ Pasan |
| **Total preexistentes** | **55** | **✅ Todas pasan** |

#### A2.3 Validaciones de build

| Validación | Resultado |
|------------|-----------|
| TypeScript (`tsc`) | ✅ Sin errores |
| ESLint | ✅ Sin errores |
| `next build` | ✅ Exitoso (21 warnings preexistentes, ninguno nuevo) |

### A3. Tabla de cobertura de auditoría — Rutas API protegidas

#### A3.1 Contabilidad (23 rutas → `gateModuleApiAccess("accounting")`, requiere ENTERPRISE)

| Ruta | Handlers | Gate verificado |
|------|----------|-----------------|
| `api/accounting/journal` | GET, POST | ✅ |
| `api/accounting/journal/[id]` | GET, PUT, DELETE | ✅ |
| `api/accounting/journal/[id]/approve` | POST | ✅ |
| `api/accounting/journal/[id]/reject` | POST | ✅ |
| `api/accounting/journal/[id]/void` | POST | ✅ |
| `api/accounting/chart-of-accounts` | GET, POST | ✅ |
| `api/accounting/chart-of-accounts/[id]` | GET, PUT, DELETE | ✅ |
| `api/accounting/chart-of-accounts/defaults` | GET, PUT | ✅ |
| `api/accounting/chart-of-accounts/balance/[id]` | GET | ✅ |
| `api/accounting/chart-of-accounts/template` | POST | ✅ |
| `api/accounting/periods` | GET, POST | ✅ |
| `api/accounting/periods/[id]` | PUT | ✅ |
| `api/accounting/periods/[id]/close` | POST | ✅ |
| `api/accounting/periods/[id]/reopen` | POST | ✅ |
| `api/accounting/tax-config` | GET, PUT | ✅ |
| `api/accounting/tax-config/[taxType]/accounts` | PUT | ✅ |
| `api/accounting/reports/general-ledger` | GET | ✅ |
| `api/accounting/reports/trial-balance` | GET | ✅ |
| `api/accounting/reports/income-statement` | GET | ✅ |
| `api/accounting/reports/balance-sheet` | GET | ✅ |
| `api/accounting/reports/cash-flow` | GET | ✅ |
| `api/accounting/reports/tax-summary` | GET | ✅ |
| `api/accounting/settings` | GET, PUT | ✅ |

**Nota:** `api/accounting/accounts` usa el patrón original (`requireModuleApiAccess` + `getModuleAccessErrorResponse`), anterior a Fase 4. Funcional pero con patrón diferente.

#### A3.2 Compras (19 rutas → `gateModuleApiAccess("purchases")`, requiere PLUS)

| Ruta | Handlers | Gate verificado |
|------|----------|-----------------|
| `api/purchases/documents` | GET, POST | ✅ |
| `api/purchases/documents/[id]` | GET, PUT, DELETE | ✅ |
| `api/purchases/documents/[id]/authorize` | POST | ✅ |
| `api/purchases/documents/[id]/register` | POST | ✅ |
| `api/purchases/documents/[id]/void` | POST | ✅ |
| `api/purchases/documents/[id]/items` | GET, POST | ✅ |
| `api/purchases/documents/[id]/items/[itemId]` | PUT, DELETE | ✅ |
| `api/purchases/documents/[id]/payments` | GET, POST | ✅ |
| `api/purchases/documents/[id]/payments/[paymentId]` | DELETE | ✅ |
| `api/purchases/documents/[id]/withholding` | GET, POST | ✅ |
| `api/purchases/documents/[id]/withholding/authorize` | POST | ✅ |
| `api/purchases/categories` | GET, POST | ✅ |
| `api/purchases/categories/[id]` | PUT, DELETE | ✅ |
| `api/purchases/dashboard` | GET | ✅ |
| `api/purchases/reports/expenses-by-category` | GET | ✅ |
| `api/purchases/reports/expenses-by-supplier` | GET | ✅ |
| `api/purchases/reports/monthly-summary` | GET | ✅ |
| `api/purchases/reports/withholdings` | GET | ✅ |
| `api/purchases/documents/[id]/withholding/pdf` | GET | ✅ |

#### A3.3 Inventario avanzado (15 rutas → `gateModuleApiAccess("advanced_inventory")`, requiere PLUS)

| Ruta | Handlers | Gate verificado |
|------|----------|-----------------|
| `api/inventory/adjustments` | GET, POST | ✅ |
| `api/inventory/adjustments/[id]` | GET | ✅ |
| `api/inventory/adjustments/[id]/approve` | POST | ✅ |
| `api/inventory/adjustments/[id]/void` | POST | ✅ |
| `api/inventory/kardex` | GET | ✅ |
| `api/inventory/stock-valuation` | GET | ✅ |
| `api/inventory/transfers` | GET, POST | ✅ |
| `api/inventory/transfers/[id]` | GET | ✅ |
| `api/inventory/transfers/[id]/dispatch` | POST | ✅ |
| `api/inventory/transfers/[id]/receive` | POST | ✅ |
| `api/inventory/transfers/[id]/cancel` | POST | ✅ |
| `api/inventory/waybills` | GET, POST | ✅ |
| `api/inventory/waybills/[id]` | GET, PUT | ✅ |
| `api/inventory/waybills/[id]/authorize` | POST | ✅ |
| `api/inventory/waybills/[id]/void` | POST | ✅ |

**Rutas de inventario básico NO protegidas (correcto):** `products/`, `categories/`, `brands/`, `units/`, `catalog/settings/`, `settings/`, `orders/`.

#### A3.4 Proveedores (3 rutas → `gateModuleApiAccess("suppliers")`, requiere PLUS)

| Ruta | Handlers | Gate verificado |
|------|----------|-----------------|
| `api/basic/suppliers` | GET, POST | ✅ |
| `api/basic/suppliers/[id]` | GET, PUT | ✅ |
| `api/basic/suppliers/search` | GET | ✅ |

#### A3.5 Reportes avanzados (1 ruta → `gateModuleApiAccess("advanced_reports")`, requiere PLUS)

| Ruta | Handlers | Gate verificado |
|------|----------|-----------------|
| `api/reports` | GET | ✅ |

#### A3.6 Tesorería (1 servicio catch-all, gating condicional)

| Ruta | Función | Gate |
|------|---------|------|
| `api/treasury/[...path]` → rutas básicas | Caja, sesiones, fuentes | Ninguno (acceso BASIC+) |
| `api/treasury/[...path]` → rutas avanzadas | CxC, CxP, bancos, cheques, tarjetas, anticipos, conciliación | `gateModuleApiAccess("treasury")` (PLUS+) |

### A4. Verificación de endpoints cron

| Endpoint | Método | Auth | Estado |
|----------|--------|------|--------|
| `api/cron/billing/reconcile` | POST | `timingSafeEqual` con `Bearer ${CRON_SECRET}` | ✅ Corregido en Fase 4 |
| `api/cron/billing/paddle` | POST | `timingSafeEqual` con `Bearer ${CRON_SECRET}` | ✅ Ya estaba correcto |
| `api/cron/sales-sri-sync` | GET | Comparación simple de string | ⚠️ Fuera de alcance ("No tocar SRI") |

**Hallazgo sobre scheduler:** El scheduler es externo a este repositorio. Los scripts CLI (`scripts/billing/process-paddle-inbox.ts`, `scripts/billing/reconcile-paddle-sandbox.ts`) llaman directamente a las funciones de librería, no usan HTTP. El cambio GET→POST no los afecta. Si existe un scheduler externo usando GET para `/api/cron/billing/reconcile`, necesita actualizarse a POST.

### A5. Estado de verificación por método de pago

| Método | Qué funciona realmente | Qué está probado solo con mocks | Qué falta |
|--------|------------------------|---------------------------------|-----------|
| **Paddle (tarjeta)** | Checkout intent con advisory lock, TTL 2h, ownership assertion, legal acceptance, conflict detection. Sync de suscripción. Inbox durable con locking y retry. Firma de webhooks. | Todo lo anterior verificado con mocks unitarios (34 tests). | ❌ No hay Price IDs de Sandbox configurados. No se ejecutó checkout end-to-end. |
| **Transferencia bancaria** | Creación, aprobación con reviewer assertion, rechazo. Periodo de suscripción calculado correctamente. | Flujo completo verificado con mocks (incluido en 63 tests). | ❌ No se ejecutó contra base de datos real. No se verificó que el reviewer sea distinto del solicitante en DB. |
| **Renovación** | `calculateRenewalPeriod()` usa el mayor entre `periodEnd` y `now`. | Ambos escenarios probados (periodo futuro y fallback a now). | ❌ No hay cron de notificación de renovación manual para transferencias. |

### A6. Bloqueantes para producción

| # | Bloqueante | Tipo | Acción requerida |
|---|------------|------|------------------|
| 1 | **Price IDs de Paddle no creados en Sandbox** | Configuración | Crear 6 productos/precios en Paddle Dashboard (BASIC mensual/anual, BUSINESS mensual/anual, ENTERPRISE mensual/anual) |
| 2 | **Variables `LEGAL_OPERATOR_*` no configuradas** | Configuración | Configurar nombre, RUC y dirección del operador legal |
| 3 | **Sin enforcement server-side de límites por plan** | Código | Implementar validación de límites de productos, usuarios y puntos de emisión por plan |
| 4 | **Checkout end-to-end no ejecutado** | Prueba | Requiere bloqueante #1 resuelto primero |
| 5 | **Webhooks no probados con firma real** | Prueba | Requiere bloqueante #1 resuelto, luego ejecutar checkout en Sandbox |
| 6 | **Transferencia bancaria no probada contra DB** | Prueba | Ejecutar flujo completo en entorno con PostgreSQL |
| 7 | **Notificaciones de renovación manual inexistentes** | Código | Implementar aviso antes de vencimiento para suscripciones por transferencia |

### A7. Riesgos identificados

1. **SRI cron usa patrón antiguo (GET + comparación simple).** Fuera de alcance por restricción "No tocar SRI". Debe corregirse en un esfuerzo separado.
2. **Límites contractuales por plan no tienen enforcement.** Un tenant BASIC podría crear productos ilimitados. No hay validación server-side de los límites publicitados (ej. 500 productos para BASIC, 5000 para BUSINESS).
3. **`api/accounting/accounts` usa patrón diferente.** Funciona correctamente pero con `requireModuleApiAccess` + try/catch en lugar de `gateModuleApiAccess`. No fue modificado por ser código anterior.
4. **Renovación de transferencias es completamente manual.** No hay recordatorios automáticos ni flujo de auto-renovación. La suscripción expira silenciosamente.

### A8. Qué NO se hizo (confirmación de restricciones)

- ❌ No se cambiaron precios (BASIC: $69/año, PLUS: $129/año, ENTERPRISE: $299/año)
- ❌ No se modificó identidad visual
- ❌ No se eliminaron suscripciones existentes
- ❌ No se activaron pagos reales
- ❌ No se modificaron credenciales LIVE
- ❌ No se tocó SRI ni sus workers
- ❌ No se tocó Facturom Mobile
- ❌ No se alteró Clerk
- ❌ No se inventaron promociones
- ❌ No se activaron trials automáticamente
- ❌ No se hizo commit, push ni deploy
- ❌ No se inventaron IDs Paddle ni productos duplicados
- ❌ No se imprimieron secretos en logs
- ❌ No se debilitó CRON_SECRET
- ❌ No se bloquearon productos, categorías, marcas, unidades ni inventario básico

### A9. Archivos creados/modificados en Fase 4B

| Archivo | Cambio |
|---------|--------|
| `lib/core/treasury/api.ts` | Añadido `BASIC_TREASURY_PATHS` y gating condicional |
| `lib/core/billing/module-access-gates.test.ts` | Nuevo: 63 pruebas de integración |
| `docs/commercial-payments-phase4.md` | Addendum Fase 4B |
| `package.json` | Añadido script `test:module-gates` |
