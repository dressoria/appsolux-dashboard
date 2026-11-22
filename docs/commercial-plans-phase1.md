# FACTUROM WEB — Fase 1: Planes Comerciales, Derechos y Control de Acceso

## 1. Resumen ejecutivo

Fase 1 implementa un sistema de control de acceso por plan comercial sobre la arquitectura existente de suscripciones. Los módulos permanecen siempre visibles en el sidebar, pero los usuarios de planes inferiores ven un prompt de upgrade al intentar acceder a funcionalidad restringida. No se crean nuevos modelos de datos, no se modifican precios ni integraciones con Paddle.

## 2. Estructura de planes comerciales

| Plan        | Nombre comercial | Precio     | CommercialPlan enum |
|-------------|-----------------|------------|---------------------|
| Básico      | Básico          | $69/año    | BASIC               |
| Negocio     | Negocio         | $129/año   | PLUS                |
| Empresarial | Empresarial     | $299/año   | ENTERPRISE          |

Mapeo desde legacy `PlanKey`:
- `free` → BASIC
- `trial` → PLUS
- `pro` → PLUS
- `enterprise` → ENTERPRISE

## 3. Catálogo de capacidades por módulo

Archivo: `lib/core/capabilities.ts`

| Módulo (ModuleKey)     | Nombre UI             | Plan mínimo  |
|------------------------|-----------------------|--------------|
| `purchases`            | Compras               | PLUS         |
| `suppliers`            | Proveedores           | PLUS         |
| `advanced_inventory`   | Inventario avanzado   | PLUS         |
| `treasury`             | Tesorería             | PLUS         |
| `advanced_reports`     | Reportes avanzados    | PLUS         |
| `accounting`           | Contabilidad          | ENTERPRISE   |

Módulos sin restricción (disponibles desde BASIC):
- Dashboard, Clientes, Ventas, Facturación SRI, Configuración SRI, Inventario básico, Reportes básicos, Empresa, Seguridad

## 4. Funciones incluidas por plan (FeatureKey)

### BASIC (Básico $69/año)
- `inventory_basic`, `pos_basic`, `sales_basic`, `customers_basic`, `reports_basic`
- `sri_invoicing`, `sri_configuration`

### PLUS (Negocio $129/año)
Todo lo de BASIC más:
- `inventory_advanced`, `purchases`, `warehouses`, `kardex`, `advanced_reports`

### ADVANCED (Avanzado)
Todo lo de PLUS más:
- `shared_erp`

### ENTERPRISE (Empresarial $299/año)
Todo lo anterior más:
- `dedicated_erp`, `erp_provisioning`, `admin_access`

## 5. Regla de visibilidad: todos los módulos visibles

**Archivo modificado:** `components/appsolux/layout/sidebar.tsx`

Cambio: se eliminó el filtrado de grupos del sidebar. La función `filterGroups()` ahora retorna `groups` sin filtrar. Todos los módulos aparecen en la navegación independientemente del plan del tenant.

**Motivo:** los usuarios deben ver qué funcionalidad existe para incentivar upgrades. La restricción ocurre al acceder al módulo, no al verlo en el menú.

## 6. Plan gate UI (prompt de upgrade)

**Archivos creados:**
- `components/appsolux/billing/plan-gate.tsx` — Componente `PlanGatePrompt`
- `components/appsolux/billing/plan-gate.module.css` — Estilos con colores de marca
- `components/appsolux/billing/module-gate-layout.tsx` — Server component reutilizable `ModuleGateLayout`

**Comportamiento:**
1. `ModuleGateLayout` recibe `moduleKey` y `tenantId`
2. Obtiene el `CommercialPlan` del tenant via `getTenantCommercialPlan()`
3. Evalúa acceso con `checkModuleAccess()`
4. Si tiene acceso → renderiza `children`
5. Si no tiene acceso → renderiza `DashboardShell` con `PlanGatePrompt` mostrando:
   - Nombre del módulo
   - Descripción de lo que incluye
   - Plan requerido
   - Botón "Ver planes" → `/billing`

## 7. Layouts de restricción por ruta

Cada directorio restringido tiene un `layout.tsx` que envuelve su contenido con `ModuleGateLayout`:

