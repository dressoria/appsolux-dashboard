# FACTUROM WEB — Fase 2: Página de Precios y Planes Comerciales

## 1. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `lib/core/billing/commercial-plans.ts` | Highlights actualizados por plan, comparison expandida a 26 keys con 9 categorías |
| `components/appsolux/billing/commercial-plan-catalog.tsx` | Rediseño completo: blob hover, comparison colapsable por categorías, banner ilimitado, badge "Tu plan" |
| `components/appsolux/billing/commercial-plan-catalog.module.css` | **Nuevo** — Estilos de animación blob, comparison colapsable, badges, banner |
| `app/(public)/precios/page.tsx` | Hero actualizado con brand colors, FAQ ampliado (IVA, métodos de pago), colores corporativos |
| `app/billing/page.tsx` | Subtítulo actualizado para evitar duplicar "ilimitadas" con el nuevo banner del catálogo |

## 2. Rutas de precios

| Ruta | Tipo | Autenticación |
|------|------|---------------|
| `/precios` | Pública | No requerida — accesible sin sesión |
| `/billing` | Privada | Requiere sesión — muestra plan del tenant, estado de suscripción, "Tu plan" |

El botón "Planes" en la cabecera del dashboard sigue apuntando a `/billing` (sin cambios).

## 3. Diseño aplicado

### Tarjetas de plan

