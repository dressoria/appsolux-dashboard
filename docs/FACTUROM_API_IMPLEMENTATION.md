# Facturom — entrega de API keys y API REST v1

Fecha: 9 de noviembre de 2026. Repositorio: `appsolux-dashboard`. Entrega local para revisión de la subida conjunta con pagos; no se hicieron push, merge ni deploy.

## 1. Arquitectura de API keys

Se integró la API en Next.js App Router. `lib/integration-api/gateway.ts` autentica, resuelve permisos, aplica políticas, limita solicitudes, valida referencias, gestiona idempotencia y ejecuta los adaptadores de negocio. `routes.ts` centraliza el inventario versionado; `operations.ts` llama a servicios existentes. No hay otro backend, otro proyecto ni workers nuevos.

Los secretos usan `crypto.randomBytes(32)` (256 bits) y un prefijo público aleatorio. Solo se persiste SHA-256 del secreto completo; su comprobación usa comparación de tiempo constante. Las respuestas de claves existentes se construyen con una proyección que excluye el hash y el secreto.

## 2. Modelos y migración

- `UserApiKey`: usuario, tenant, nombre, prefijo/hash únicos, scopes, versión de catálogo, Full Access, estado, creación, actualización, expiración, último uso, revocación y clave reemplazada.
- `ApiIdempotencyRecord`: reserva y respuesta persistentes, hash de payload, operación y unicidad por clave/identificador.
- `ApiRateWindow`: contador atómico por clave, categoría y minuto.
- `ApiRequestLog`: uso por clave, usuario y tenant, endpoint, método, estado, duración y request ID.

Se añadieron relaciones User/Tenant y restricciones SQL para estados, revocación y snapshots de permisos no vacíos. La migración `20261109180000_add_integration_api_keys` solo crea tablas, índices, relaciones y restricciones de esta funcionalidad. No altera modelos operativos ni elimina datos.

Se probó la migración completa en PostgreSQL temporal sobre el esquema previo, que ya incluía los cambios locales acumulados de transferencias y Paddle. No se ejecutó sobre una base del usuario ni sobre producción.

## 3. Pantalla de administración

Ruta: `/settings/integrations/api-keys`. Entradas desde Configuración → Integraciones y Empresa → Integraciones. Usa componentes existentes shadcn/ui, diálogos accesibles Radix y azules `#1E52F1` / `#1769E0`.

Incluye empresas reales por membresía, nombre, expiraciones predefinidas/personalizadas, permisos por módulo, selección total/parcial, tabla con propietario/empresa/fechas/estado, inspección de permisos, revocación y rotación. El secreto solo aparece al crear o rotar. La copia utiliza el portapapeles del navegador; no hay recuperación posterior ni almacenamiento cliente persistente.

Los endpoints internos de gestión usan sesión web y protección de origen. Una API key no puede usarlos. Un administrador puede revocar claves organizacionales; no puede recuperar ni generar el secreto de reemplazo de otra persona.

## 4. Full Access

El backend calcula todos los scopes actualmente autorizados para el rol de la membresía seleccionada y persiste esa lista. El indicador `fullAccess` es descriptivo, nunca autoriza por sí mismo. Cada solicitud intersecta el snapshot guardado con los permisos efectivos actuales.

La UI selecciona todos los permisos disponibles, muestra módulos y cantidades, pasa a personalizado al desmarcar uno y vuelve a completo al restaurarlos. Ni cambios futuros del catálogo ni una rotación amplían automáticamente una clave existente. La rotación solo conserva permisos anteriores todavía autorizados.

## 5. Catálogo de permisos

Catálogo tipado y versionable en `catalog.ts`: **90 scopes en 14 módulos**. Se reutiliza `hasPermission` del sistema web, sin aceptar permisos del cliente. No contiene cobros de suscripciones, revisión de transferencias, firmas privadas ni administración global.

### Clientes (4)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `customers:read` | Consultar clientes e información comercial | `erp:read` |
| `customers:create` | Crear clientes | `erp:manage` |
| `customers:update` | Actualizar clientes | `erp:manage` |
| `customers:deactivate` | Desactivar clientes | `erp:manage` |

