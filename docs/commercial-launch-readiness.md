# FACTUROM WEB — Informe de Preparación para Lanzamiento Comercial

> Fecha: 2026-11-21
> Fase: 5A — Cierre de bloqueos para lanzamiento comercial

## 1. Estado de los 7 bloqueos originales (Fase 4B)

### Bloqueo #1: Price IDs de Paddle no creados en Sandbox

| Campo | Detalle |
|-------|---------|
| **Descripción** | No existen productos ni precios configurados en Paddle Dashboard |
| **Riesgo** | CRÍTICO — Sin Price IDs no hay checkout posible |
| **Prioridad** | P0 |
| **Causa** | Configuración externa pendiente |
| **Archivo/servicio** | Paddle Dashboard → `.env` vars `PADDLE_PRICE_*` |
| **Depende de código** | No |
| **Depende de config externa** | Sí — Paddle Dashboard |
| **Depende de aprobación legal** | No |
| **Prueba de resolución** | `getPaddlePriceCatalog()` retorna 6 entradas; checkout end-to-end completa |
| **Estado** | ❌ PENDIENTE — Requiere acción en Paddle Dashboard |

**Acción requerida:** Crear 6 productos/precios en Paddle:

| Producto | Intervalo | Variable de entorno |
|----------|-----------|---------------------|
| BASIC | Mensual ($6.99) | `PADDLE_PRICE_BASIC_MONTHLY` |
| BASIC | Anual ($69) | `PADDLE_PRICE_BASIC_YEARLY` |
| BUSINESS | Mensual ($12.99) | `PADDLE_PRICE_BUSINESS_MONTHLY` |
| BUSINESS | Anual ($129) | `PADDLE_PRICE_BUSINESS_YEARLY` |
| ENTERPRISE | Mensual ($29.99) | `PADDLE_PRICE_ENTERPRISE_MONTHLY` |
| ENTERPRISE | Anual ($299) | `PADDLE_PRICE_ENTERPRISE_YEARLY` |

Variables adicionales requeridas:

| Variable | Propósito |
|----------|-----------|
| `PADDLE_API_KEY` | Clave API server-side |
| `PADDLE_ENV` | `sandbox` o `production` |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | Token para frontend |
| `PADDLE_SANDBOX_WEBHOOK_SECRET` | Firma de webhooks Sandbox |

---

### Bloqueo #2: Variables `LEGAL_OPERATOR_*` no configuradas

| Campo | Detalle |
|-------|---------|
| **Descripción** | Identidad del operador legal ausente en variables de entorno |
| **Riesgo** | CRÍTICO — Sin identidad legal no se pueden publicar documentos legales ni procesar pagos |
| **Prioridad** | P0 |
| **Causa** | Datos empresariales no ingresados |
| **Archivo/servicio** | `lib/legal/config.ts` → `.env` vars `LEGAL_OPERATOR_*` |
| **Depende de código** | No |
| **Depende de config externa** | Sí — datos empresariales reales |
| **Depende de aprobación legal** | Sí — revisión de documentos legales |
| **Prueba de resolución** | `missingLegalOperatorFields()` retorna array vacío |
| **Estado** | ❌ PENDIENTE — Requiere datos empresariales reales |

**Variables requeridas:**

| Variable | Ejemplo | Estado |
|----------|---------|--------|
| `LEGAL_OPERATOR_NAME` | Razón social completa | No configurada |
| `LEGAL_OPERATOR_RUC` | 13 dígitos (RUC válido) | No configurada |
| `LEGAL_OPERATOR_DOMICILE` | Dirección completa | No configurada |
| `LEGAL_OPERATOR_COUNTRY` | Ecuador | No configurada |
| `LEGAL_SUPPORT_EMAIL` | soporte@facturom.com | No configurada |
| `LEGAL_PRIVACY_EMAIL` | privacidad@facturom.com | No configurada |
| `LEGAL_NOTICES_EMAIL` | legal@facturom.com | No configurada |
| `LEGAL_EFFECTIVE_DATE` | Fecha ISO (YYYY-MM-DD) | No configurada |
| `LEGAL_DPO_APPLICABILITY` | `required` o `not-required-reviewed` | No configurada |

---