- **Básico:** Tarjeta blanca, bordes suaves, detalles azul oscuro (#000345). Hover blob azul sutil.
- **Negocio:** Tarjeta destacada con borde rosa (#FF0099), badge "MÁS POPULAR" con gradiente rosa, sombra rosa. Hover blob rosa. Elevación visual con `lg:-translate-y-2`.
- **Empresarial:** Tarjeta blanca, detalles azul oscuro. Hover blob navy sutil.

### Interacciones

- **Blob hover:** Gradiente radial que emerge desde la parte inferior de la tarjeta, con `translateY(-4px)` y sombra dinámica. Duración 500ms.
- **Comparison colapsable:** Botón "Ver comparación detallada" con chevron animado. Expansión con `grid-template-rows` transition (400ms).
- **`prefers-reduced-motion`:** Todas las animaciones y transiciones se deshabilitan.

### Colores corporativos

- Rosa: `#FF0099` — badge Más popular, acentos Negocio, banner ilimitado
- Azul oscuro: `#000345` — títulos, precios, botones CTA destacados
- Primary: `var(--facturom-primary)` / `#1769E0` — checks, acentos generales

## 4. Fuente de los precios

Los precios provienen de `lib/core/billing/commercial-plans.ts` → `commercialPlans`:

| Plan | Mensual | Anual | Moneda |
|------|---------|-------|--------|
| Básico | $6.99 | $69 | USD |
| Negocio | $12.99 | $129 | USD |
| Empresarial | $29.99 | $299 | USD |

**IVA:** Los precios se muestran como "Precio antes de impuestos". El IVA se calcula por separado según normativa ecuatoriana. Paddle aplica impuestos en el checkout automáticamente. Para transferencias bancarias, el monto mostrado es el precio base.

**No se modificaron precios.** Los valores son los mismos que existían antes de esta fase.

## 5. Mapeo de identificadores

| Código comercial | PlanKey legacy | CommercialPlan Prisma | Display |
|-----------------|----------------|----------------------|---------|
| BASIC | free | BASIC | Básico |
| BUSINESS | pro | PLUS | Negocio |
| ENTERPRISE | enterprise | ENTERPRISE | Empresarial |

Nota: `CommercialPlanCode` en commercial-plans.ts usa BASIC/BUSINESS/ENTERPRISE. El enum Prisma `CommercialPlan` usa BASIC/PLUS/ADVANCED/ENTERPRISE. El mapeo `free→BASIC`, `trial→BASIC`, `pro→PLUS`, `enterprise→ENTERPRISE` se mantiene en `lib/core/commercial-plans.ts` → `mapLegacyPlanKeyToCommercialPlan`.

## 6. Capacidades anunciadas y verificadas

### Verificadas (páginas y funcionalidad existen en el codebase)

| Capacidad | Ruta | Plan |
|-----------|------|------|
| Facturación electrónica SRI | `/sri/documents` | Todos |
| Punto de venta | `/pos` | Todos |
| Gestión de clientes | `/facturacion` (clientes) | Todos |
| Inventario básico | `/facturacion/inventory` | Todos |
| Compras | `/facturacion/purchases` | Negocio+ |
| Proveedores | `/facturacion/suppliers` | Negocio+ |
| Inventario avanzado / Kardex | `/facturacion/inventory/kardex` | Negocio+ |
| Múltiples bodegas | `/facturacion/inventory/warehouses` | Negocio+ |
| Movimientos y transferencias | `/facturacion/inventory/transfers` | Negocio+ |
| Cuentas por cobrar | `/facturacion/treasury/receivables` | Negocio+ |
| Cuentas por pagar | `/facturacion/treasury/payables` | Negocio+ |
| Plan de cuentas | `/facturacion/accounting/chart-of-accounts` | Empresarial |
| Asientos y libro diario | `/facturacion/accounting/journal` | Empresarial |
| Libro mayor | `/facturacion/accounting/ledger` | Empresarial |
| Balance general | `/facturacion/accounting/balance-sheet` | Empresarial |
| Estado de resultados | `/facturacion/accounting/income-statement` | Empresarial |
| Balance de comprobación | `/facturacion/accounting/trial-balance` | Empresarial |
| Reportes | `/facturacion/reports`, `/reports` | Todos (niveles) |

## 7. Funcionalidades que NO deben anunciarse todavía

| Funcionalidad | Razón |
|--------------|-------|
| Automatizaciones | Valor `false` en los tres planes. No hay módulo público de automatizaciones habilitado. |
| API | Valor `false` en los tres planes. API keys existen en settings pero no se anuncia como feature comercial. |
| Gestión avanzada de usuarios y permisos | Se anuncia en highlights de Empresarial. Existe gestión básica de usuarios pero los permisos granulares no están completamente operativos como feature diferenciada. Se documenta como expectativa futura. |

## 8. Estado real de checkout

- **Paddle:** Integración existente y funcional (`PaddleCheckoutClient`). Los Price IDs se configuran via variables de entorno (`PADDLE_PRICE_*_MONTHLY`, `PADDLE_PRICE_*_YEARLY`). Si están configurados, el checkout funciona. Si no, el botón muestra "Pagos próximamente".
- **`onlinePaymentsAvailable`** se resuelve en runtime por `getOnlinePaymentsAvailability()`. Si Paddle no está configurado, retorna `false` y los botones se deshabilitan.
- **No se modificó** ninguna lógica de checkout ni de Paddle.

## 9. Estado de transferencias

- **Flujo activo:** `BankTransferForm` en `/billing/transfer` permite seleccionar plan e intervalo, ingresar datos de transferencia y subir comprobante.
- **Requiere aprobación administrativa.** `approveBankTransfer()` en `bank-transfer-service.ts` valida la solicitud, verifica que no haya suscripción Paddle activa, y activa el plan.
- **No se acreditan pagos automáticamente.** Solo un admin puede aprobar.
- **No se modificó** ningún flujo de transferencia.

## 10. Pruebas

### Verificaciones automatizadas
- **TypeScript** (`tsc --noEmit`): Sin errores
- **ESLint**: Sin errores ni warnings
- **Next.js build** (`next build`): Compilación exitosa

### Verificaciones manuales posibles
- `/precios` responde 200 sin autenticación
- `/billing` requiere sesión (retorna 500/redirect sin auth — comportamiento esperado)
- Los tres precios anuales coinciden: $69, $129, $299
- Documentos ilimitados aparecen en los tres planes (banner + highlights + comparison)
- Comparison colapsable funciona con animación
- Badge "MÁS POPULAR" en Negocio
- Badge "Tu plan" se renderiza cuando `currentPlanCode` coincide
- Responsive: cards apilan en mobile, comparison muestra cards individuales en mobile y tabla en desktop
- `prefers-reduced-motion`: deshabilita animaciones

### No verificados en esta fase
- Sesión autenticada real (requiere Clerk configurado)
- Checkout Paddle real (requiere sandbox/prod keys)
- Transferencia bancaria real (requiere `BILLING_BANK_ACCOUNT_NUMBER`)

## 11. Pendientes legales

Según la especificación, la Fase 3 creará:
- Política de privacidad
- Términos y condiciones
- Política de cookies
- Política de reembolsos

**Estado actual:**
- Existen rutas `/politica-de-privacidad`, `/politica-de-cookies`, `/terminos-y-condiciones` en el router
- No se verificó su contenido actual
- No se crearon enlaces nuevos a documentos legales inexistentes
- No se inventaron textos legales

## 12. Riesgos antes de comercializar

1. **Cobertura API incompleta.** La Fase 1 demostró protección API solo en `/api/accounting/accounts`. Las rutas `/api/purchases/*`, `/api/treasury/*`, y el resto de `/api/accounting/*` aún no tienen gate de plan. Requiere auditoría completa antes de habilitar cobros públicos.

2. **Gestión de usuarios y permisos.** El plan Empresarial anuncia "Gestión avanzada de usuarios y permisos". Si los permisos granulares no están operativos, la promesa comercial podría generar expectativas no cumplidas.

3. **Límites no enforcement.** Los límites de productos (200/5.000/100.000), usuarios (1/5/100) y puntos de emisión (1/3/50) se muestran como información comercial pero no hay evidencia de enforcement server-side. Un tenant Básico podría crear más de 200 productos sin que el sistema lo impida.

4. **IVA en transferencias.** El monto de transferencia se muestra como precio base. No hay nota de IVA en el flujo de transferencia. Podría generar confusión si el monto final difiere del mostrado.

5. **Paddle sandbox vs producción.** `paddleEnv` se configura via variable de entorno. Verificar que esté en modo correcto antes de aceptar pagos reales.