### Proveedores (4)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `suppliers:read` | Consultar proveedores | `erp:read` |
| `suppliers:create` | Crear proveedores | `erp:manage` |
| `suppliers:update` | Actualizar proveedores | `erp:manage` |
| `suppliers:deactivate` | Desactivar proveedores | `erp:manage` |

### Productos y servicios (7)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `products:read` | Consultar productos y servicios | `erp:read` |
| `products:create` | Crear productos y servicios | `erp:manage` |
| `products:update` | Actualizar productos | `erp:manage` |
| `products:deactivate` | Desactivar productos | `erp:manage` |
| `categories:read` | Consultar categorías | `erp:read` |
| `categories:manage` | Administrar categorías | `erp:manage` |
| `prices:manage` | Administrar precios | `erp:manage` |

### Inventario (24)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `stock:read` | Consultar existencias | `erp:read` |
| `warehouses:read` | Consultar bodegas | `erp:read` |
| `warehouses:create` | Crear bodegas | `erp:manage` |
| `warehouses:update` | Actualizar bodegas | `erp:manage` |
| `movements:read` | Consultar movimientos | `erp:read` |
| `stock:adjust` | Registrar ajustes de stock | `erp:manage` |
| `transfers:read` | Consultar transferencias | `erp:read` |
| `transfers:create` | Registrar transferencias | `erp:manage` |
| `transfers:complete` | Completar transferencias | `erp:manage` |
| `kardex:read` | Consultar Kardex | `erp:read` |
| `valuation:read` | Consultar valoración | `erp:read` |
| `counts:read` | Consultar conteos físicos | `erp:read` |
| `counts:create` | Registrar conteos físicos | `erp:manage` |
| `counts:update` | Registrar cantidades contadas | `erp:manage` |
| `counts:complete` | Completar conteos físicos | `erp:manage` |
| `brands:read` | Consultar marcas | `erp:read` |
| `brands:manage` | Administrar marcas | `erp:manage` |
| `units:read` | Consultar unidades | `erp:read` |
| `units:manage` | Administrar unidades | `erp:manage` |
| `guides:read` | Consultar guías de remisión operativas | `erp:read` |
| `guides:create` | Crear guías de remisión operativas | `erp:manage` |
| `guides:update` | Emitir o anular guías operativas en borrador | `erp:manage` |
| `vehicles:read` | Consultar vehículos | `erp:read` |
| `vehicles:manage` | Administrar vehículos | `erp:manage` |

### Ventas (6)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `sales:read` | Consultar ventas y documentos | `erp:read` |
| `sales:create` | Crear ventas | `pos:sell` |
| `sales:cancel` | Anular ventas | `erp:manage` |
| `orders:update` | Confirmar y anular órdenes de venta | `erp:manage` |
| `orders:create` | Crear órdenes de venta | `erp:manage` |
| `orders:read` | Consultar órdenes de venta | `erp:read` |

### Proformas (3)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `proformas:read` | Consultar proformas y estados | `erp:read` |
| `proformas:create` | Crear proformas | `pos:sell` |
| `proformas:update` | Actualizar proformas | `pos:sell` |

### Facturación electrónica (7)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `invoices:read` | Consultar facturas y pendientes | `erp:read` |
| `invoices:create` | Crear facturas mediante el flujo SRI | `pos:sell` |
| `invoices:files` | Descargar XML autorizado y RIDE | `erp:read` |
| `credit-notes:create` | Crear notas de crédito en borrador | `erp:manage` |
| `credit-notes:read` | Consultar notas de crédito | `erp:read` |
| `debit-notes:create` | Crear notas de débito en borrador | `erp:manage` |
| `debit-notes:read` | Consultar notas de débito | `erp:read` |

### SRI Ecuador (6)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `sri:read` | Consultar comprobantes y autorizaciones | `erp:read` |
| `sri:jobs` | Consultar sincronizaciones y resultados | `erp:read` |
| `sri:cancel` | Solicitar anulación mediante el proceso autorizado | `erp:manage` |
| `sri:sync` | Solicitar sincronización de documentos recibidos | `erp:manage` |
| `sri:sign` | Solicitar firma mediante el worker existente | `erp:manage` |
| `sri:submit` | Solicitar transmisión mediante el worker existente | `erp:manage` |