### Bloqueo #3: Sin enforcement server-side de límites por plan

| Campo | Detalle |
|-------|---------|
| **Descripción** | Los límites contractuales (productos, usuarios, bodegas) no se verificaban al crear recursos |
| **Riesgo** | ALTO — Un tenant BASIC podría crear recursos ilimitados |
| **Prioridad** | P1 |
| **Causa** | Faltaba enforcement en endpoints de creación |
| **Archivo/servicio** | Múltiples endpoints de creación |
| **Depende de código** | Sí |
| **Depende de config externa** | No |
| **Depende de aprobación legal** | No |
| **Prueba de resolución** | Tests #64-#70 en `module-access-gates.test.ts` verifican presencia de gates |
| **Estado** | ✅ RESUELTO |

**Implementación:**

| Archivo | Cambio |
|---------|--------|
| `lib/core/plan-limits.ts` | Nuevo módulo: `checkPlanLimit()`, `planLimitErrorResponse()` |
| `app/api/inventory/products/route.ts` | POST verifica límite de productos antes de crear |
| `lib/core/inventory-import.ts` | `confirmImport()` verifica límite de productos antes de importar (incluye conteo bulk) |
| `app/api/inventory/warehouses/route.ts` | POST verifica límite de bodegas antes de crear |
| `lib/core/memberships.ts` | `createMembership()` verifica límite de usuarios para membresías activas |

**Límites por plan:**

| Recurso | BASIC | BUSINESS | ENTERPRISE |
|---------|-------|----------|------------|
| Productos activos | 200 | 5.000 | 100.000 |
| Usuarios activos | 1 | 5 | 100 |
| Bodegas activas | 1 | 3 | 50 |
| Puntos de emisión | 1 | 3 | 50 |

**Nota:** El enforcement de puntos de emisión requiere modificar rutas bajo `app/api/sri/`, que están fuera de alcance por restricción "No tocar SRI". El módulo `plan-limits.ts` ya incluye el conteo (`sriIssuePoint`) y está listo para integrarse. Se recomienda agregar la verificación en un esfuerzo de SRI separado.

---

### Bloqueo #4: Checkout end-to-end no ejecutado