| Ruta                                          | ModuleKey            | Plan mínimo |
|-----------------------------------------------|----------------------|-------------|
| `app/facturacion/accounting/layout.tsx`        | `accounting`         | ENTERPRISE  |
| `app/facturacion/purchases/layout.tsx`         | `purchases`          | PLUS        |
| `app/facturacion/suppliers/layout.tsx`         | `suppliers`          | PLUS        |
| `app/facturacion/treasury/layout.tsx`          | `treasury`           | PLUS        |
| `app/facturacion/inventory/kardex/layout.tsx`  | `advanced_inventory` | PLUS        |
| `app/facturacion/inventory/adjustments/layout.tsx` | `advanced_inventory` | PLUS   |
| `app/facturacion/inventory/transfers/layout.tsx`   | `advanced_inventory` | PLUS   |
| `app/facturacion/inventory/warehouses/layout.tsx`  | `advanced_inventory` | PLUS   |
| `app/facturacion/inventory/valuation/layout.tsx`   | `advanced_inventory` | PLUS   |
| `app/facturacion/inventory/shipping-guides/layout.tsx` | `advanced_inventory` | PLUS |

## 8. Protección backend (API routes)

**Patrón implementado en:** `app/api/accounting/accounts/route.ts`

```typescript
import { requireModuleApiAccess, getModuleAccessErrorResponse } from "@/lib/core/capabilities";

// Dentro de cada handler (GET, POST, etc.):
try {
  await requireModuleApiAccess(tenant.id, "accounting");
} catch (err) {
  const gateResponse = getModuleAccessErrorResponse(err);
  if (gateResponse) return NextResponse.json(gateResponse.body, { status: gateResponse.status });
  throw err;
}
```

**Respuesta 403:**
```json
{
  "ok": false,
  "code": "MODULE_PLAN_REQUIRED",
  "message": "Contabilidad está incluido desde el plan Empresarial.",
  "requiredPlan": "Empresarial"
}
```

**Rutas API pendientes de proteger** (mismo patrón, mismas funciones):
- `/api/accounting/*` — todas las rutas (journal, settings, periods, plans, concepts, etc.)
- `/api/purchases/*` — todas las rutas
- `/api/treasury/*` — todas las rutas

## 9. Mapeo de features actualizado

**Archivo modificado:** `lib/core/commercial-plans.ts` → `getDefaultFeaturesForPlan()`

Cambios:
- **BASIC:** Se añadieron `sri_invoicing` y `sri_configuration` (todos los planes incluyen SRI)
- **PLUS:** Se añadieron `inventory_advanced`, `purchases`, `warehouses`, `kardex`, `advanced_reports` (alineado con especificación del plan Negocio)

Las safety rules del `OperatingMode.CORE` siguen deshabilitando features avanzadas cuando la infraestructura no está disponible.

## 10. Preservación de datos existentes

- No se ejecutaron migraciones
- No se modificaron modelos de Prisma
- No se eliminaron datos
- No se modificó Paddle ni el flujo de pagos
- No se modificó Clerk ni autenticación
- No se modificaron procesos SRI
- No se modificaron workers
- Cuentas existentes mantienen sus privilegios (mapeo legacy preserva o eleva, nunca reduce)

## 11. Migraciones pendientes

No se requieren migraciones de base de datos para esta fase. El sistema utiliza el `CommercialPlan` enum existente y el mapeo desde `PlanKey` legacy.

## 12. Validación

- **TypeScript** (`tsc --noEmit`): ✅ Sin errores
- **ESLint**: ✅ Sin errores ni warnings
- **Next.js build** (`next build`): ✅ Compilación exitosa

## Archivos creados

1. `lib/core/capabilities.ts`
2. `components/appsolux/billing/plan-gate.tsx`
3. `components/appsolux/billing/plan-gate.module.css`
4. `components/appsolux/billing/module-gate-layout.tsx`
5. `app/facturacion/accounting/layout.tsx`
6. `app/facturacion/purchases/layout.tsx`
7. `app/facturacion/suppliers/layout.tsx`
8. `app/facturacion/treasury/layout.tsx`
9. `app/facturacion/inventory/kardex/layout.tsx`
10. `app/facturacion/inventory/adjustments/layout.tsx`
11. `app/facturacion/inventory/transfers/layout.tsx`
12. `app/facturacion/inventory/warehouses/layout.tsx`
13. `app/facturacion/inventory/valuation/layout.tsx`
14. `app/facturacion/inventory/shipping-guides/layout.tsx`

## Archivos modificados

1. `lib/core/commercial-plans.ts` — Features por plan actualizados
2. `components/appsolux/layout/sidebar.tsx` — Sidebar sin filtrado
3. `app/api/accounting/accounts/route.ts` — Protección API de ejemplo