### Compras (9)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `purchases:read` | Consultar compras y documentos | `erp:read` |
| `purchases:create` | Registrar compras | `erp:manage` |
| `purchases:update` | Actualizar clasificación de compras | `erp:manage` |
| `purchases:cancel` | Anular compras | `erp:manage` |
| `purchase-orders:read` | Consultar pedidos de inventario | `erp:read` |
| `purchase-orders:create` | Crear pedidos de inventario | `erp:manage` |
| `receipts:read` | Consultar recepciones | `erp:read` |
| `receipts:create` | Registrar recepciones | `erp:manage` |
| `receipts:confirm` | Confirmar recepción de inventario | `erp:manage` |

### Tesorería (7)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `treasury:read` | Consultar cajas, bancos y movimientos | `erp:read` |
| `collections:read` | Consultar cobros y cuentas por cobrar | `erp:read` |
| `collections:create` | Registrar cobros | `erp:manage` |
| `payments:read` | Consultar pagos y cuentas por pagar | `erp:read` |
| `payments:create` | Registrar pagos | `erp:manage` |
| `treasury:manage` | Administrar cuentas operativas y sesiones de caja | `erp:manage` |
| `treasury:transfer` | Transferir entre cuentas propias | `erp:manage` |

### Contabilidad (7)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `accounts:read` | Consultar catálogo de cuentas | `erp:read` |
| `journal:read` | Consultar asientos | `erp:read` |
| `journal:create` | Crear asientos en borrador | `erp:manage` |
| `journal:post` | Contabilizar asientos | `erp:manage` |
| `journal:reverse` | Revertir asientos mediante el flujo contable | `erp:manage` |
| `periods:read` | Consultar períodos | `erp:read` |
| `accounting-reports:read` | Consultar balances y libros | `erp:read` |

### Reportes (4)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `reports:sales` | Consultar reportes de ventas y clientes | `reports:read` |
| `reports:inventory` | Consultar reportes de productos e inventario | `reports:read` |
| `reports:purchases` | Consultar reportes de compras | `reports:read` |
| `reports:financial` | Consultar reportes financieros | `reports:read` |

### Configuración operativa (1)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `settings:read` | Consultar configuración operativa delegable | `settings:read` |

### Usuarios de la empresa (1)

| Scope | Operación | Permiso efectivo web |
| --- | --- | --- |
| `users:read` | Consultar usuarios de esta empresa | `settings:manage` |

## 6. Endpoints implementados y ejecutados

**118 operaciones**: 60 GET, 43 POST, 12 PATCH y 3 DELETE. La tabla se obtuvo del registro real y de los logs de la última ejecución de pruebas en PostgreSQL. Los estados indican solicitudes ejecutadas, incluidas validaciones negativas. No son una afirmación de que cualquier payload vaya a aceptarse.