| Campo | Detalle |
|-------|---------|
| **Descripción** | No se ha completado un checkout real en Paddle Sandbox |
| **Riesgo** | ALTO — No se puede confirmar que el flujo completo funciona |
| **Prioridad** | P1 (depende de Bloqueo #1) |
| **Causa** | No hay Price IDs de Sandbox configurados |
| **Archivo/servicio** | `app/api/billing/checkout/route.ts` → Paddle Dashboard |
| **Depende de código** | No |
| **Depende de config externa** | Sí — Bloqueo #1 |
| **Depende de aprobación legal** | No |
| **Prueba de resolución** | Checkout completo con tarjeta de prueba; suscripción creada; plan activado |
| **Estado** | ❌ PENDIENTE DE PRUEBA REAL EN SANDBOX |

**Flujo verificado por código (mocks):**
1. ✅ Owner-only access
2. ✅ Legal proof required
3. ✅ Server-side price resolution (no frontend prices accepted)
4. ✅ Advisory lock prevents duplicate intents
5. ✅ 2h TTL on checkout intent
6. ✅ Conflict detection for active subscriptions

---

### Bloqueo #5: Webhooks no probados con firma real

| Campo | Detalle |
|-------|---------|
| **Descripción** | Verificación de firma de webhooks Paddle no probada con firma real |
| **Riesgo** | ALTO — Podría rechazar webhooks legítimos o aceptar forjados |
| **Prioridad** | P1 (depende de Bloqueo #1) |
| **Causa** | Requiere Sandbox activo con webhook endpoint accesible |
| **Archivo/servicio** | `app/api/billing/webhooks/paddle/route.ts` |
| **Depende de código** | No |
| **Depende de config externa** | Sí — Bloqueos #1 y Sandbox webhook URL |
| **Depende de aprobación legal** | No |
| **Prueba de resolución** | Webhook recibido y procesado tras checkout Sandbox |
| **Estado** | ❌ PENDIENTE DE PRUEBA REAL EN SANDBOX |

**Verificado por código:**
- ✅ Firma verificada con `PADDLE_SANDBOX_WEBHOOK_SECRET`
- ✅ Inbox durable con locking y retry
- ✅ Idempotencia por evento ID
- ✅ Sync de suscripción con validación de ownership

---

### Bloqueo #6: Transferencia bancaria no probada contra DB

| Campo | Detalle |
|-------|---------|
| **Descripción** | Flujo de transferencia no ejecutado contra base de datos real |
| **Riesgo** | MEDIO — La lógica está cubierta por mocks pero no validada en DB |
| **Prioridad** | P2 |
| **Causa** | Requiere entorno con PostgreSQL |
| **Archivo/servicio** | `lib/core/billing/bank-transfer-service.ts` |
| **Depende de código** | No |
| **Depende de config externa** | Sí — Base de datos |
| **Depende de aprobación legal** | No |
| **Prueba de resolución** | Flujo completo: crear → aprobar → verificar suscripción activa |
| **Estado** | ❌ PENDIENTE — Requiere DB para prueba de integración |

**Verificado por código:**
- ✅ Owner-only access
- ✅ Legal proof + file validation
- ✅ Reviewer must be different from requester (assertion en approve)
- ✅ Period calculation tested

---

### Bloqueo #7: Notificaciones de renovación manual inexistentes

| Campo | Detalle |
|-------|---------|
| **Descripción** | No existía sistema para avisar a tenants con suscripción manual próxima a vencer |
| **Riesgo** | ALTO — Suscripciones expiran silenciosamente |
| **Prioridad** | P1 |
| **Causa** | Funcionalidad no implementada |
| **Archivo/servicio** | Nuevo: `lib/core/billing/renewal-reminders.ts` |
| **Depende de código** | Sí |
| **Depende de config externa** | No |
| **Depende de aprobación legal** | No |
| **Prueba de resolución** | Test #71-#72 en `module-access-gates.test.ts`; cron endpoint verificado |
| **Estado** | ✅ RESUELTO |

**Implementación:**

| Archivo | Cambio |
|---------|--------|
| `lib/core/billing/renewal-reminders.ts` | Nuevo: `generateRenewalReminders()`, `getActiveRenewalReminders()` |
| `app/api/cron/billing/renewal-reminders/route.ts` | Nuevo cron endpoint POST con timing-safe auth |

**Ventanas de aviso:** 7 días, 3 días, 1 día antes del vencimiento.

**Deduplicación:** No envía el mismo aviso dos veces en 24 horas para la misma suscripción y ventana.

**Nota:** Los recordatorios se almacenan como `AuditLog` con acción `subscription_renewal_reminder`. El dashboard puede consultarlos mediante `getActiveRenewalReminders(tenantId)` para mostrar banners de renovación. No se implementó envío de email porque no hay infraestructura de email en este repositorio.

---

## 2. Resumen de bloqueos

| # | Bloqueo | Estado | Tipo |
|---|---------|--------|------|
| 1 | Price IDs Paddle | ❌ Pendiente | Configuración externa |
| 2 | Variables LEGAL_OPERATOR_* | ❌ Pendiente | Configuración externa + legal |
| 3 | Enforcement de límites por plan | ✅ Resuelto | Código |
| 4 | Checkout end-to-end | ❌ Pendiente | Prueba (depende de #1) |
| 5 | Webhooks con firma real | ❌ Pendiente | Prueba (depende de #1) |
| 6 | Transferencia contra DB | ❌ Pendiente | Prueba (requiere DB) |
| 7 | Notificaciones de renovación | ✅ Resuelto | Código |

**Resueltos:** 2 de 7
**Pendientes:** 5 de 7 (todos requieren configuración o infraestructura externa)

---

## 3. Archivos modificados en Fase 5A

| Archivo | Cambio |
|---------|--------|
| `lib/core/plan-limits.ts` | **Nuevo** — Módulo de enforcement de límites por plan |
| `lib/core/billing/renewal-reminders.ts` | **Nuevo** — Generador de recordatorios de renovación |
| `app/api/cron/billing/renewal-reminders/route.ts` | **Nuevo** — Cron endpoint para recordatorios |
| `app/api/inventory/products/route.ts` | Añadido enforcement de límite de productos |
| `app/api/inventory/warehouses/route.ts` | Añadido enforcement de límite de bodegas |
| `lib/core/memberships.ts` | Añadido enforcement de límite de usuarios |
| `lib/core/inventory-import.ts` | Añadido enforcement de límite de productos en importación bulk |
| `lib/core/billing/module-access-gates.test.ts` | 9 nuevas pruebas (63 → 72) |
| `docs/commercial-launch-readiness.md` | **Nuevo** — Este documento |

---

## 4. Evidencia de pruebas

### 4.1 Tests automatizados

| Suite | Pruebas | Estado |
|-------|---------|--------|
| `module-access-gates.test.ts` | 72 | ✅ Todas pasan |
| `paddle-billing.test.ts` | 34 | ✅ Todas pasan |
| `billing-access-policy.test.ts` | 14 | ✅ Todas pasan |
| `stripe-billing.test.ts` | 7 | ✅ Todas pasan |
| **Total** | **127** | **✅ Todas pasan** |

### 4.2 Validaciones de build

| Validación | Resultado |
|------------|-----------|
| TypeScript (`tsc --noEmit`) | ✅ Sin errores |
| ESLint | ✅ Sin errores en archivos modificados |
| `next build` | ✅ Exitoso |

---

## 5. Estado real de Paddle Sandbox

- `PADDLE_API_KEY`: **No configurada**
- `PADDLE_ENV`: **No configurada**
- `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN`: **No configurada**
- `PADDLE_SANDBOX_WEBHOOK_SECRET`: **No configurada**
- `PADDLE_PRICE_*` (6 variables): **Ninguna configurada**

**Resultado:** `getPaddleBillingAvailability()` retorna `{ configured: false }`. El checkout está correctamente bloqueado por el provider check (`BILLING_PROVIDER_UNAVAILABLE`, HTTP 503).

**PENDIENTE DE PRUEBA REAL EN SANDBOX.**

---

## 6. Estado real de transferencias bancarias

- El flujo de creación, aprobación y rechazo está implementado con mocks.
- Owner-only, legal proof, file validation, receipt storage: todo verificado por código.
- **No ejecutado contra base de datos real.**
- La función `getBankTransferInfo()` retorna información de cuenta bancaria: **verificar que la cuenta configurada es correcta antes de producción.**

---

## 7. Estado legal

- 6 documentos legales con borradores en `docs/legal-drafts/`.
- 6 rutas públicas activas (terms, privacy, cookies, payments, dpa, refunds).
- Diseño visual rediseñado con brand colors.
- `missingLegalOperatorFields()` valida completitud.
- `approveLegalDraft()` requiere revisión de 11 áreas legales.
- `publishLegalRelease()` usa advisory lock y verifica identidad.
- **9 variables de entorno sin configurar** (ver Bloqueo #2).
- **Borradores contienen placeholders `{{PLACEHOLDER}}`** — el sistema `publishLegalRelease()` los rechazaría.

---

## 8. Cobertura de permisos

### Módulos protegidos (62+ rutas)

| Módulo | Rutas | Plan mínimo | Verificado |
|--------|-------|-------------|------------|
| Contabilidad | 23 | ENTERPRISE | ✅ |
| Compras | 19 | PLUS | ✅ |
| Inventario avanzado | 15 | PLUS | ✅ |
| Proveedores | 3 | PLUS | ✅ |
| Reportes avanzados | 1 | PLUS | ✅ |
| Tesorería (condicional) | 1 catch-all | PLUS (avanzado) / Todos (básico) | ✅ |

### Límites por plan (nuevo en Fase 5A)

| Recurso | Endpoint protegido | Verificado |
|---------|--------------------|------------|
| Productos | `api/inventory/products` POST | ✅ |
| Productos (import) | `confirmImport()` | ✅ |
| Bodegas | `api/inventory/warehouses` POST | ✅ |
| Usuarios | `createMembership()` | ✅ |
| Puntos de emisión | `api/sri/establishments` POST | ⚠️ Pendiente (restricción SRI) |

### Inventario básico NO protegido (correcto)

`products/`, `categories/`, `brands/`, `units/`, `catalog/settings/`, `settings/`, `orders/`.

---

## 9. Recorrido de registro y activación

| Paso | Estado | Verificación |
|------|--------|-------------|
| Registro Clerk | ✅ Funcional | Existente, no modificado |
| Creación de empresa | ✅ Funcional | Existente, no modificado |
| Elección de plan | ✅ UI implementada | Pricing page + plan catalog |
| Checkout Paddle | ⚠️ Código listo, sin Sandbox | Owner-only, legal proof, server-side prices |
| Transferencia bancaria | ⚠️ Código listo, sin DB test | Owner-only, legal proof, receipt upload |
| Verificación de pago | ⚠️ Webhook + inbox listo, sin firma real | Idempotente, durable, timing-safe |
| Activación de suscripción | ✅ Código verificado | `syncPaddleSubscriptionTx()`, advisory lock |
| Resolución de permisos | ✅ Verificado (72 tests) | Module gates + plan limits |
| Acceso a módulo contratado | ✅ Verificado | `gateModuleApiAccess()` en 62+ rutas |

**Protecciones contra ataques verificadas:**
- ❌ No se puede activar plan desde frontend (server-side only)
- ❌ No se puede asignar otro tenant (ownership assertion)
- ❌ No se puede acceder a módulos superiores sin pagar (module gates)
- ❌ No se puede pagar dos veces por el mismo evento (advisory lock + conflict detection)
- ❌ No se pierden datos al vencer (suspensión, no eliminación)

---

## 10. Condiciones pendientes para producción

### Obligatorias (P0)

1. Configurar `LEGAL_OPERATOR_*` con datos empresariales reales.
2. Revisión jurídica de los 6 documentos legales.
3. Publicar release legal (`prepareLegalDraft` → `approveLegalDraft` → `publishLegalRelease`).
4. Crear 6 productos/precios en Paddle Sandbox.
5. Configurar variables de entorno de Paddle.
6. Ejecutar checkout end-to-end en Sandbox.
7. Verificar webhooks con firma real.

### Recomendadas (P1)

8. Ejecutar transferencia bancaria completa contra DB real.
9. Agregar enforcement de puntos de emisión en rutas SRI.
10. Configurar scheduler externo para:
    - `POST /api/cron/billing/reconcile` (reconciliación de suscripciones expiradas)
    - `POST /api/cron/billing/paddle` (procesamiento de inbox Paddle)
    - `POST /api/cron/billing/renewal-reminders` (recordatorios de renovación)
11. Implementar envío de email para recordatorios de renovación (actualmente solo AuditLog).

### Deseables (P2)

12. Corregir cron SRI a timing-safe auth (actualmente GET + string comparison).
13. Limpieza de código Stripe legacy si no hay suscripciones activas.
14. Unificar patrón de `api/accounting/accounts` al nuevo `gateModuleApiAccess`.

---

## Clasificación del lanzamiento

# APTO SOLO PARA PRUEBAS

**Justificación:**

Todo el código de pagos, suscripciones, permisos y límites está implementado y verificado por pruebas automatizadas (127 tests, TypeScript limpio, build exitoso). Sin embargo, existen 5 bloqueos sin resolver que requieren configuración externa, datos empresariales y pruebas de integración real:

1. No hay productos/precios en Paddle → no hay checkout posible.
2. No hay identidad legal → no se pueden publicar documentos legales.
3. No se ejecutó checkout end-to-end → no se puede confirmar el flujo completo.
4. No se verificaron webhooks con firma real → riesgo de rechazo/aceptación incorrecta.
5. No se probó transferencia contra DB → flujo no validado en entorno real.

**Para avanzar a APTO PARA PRODUCCIÓN:** completar las condiciones P0 (ítems 1-7 de la sección anterior).

---

## Restricciones cumplidas

- ❌ No se cambiaron precios (BASIC: $69/año, BUSINESS: $129/año, ENTERPRISE: $299/año)
- ❌ No se cambió identidad visual
- ❌ No se modificó SRI ni workers
- ❌ No se modificó Facturom Mobile
- ❌ No se alteró Clerk Production
- ❌ No se activaron pagos Live
- ❌ No se ejecutaron migraciones en producción
- ❌ No se hizo commit, push ni deploy
