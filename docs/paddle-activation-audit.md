# Activación automática de plan después del pago — Auditoría

> Fecha: 2026-11-22

## 1. ¿El pago de Paddle activa actualmente el plan?

**Sí.** La cadena de activación está completa y funcional. No se necesitaron correcciones de código.

Flujo completo:

1. Owner selecciona plan → `POST /api/billing/checkout` crea `PaddleCheckoutIntent` con `expectedPriceId` resuelto en servidor
2. Paddle Checkout se abre con `customData: { cid: token }` del intent
3. Paddle envía webhook → `POST /api/billing/webhooks/paddle` verifica firma y persiste evento a inbox
4. `processPaddleInbox()` ejecuta `syncPaddleSubscriptionTx()` que:
   - Resuelve tenant desde checkout intent
   - Valida Price ID contra el esperado en el intent
   - Actualiza `TenantSubscription` (planId, status, billingMode, fechas, providerRefs)
   - **Actualiza `Tenant.planKey`** al plan contratado
   - Registra `subscription_activated` en AuditLog
5. Los módulos reflejan inmediatamente el plan nuevo vía `getTenantCommercialPlan()` → `checkModuleAccess()`

## 2. ¿Qué componente realiza la activación?

| Componente | Archivo | Responsabilidad |
|-----------|---------|----------------|
| Webhook handler | `app/api/billing/webhooks/paddle/route.ts` | Verifica firma Paddle, persiste evento durable, dispara procesamiento best-effort |
| Inbox receiver | `lib/core/billing/paddle-inbox.ts` → `receivePaddleEvent()` | Extrae intent, construye snapshot, almacena en `BillingWebhookEvent` |
| Inbox processor | `lib/core/billing/paddle-inbox.ts` → `processPaddleInbox()` | Lock de lease, orquesta procesamiento con rollback atómico |
| Sync engine | `lib/core/billing/paddle-billing.ts` → `syncPaddleSubscriptionTx()` | Lógica principal: resolución de tenant, validación de precio, actualización de suscripción y plan |
| Cron backup | `app/api/cron/billing/paddle/route.ts` | Procesador programado con auth timing-safe (respaldo si `after()` falla) |
| Status poller | `components/appsolux/billing/billing-activation-status.tsx` | Consulta `/api/billing/status` cada 8s, ejecuta `router.refresh()` al activar |

## 3. ¿Se determina el plan por el Price ID?

**Sí.** El Price ID es la única fuente de verdad para resolver el plan:

```
Price ID del webhook
  → resolvePaddlePriceId() en paddle-price-map.ts
    → { planCode: "BUSINESS", planKey: "pro", billingInterval: "YEARLY" }
      → Plan record en DB por planKey
        → TenantSubscription.planId actualizado
          → Tenant.planKey actualizado
```

Mapeo verificado:

| Env variable | Plan Code | Plan Key | CommercialPlan | Precio |
|-------------|-----------|----------|----------------|--------|
| `PADDLE_PRICE_BASIC_MONTHLY` | BASIC | free | BASIC | $6.99/mes |
| `PADDLE_PRICE_BASIC_YEARLY` | BASIC | free | BASIC | $69/año |
| `PADDLE_PRICE_BUSINESS_MONTHLY` | BUSINESS | pro | PLUS | $12.99/mes |
| `PADDLE_PRICE_BUSINESS_YEARLY` | BUSINESS | pro | PLUS | $129/año |
| `PADDLE_PRICE_ENTERPRISE_MONTHLY` | ENTERPRISE | enterprise | ENTERPRISE | $29.99/mes |
| `PADDLE_PRICE_ENTERPRISE_YEARLY` | ENTERPRISE | enterprise | ENTERPRISE | $299/año |

Protecciones:
- El frontend solo envía `planCode` + `billingInterval`; el Price ID se resuelve en el servidor
- Si el Price ID del webhook no coincide con `intent.expectedPriceId`, se rechaza con `PADDLE_PRICE_MISMATCH`
- Price IDs desconocidos producen `PADDLE_PRICE_UNRECOGNIZED`

## 4. ¿Se actualiza correctamente la base de datos?

**Sí.** Dentro de una transacción con advisory lock:

| Tabla | Campo | Valor |
|-------|-------|-------|
| `TenantSubscription` | `planId` | ID del Plan correspondiente al `planKey` |
| `TenantSubscription` | `status` | `"active"` |
| `TenantSubscription` | `billingMode` | `"paddle"` |
| `TenantSubscription` | `billingInterval` | `"MONTHLY"` o `"YEARLY"` |
| `TenantSubscription` | `providerSubscriptionId` | ID de suscripción Paddle |
| `TenantSubscription` | `providerCustomerId` | ID de cliente Paddle |
| `TenantSubscription` | `providerPriceId` | Price ID exacto del webhook |
| `TenantSubscription` | `currentPeriodStartsAt` | Inicio del período de Paddle |
| `TenantSubscription` | `currentPeriodEndsAt` | Fin del período de Paddle |
| `TenantSubscription` | `providerLastEventAt` | Timestamp del evento (protección contra out-of-order) |
| `Tenant` | `planKey` | `"free"`, `"pro"` o `"enterprise"` |
| `PaddleSubscriptionLink` | — | Enlace durable entre suscripción Paddle y tenant |
| `PaddleCheckoutIntent` | `status` | `"completed"`, con `completedAt` y `paddleSubscriptionId` |
| `AuditLog` | `action` | `"subscription_activated"` |

## 5. ¿Los permisos cambian automáticamente?

**Sí.** La cadena es inmediata sin caché entre requests:

```
Tenant.planKey actualizado por syncPaddleSubscriptionTx
  → getTenantSubscription() lee TenantSubscription.plan.key (cache per-request via React cache())
    → mapLegacyPlanKeyToCommercialPlan():
        "free" → BASIC (rank 0)
        "pro" → PLUS (rank 1)
        "enterprise" → ENTERPRISE (rank 3)
      → checkModuleAccess(commercialPlan, moduleKey)
```

| Plan | Facturación, POS, clientes, productos, caja, inventario básico | Compras, proveedores, inventario avanzado, tesorería | Contabilidad |
|------|---|---|---|
| BASIC | ✅ | ❌ | ❌ |
| PLUS (Negocio) | ✅ | ✅ | ❌ |
| ENTERPRISE | ✅ | ✅ | ✅ |

Documentos electrónicos ilimitados en todos los planes (`effectiveFeatures.sri = true`).

Módulos bloqueados muestran mensaje con el plan requerido (visibles pero no operables).

Tesorería tiene gating condicional: rutas básicas de caja abiertas a todos, rutas avanzadas requieren PLUS+.

## 6. ¿Qué sucede cuando vence la suscripción?

| Escenario | Mecanismo | Resultado |
|-----------|-----------|-----------|
| Paddle no cobra renovación | Paddle envía `subscription.past_due` | Status → `past_due`, grace period de 3 días |
| Grace period vence | `evaluateBillingAccess()` detecta `grace_expired` | `canOperate: false`, operaciones bloqueadas |
| Paddle cancela suscripción | Paddle envía `subscription.canceled` | Status → `canceled`, read-only |
| Paddle pausa suscripción | Paddle envía `subscription.paused` | Status → `suspended` |
| Pago recuperado | Paddle envía `subscription.updated` con status `active` | Status → `active`, grace limpiado |
| Transferencia manual vence | `reconcileExpiredSubscriptions()` (cron) | Status → `suspended` |
| Cancelación programada | `scheduledChange.action === "cancel"` | `cancelAtPeriodEnd: true`, acceso continúa hasta fin del período |

En todos los casos: datos nunca se eliminan, el tenant mantiene acceso de lectura.

## 7. ¿Qué archivos fue necesario corregir?

**Ninguno.** La cadena de activación estaba completa. Se realizó únicamente esta auditoría.

Archivos revisados (sin modificaciones):