| Método | Ruta relativa a `/api/v1/` | Función | HTTP observados en pruebas |
| --- | --- | --- | --- |
| GET | `me` | Consultar identidad, empresa y permisos efectivos | 200 |
| GET | `customers` | Listar clientes | 200, 403 |
| GET | `customers/{id}` | Consultar cliente e historial | 200, 404 |
| POST | `customers` | Crear cliente | 201, 400, 409 |
| PATCH | `customers/{id}` | Actualizar cliente | 200, 404 |
| DELETE | `customers/{id}` | Desactivar cliente | 200 |
| GET | `suppliers` | Listar proveedores | 200 |
| POST | `suppliers` | Crear proveedor | 201 |
| PATCH | `suppliers/{id}` | Actualizar proveedor | 200 |
| DELETE | `suppliers/{id}` | Desactivar proveedor | 200 |
| GET | `products` | Listar productos | 200, 400 |
| GET | `products/{id}` | Consultar producto | 200, 404 |
| POST | `products` | Crear producto o servicio | 201, 403, 404 |
| PATCH | `products/{id}` | Actualizar producto (precios requieren prices:manage) | 200, 403 |
| DELETE | `products/{id}` | Desactivar producto | 200, 404 |
| POST | `products/prices` | Cambiar precios con control del precio anterior | 200 |
| GET | `inventory/stock` | Consultar existencias por bodega | 200 |
| GET | `inventory/warehouses` | Listar bodegas | 200 |
| POST | `inventory/warehouses` | Crear bodega | 201, 403 |
| PATCH | `inventory/warehouses/{id}` | Actualizar bodega | 200 |
| GET | `inventory/movements` | Consultar movimientos | 200 |
| POST | `inventory/adjustments` | Registrar ajuste | 201 |
| GET | `inventory/transfers` | Consultar transferencias | 200 |
| POST | `inventory/transfers` | Crear transferencia | 201 |
| POST | `inventory/transfers/{id}/complete` | Completar transferencia | 200 |
| GET | `inventory/physical-counts` | Listar conteos físicos | 200 |
| GET | `inventory/physical-counts/{id}` | Consultar conteo | 200 |
| POST | `inventory/physical-counts` | Crear conteo físico | 201 |
| PATCH | `inventory/physical-counts/{id}` | Registrar cantidad contada | 200 |
| POST | `inventory/physical-counts/{id}/complete` | Completar conteo físico | 200 |
| GET | `inventory/shipping-guides` | Consultar guías operativas (sin autorización SRI implícita) | 200 |
| GET | `inventory/shipping-guides/{id}` | Consultar guía operativa | 200 |
| POST | `inventory/shipping-guides` | Crear guía operativa | 201 |
| PATCH | `inventory/shipping-guides/{id}` | Actualizar estado de guía operativa en borrador | 200 |
| GET | `inventory/vehicles` | Consultar vehículos | 200 |
| POST | `inventory/vehicles` | Crear vehículo | 201 |
| PATCH | `inventory/vehicles/{id}` | Actualizar vehículo | 200 |
| GET | `inventory/kardex` | Consultar Kardex (productId obligatorio) | 200 |
| GET | `inventory/valuation` | Consultar valoración | 200 |
| GET | `inventory/categories` | Consultar categories | 200 |
| POST | `inventory/categories` | Crear categories | 201 |
| PATCH | `inventory/categories/{id}` | Actualizar categories | 200 |
| GET | `inventory/brands` | Consultar brands | 200 |
| POST | `inventory/brands` | Crear brands | 201 |
| PATCH | `inventory/brands/{id}` | Actualizar brands | 200 |
| GET | `inventory/units` | Consultar units | 200 |
| POST | `inventory/units` | Crear units | 201 |
| PATCH | `inventory/units/{id}` | Actualizar units | 200 |
| GET | `proformas` | Consultar proformas | 200 |
| GET | `proformas/{id}` | Consultar proforma y líneas | 200 |
| POST | `proformas` | Crear proforma con precios del catálogo | 201, 404 |
| PATCH | `proformas/{id}` | Actualizar proforma completa | 200 |
| GET | `sales` | Consultar ventas | 200 |
| GET | `sales/{id}` | Consultar venta | 200 |
| POST | `sales` | Registrar venta interna | 201, 404, 409 |
| POST | `sales/{id}/cancel` | Anular venta con reglas existentes | 200, 409, 422 |
| POST | `sales/{id}/payments` | Registrar cobro de venta | 201 |
| POST | `sales/orders` | Crear orden de venta | 201 |
| GET | `sales/orders/{id}` | Consultar orden de venta | 200 |
| POST | `sales/orders/{id}/confirm` | Confirmar orden de venta en borrador | 200 |
| POST | `sales/orders/{id}/cancel` | Anular orden no convertida | 200 |
| GET | `sales/orders` | Consultar órdenes de venta | 200 |
| GET | `invoices` | Consultar facturas SRI | 200 |
| GET | `invoices/{id}` | Consultar comprobante | 200 |
| POST | `invoices` | Iniciar facturación de una venta existente | 404, 422 |
| GET | `invoices/{id}/xml` | Descargar XML autorizado | 422 |
| GET | `invoices/{id}/ride` | Descargar RIDE autorizado | 422 |
| POST | `credit-notes` | Crear nota de crédito en borrador | 201 |
| GET | `credit-notes` | Consultar notas de crédito | 200 |
| POST | `debit-notes` | Crear nota de débito en borrador | 201 |
| GET | `debit-notes` | Consultar notas de débito | 200 |
| GET | `sri/sync-jobs` | Consultar sincronizaciones de ventas y compras sin credenciales | 200 |
| POST | `sri/received/sync` | Solicitar sincronización de recibidos con credenciales verificadas | 422 |
| GET | `sri/received` | Consultar documentos de compra registrados | 200 |
| GET | `sri/issued` | Consultar documentos emitidos consolidados | 200 |
| GET | `sri/documents` | Consultar documentos emitidos y estados | 200 |
| GET | `sri/documents/{id}` | Consultar comprobante SRI | 200 |
| GET | `sri/documents/{id}/jobs` | Consultar trabajos de firma y autorización | 200 |
| POST | `sri/documents/{id}/cancel` | Solicitar anulación SRI (no confirma la anulación) | 422 |
| POST | `sri/documents/{id}/sign` | Solicitar firma autorizada | 422 |
| POST | `sri/documents/{id}/submit` | Solicitar transmisión autorizada | 422 |
| GET | `purchases` | Consultar compras | 200 |
| POST | `purchases` | Registrar compra manual | 201, 400 |
| PATCH | `purchases/{id}` | Actualizar categoría contable | 200 |
| POST | `purchases/{id}/cancel` | Anular compra | 200 |
| GET | `purchases/orders` | Consultar pedidos de inventario | 200 |
| POST | `purchases/orders` | Crear pedido de inventario | 201 |
| GET | `purchases/receipts` | Consultar recepciones | 200 |
| POST | `purchases/receipts` | Registrar recepción en borrador | 201 |
| POST | `purchases/receipts/{id}/confirm` | Confirmar recepción con el flujo existente | 200 |
| GET | `treasury/cash` | Consultar cajas | 200 |
| GET | `treasury/banks` | Consultar bancos | 200 |
| GET | `treasury/movements` | Consultar movimientos financieros | 200 |
| GET | `treasury/receivables` | Consultar cuentas por cobrar | 200 |
| GET | `treasury/payables` | Consultar cuentas por pagar | 200 |
| POST | `treasury/receivables/{id}/collect` | Registrar cobro | 201 |
| POST | `treasury/payables/{id}/pay` | Registrar pago | 201 |
| POST | `treasury/transfers` | Transferir entre cuentas propias | 201 |
| POST | `treasury/cash` | Administrar caja | 201 |
| POST | `treasury/banks` | Administrar banco | 201 |
| POST | `treasury/cash/sessions` | Abrir o cerrar caja | 201 |
| GET | `accounting/accounts` | Consultar plan de cuentas | 200 |
| GET | `accounting/journal` | Consultar asientos | 200 |
| GET | `accounting/journal/{id}` | Consultar asiento | 200 |
| POST | `accounting/journal` | Crear asiento manual en borrador | 201 |
| POST | `accounting/journal/{id}/post` | Contabilizar asiento en período abierto | 200, 422 |
| POST | `accounting/journal/{id}/reverse` | Revertir asiento en período abierto | 200 |
| GET | `accounting/periods` | Consultar períodos | 200 |
| GET | `accounting/reports/trial-balance` | Consultar trial-balance (from, to; ledger: accountId) | 200 |
| GET | `accounting/reports/balance-sheet` | Consultar balance-sheet (from, to; ledger: accountId) | 200 |
| GET | `accounting/reports/income-statement` | Consultar income-statement (from, to; ledger: accountId) | 200 |
| GET | `accounting/reports/ledger` | Consultar ledger (from, to; ledger: accountId) | 200 |
| GET | `reports/sales` | Consultar reportes de ventas y clientes | 200 |
| GET | `reports/inventory` | Consultar valoración de inventario | 200 |
| GET | `reports/purchases` | Consultar totales de compras | 200 |
| GET | `reports/financial` | Consultar resumen financiero | 200 |
| GET | `settings/company` | Consultar datos operativos de empresa | 200 |
| GET | `users` | Consultar usuarios propios sin secretos | 200 |

Además, `GET /api/v1/openapi` genera la especificación. Los endpoints internos `GET/POST /api/settings/api-keys` y `POST /api/settings/api-keys/ID` gestionan claves mediante sesión web y no forman parte de la API comercial autenticada por clave.

## 7. Qué funciona realmente

Las pruebas ejercitaron **las 118 operaciones**: **111 tuvieron respuestas exitosas** con PostgreSQL real; siete operaciones externas SRI solo se verificaron en condiciones de rechazo. Ningún endpoint devuelve datos simulados para aparentar cobertura.

Se verificaron creación/edición/desactivación de productos, clientes y proveedores; precios; stock y ajustes; transferencias; conteos; recepciones; proformas con precio/IVA del catálogo; ventas y cobros; anulación de ventas sin comprobante ni cobros integrados; órdenes en borrador, confirmación/anulación; notas en borrador; guías y vehículos; compras y clasificación/anulación; pagos, cajas y transferencias bancarias; asientos, contabilización y reversión en períodos abiertos; consultas y reportes de todos los módulos publicados.

Se verificaron bloqueo de períodos cerrados, capacidad de bodegas, restricciones a cobros integrados, referencias cruzadas entre empresas y denegación de cambios destructivos o de precios cuando faltan sus scopes específicos.

Las siete operaciones sin éxito tributario real son: iniciar factura, descargar XML autorizado, descargar RIDE, sincronizar recibidos y solicitar firma, transmisión o anulación SRI. Se ejecutaron contra las condiciones de desarrollo y devolvieron validaciones reales. No se afirmó autorización ni se fabricaron comprobantes para reemplazar servicios externos.