| Archivo | Verificación |
|---------|-------------|
| `app/api/billing/webhooks/paddle/route.ts` | Firma, receipt durable, wake-up |
| `lib/core/billing/paddle-inbox.ts` | Receive + process con leasing/retry |
| `lib/core/billing/paddle-billing.ts` | Sync completo con validaciones |
| `lib/core/billing/paddle-price-map.ts` | Catálogo desde env vars |
| `lib/core/billing/paddle-config.ts` | Secreto por entorno, cliente SDK |
| `lib/core/capabilities.ts` | Module gates con rank |
| `lib/core/plans.ts` | Plan limits y state |
| `lib/core/commercial-plans.ts` | CommercialPlan mapping |
| `lib/core/billing/commercial-plans.ts` | Catálogo comercial con precios |
| `lib/core/billing-access-policy.ts` | Grace period, trial, suspension |
| `lib/core/billing/subscription-expiry.ts` | Evaluación + reconciliación |
| `lib/core/tenant-operational-access.ts` | Access enforcement |
| `lib/core/billing/providers/paddle.ts` | Provider registration |
| `app/api/billing/checkout/route.ts` | Intent creation flow |
| `app/api/billing/status/route.ts` | Status polling for UI |
| `app/api/cron/billing/paddle/route.ts` | Cron backup processor |
| `app/billing/page.tsx` | Mi Plan UI |
| `app/billing/paddle/checkout/page.tsx` | Checkout page |
| `components/appsolux/billing/paddle-checkout-client.tsx` | Paddle JS integration |
| `components/appsolux/billing/billing-activation-status.tsx` | Status polling component |

## 8. ¿Qué pruebas reales y automatizadas pasaron?

| Suite | Tests | Runner |
|-------|-------|--------|
| `test:billing` (Paddle + Stripe + providers) | 55/55 ✅ | `node --test` |
| `test:module-gates` (module access + plan limits + renewal) | 72/72 ✅ | `tsx --test` |
| `test:paddle-portal` (portal session management) | 7/7 ✅ | `tsx --test` |
| `test:bank-transfer` (security + activation + contracts) | 88/88 ✅ | `tsx --test` |
| **Total** | **222/222 ✅** | — |
| TypeScript (`tsc --noEmit`) | ✅ Sin errores | — |
| `next build` | ✅ Exitoso | — |

### Tests de integración PostgreSQL (en `contracts-postgres.test.ts`)

Estos tests verifican contra una base de datos real cuando `FACTUROM_BILLING_TEST_DATABASE_URL` está configurado:

- Activación MONTHLY y YEARLY: `internal` → `paddle` con `planKey` correcto
- Idempotencia: duplicados y procesadores concurrentes activan exactamente una vez
- Timing: compra retrasada usa `createdAt` firmado; intent expirado falla
- Precio incorrecto, token desconocido, entorno incorrecto: nunca activan
- Aislamiento de tenants: suscripción de un tenant no puede activar otro
- `transaction.completed` confirma pago sin otorgar acceso
- Cancelación, past_due, pausa, reactivación: flujo completo de lifecycle
- Procesamiento fallido: se preserva, retry exitoso
- Cambio de plan: requiere nueva aceptación legal y acepta el precio contratado
- Lease expirado de worker: recuperación sin pérdida de evento
- Retry explícito después de agotamiento automático
- Ambigüedad histórica: nunca vincula incorrectamente

### Tests de integración HTTP (en `contracts-http.test.ts`)

Cuando `FACTUROM_BILLING_TEST_BASE_URL` está configurado:

- Firma ausente e inválida: HTTP 400 sin redirección a login
- Webhook firmado válido: receipt durable → activación asíncrona → duplicado no repite
- Documentos legales públicos accesibles; versiones no publicadas no filtran
- Cron sin CRON_SECRET: 503

## Seguridad verificada

| Control | Estado |
|---------|--------|
| Verificación de firma Paddle SDK | ✅ |
| Idempotencia (BillingWebhookEvent + leasing) | ✅ |
| Protección contra eventos duplicados | ✅ |
| Protección contra eventos fuera de orden (`lastEventAt`) | ✅ |
| Aislamiento entre tenants (mismatch checks) | ✅ |
| Price ID desconocido rechazado | ✅ |
| Frontend no puede enviar Price ID ni elevar plan | ✅ |
| Advisory lock por suscripción | ✅ |
| Intent con TTL de 2 horas | ✅ |
| Entorno sandbox/production validado | ✅ |
| Token del intent no persiste en payload | ✅ |

## Restricciones cumplidas

- ❌ No se crearon productos Paddle
- ❌ No se configuraron precios
- ❌ No se reconstruyó el checkout
- ❌ No se repitieron pruebas de cobro
- ❌ No se inventaron identificadores
- ❌ No se activó Paddle Live
- ❌ No se hizo commit, push ni deploy
- ❌ No se modificó ningún archivo de código