## 8. Limitaciones existentes y de superficie pública

- Proformas: el enum actual solo tiene `ACTIVE`. Se ofrecen consulta, creación y edición. No se inventó un estado de anulación o una conversión persistente ausente en el servicio actual.
- Notas de crédito/débito: se reutiliza la creación real de borradores; no se presenta como emisión electrónica completa.
- Guías: son documentos operativos; su estado `ISSUED` no certifica autorización SRI.
- Recepciones: el servicio vigente confirma stock en la bodega predeterminada. La API rechaza otra bodega para evitar una asignación silenciosa diferente.
- La solicitud de anulación SRI conserva el proceso existente, cuyo código marca pendiente la verificación externa en vivo. No existe confirmación tributaria artificial desde esta API.
- La API publica servicios Core; no ofrece un proxy libre de ERPNext ni publica importadores, firmas, credenciales, configuración de sincronizaciones comerciales, membresías o administración interna.
- Los secretos SRI, certificados y servicios externos deben estar configurados antes de comprobar emisión/autorización y descargas de documentos reales.

## 9. Aislamiento multitenant

El tenant se obtiene de la fila de la clave. La autenticación comprueba usuario y membresía vigentes. Los adaptadores pasan el tenant autenticado a los servicios; los identificadores del recurso principal y sus referencias se vuelven a resolver por tenant. Las consultas/escrituras operativas conservan sus condiciones de tenant.

Se probaron IDs válidos de la segunda empresa en lecturas y escrituras, alteraciones de parámetros/cabeceras/cuerpos y cambios de propietario. No se permite convertir una solicitud en una sesión web o cambiar el tenant de la clave.

## 10. Autenticación, revocación y rotación

Bearer y X-API-Key funcionan sin cookies. No hay caché de autorización que mantenga claves revocadas activas. Revocación, expiración, usuario desactivado, membresía desactivada y degradación de rol se verificaron con datos persistidos.

La rotación mantiene ambas claves o reemplaza la anterior dentro de una transacción, según la opción explícita. La selección de empresa en gestión se verifica contra una membresía activa; seleccionar una empresa del navegador nunca basta para autorizarla.

Las funciones compartidas de anulación de ventas y compras ahora admiten un actor opcional explícito. La API lo proporciona y no depende de cookies; sus llamadores web conservan el comportamiento anterior. Las órdenes y notas reutilizan `sales-documents.ts`, extraído de las rutas web.

## 11. n8n

La guía `FACTUROM_API.md` incluye credencial de cabecera, URL configurable y cuerpos reales para clientes, productos, proformas, ventas y facturación. La prueba de navegador utilizó un cliente HTTP independiente sin cookies para consumir productos y crear una proforma con la clave recién generada.

No se ejecutó una instancia de n8n ni se publicó un workflow remoto. Se verificó el protocolo HTTP que usa su nodo HTTP Request. Las llamadas de facturación requieren validaciones fiscales y configuración real; una solicitud aceptada no equivale a autorización del SRI.

## 12. Documentación

- `/settings/integrations/api-docs`: documentación dentro del producto, ejemplos, catálogo y endpoints desplegables.
- `/api/v1/openapi`: OpenAPI 3.0.3 generado desde las rutas; incluye autenticación, scopes, parámetros, cuerpos y errores.
- `lib/integration-api/contracts.ts`: contratos de solicitud compartidos por OpenAPI y la documentación visible.
- `docs/FACTUROM_API.md`: operación y guía n8n.
- Este informe: inventario y evidencia de la entrega.

La base se resuelve con `NEXT_PUBLIC_APP_URL`; su predeterminado actual es el de `config/app.ts`. No se inventó otro dominio de producción.

## 13. Resultados de calidad y pruebas

| Comprobación | Resultado |
| --- | --- |
| Prisma validate | Correcto |
| Prisma generate | Correcto |
| Migración aditiva sobre PostgreSQL temporal con esquema previo | Correcta, incluidas restricciones SQL finales |
| TypeScript | Correcto |
| Suite nueva `npm run test:api`, con PostgreSQL local explícito | **43/43 pruebas correctas**, sin omisiones |
| Endpoints privados ejercitados | **118/118**; 111 con éxito, siete SRI con rechazo esperado |
| Navegador Chrome/Playwright | Creación, Full Access/personalizado, secreto una vez, HTTP sin cookies, rotación, revocación, documentación, escritorio/móvil y ausencia de errores de navegador |
| ESLint de archivos nuevos de API | Correcto, sin errores |
| ESLint global | 51 errores y 62 advertencias previos; no se introdujeron errores en esos archivos |
| Regresión seleccionada de módulos existentes | 170/171 correctas; una falla previa del test ZIP |
| Build de producción normal (`npm run build`) | Correcto; advertencias existentes de trazado de archivos dinámicos |

Se compararon con `HEAD` los 31 archivos señalados por los errores globales de ESLint: 51 errores antes y 51 después, sin incremento por archivo. No se desactivaron reglas para esconderlos.

La regresión pendiente está en `lib/core/lightweight-suppliers.test.ts:103`: espera `true` de `validateSriTaxpayerResource`, pero el servicio devuelve metadatos `{ fileType: "ZIP", sizeBytes: undefined }`. Ni ese test ni el servicio SRI correspondiente se modificaron en esta implementación.

El build inicial detectó siete firmas antiguas de páginas que todavía usaban `searchParams` síncronos o props completamente opcionales. Se ajustaron al contrato asíncrono de Next.js sin modificar sus operaciones de negocio.

Las pruebas PostgreSQL usan fixtures exclusivamente en bases locales temporales. No se ejecutaron contra datos de usuarios. La herramienta de navegador se instaló fuera del repositorio para verificación; no se añadieron dependencias a la aplicación.

## 14. Archivos de esta implementación

Se conservaron los 33 archivos que ya tenían trabajo local al comenzar. Los archivos previos de pagos mantienen sus hashes. En `prisma/schema.prisma` se verificó la conservación del esquema previo bajo las adiciones de API; en `package.json` se conservó el contenido anterior y solo se añadió `test:api`.

- `app/api/facturacion/credit-notes/route.ts`
- `app/api/facturacion/debit-notes/route.ts`
- `app/api/facturacion/sales-orders/[orderId]/route.ts`
- `app/api/facturacion/sales-orders/route.ts`
- `app/api/settings/api-keys/[id]/route.ts`
- `app/api/settings/api-keys/route.ts`
- `app/api/v1/[...path]/route.ts`
- `app/api/v1/openapi/route.ts`
- `app/basic/customers/page.tsx`
- `app/basic/products/page.tsx`
- `app/erp/finance/bank-reconciliation/page.tsx`
- `app/erp/finance/cash-closing/page.tsx`
- `app/erp/finance/cash/page.tsx`
- `app/erp/inventory/adjustments/page.tsx`
- `app/erp/inventory/kardex/page.tsx`
- `app/settings/integrations/api-docs/page.tsx`
- `app/settings/integrations/api-keys/page.tsx`
- `components/appsolux/integrations/api-keys-manager.tsx`
- `components/appsolux/layout/sidebar.tsx`
- `components/appsolux/settings/configuration-page-client.tsx`
- `components/appsolux/settings/settings-tabs.tsx`
- `docs/FACTUROM_API.md`
- `docs/FACTUROM_API_IMPLEMENTATION.md`
- `lib/core/lightweight-pos.ts`
- `lib/core/purchase-documents.ts`
- `lib/core/sales-documents.ts`
- `lib/integration-api/auth.ts`
- `lib/integration-api/catalog.ts`
- `lib/integration-api/contracts.ts`
- `lib/integration-api/crypto.ts`
- `lib/integration-api/errors.ts`
- `lib/integration-api/gateway.ts`
- `lib/integration-api/management.ts`
- `lib/integration-api/openapi.ts`
- `lib/integration-api/operations.ts`
- `lib/integration-api/persistence.ts`
- `lib/integration-api/policy.ts`
- `lib/integration-api/postgres.test.ts`
- `lib/integration-api/references.ts`
- `lib/integration-api/routes.ts`
- `lib/integration-api/security.test.ts`
- `lib/integration-api/serialization.ts`
- `package.json`
- `prisma/migrations/20261109180000_add_integration_api_keys/migration.sql`
- `prisma/schema.prisma`
- `proxy.ts`

Los cambios de Paddle, transferencias, suscripciones, panel administrativo de pagos, variables de producción y Docker previos no se sobrescribieron. Facturom Mobile y los tres workers SRI no se modificaron.

## 15. Pendientes reales

1. Resolver en la revisión acumulada los errores históricos de ESLint y la expectativa desactualizada del test ZIP; no se maquillaron ni se modificaron fuera del alcance de esta entrega.
2. Verificar emisión, autorización, XML/RIDE, sincronización y anulación con la configuración y servicios reales del SRI. Los casos de rechazo están comprobados; no hay certificación externa en vivo.
3. La política comercial futura de API keys se conecta en `apiKeyPlanPolicy`. Hoy permite usuarios autorizados durante el acceso temporal y no utiliza la fila comercial histórica para bloquearlos. No cambia precios ni planes.
4. Definir retención operativa de auditoría y tratamiento de reservas interrumpidas antes de realizar purgas. No se eliminan automáticamente registros de idempotencia que podrían permitir duplicados.
5. Las ampliaciones de negocio ausentes, como conversión/anulación persistente de proformas, permanecen fuera de la funcionalidad existente y están documentadas; no se inició otra fase para construirlas.

## 16. Preparación de migración y despliegue

La migración está preparada para revisión junto con las migraciones pendientes de transferencias y Paddle. Antes de una subida autorizada se debe revisar el historial acumulado y el origen público HTTPS, respaldar y aplicar las migraciones mediante el procedimiento habitual del proyecto, y desplegar el conjunto revisado.

No se ejecutaron push, merge, deploy ni migraciones de producción. No se cambiaron precios, planes, `facturom-access.ts`, infraestructura de producción ni workers. La ejecución se detiene con esta entrega para la revisión y autorización conjunta solicitada.
