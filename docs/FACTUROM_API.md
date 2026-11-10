# Facturom API v1 — integraciones y n8n

Implementación local del 9 de noviembre de 2026. Especificación generada: `GET /api/v1/openapi`. Documentación dentro de Facturom: `/settings/integrations/api-docs`. Administración: `/settings/integrations/api-keys`, accesible desde Configuración → Integraciones y desde el menú Empresa → Integraciones.

## Origen y autenticación

La documentación y OpenAPI obtienen el origen de `NEXT_PUBLIC_APP_URL`, mediante `config/app.ts`. El valor predeterminado del repositorio es `https://facturom.com`; por tanto, sin otra configuración, la base documentada es `https://facturom.com/api/v1`. No se verificó una instalación pública ni se modificó su configuración. En producción se debe usar el valor público HTTPS configurado en esa instalación. Las verificaciones HTTP de esta entrega usaron un servidor local y PostgreSQL temporal.

```http
Authorization: Bearer API_KEY
```

También se admite `X-API-Key`. Si se envían ambas cabeceras deben coincidir. No se admiten claves en URLs. Las cookies web no autentican la API. El proxy evita completamente Clerk para `/api/v1/`; cada operación privada verifica su propia clave.

Cada clave está ligada a su usuario y empresa. La API rechaza intentos de introducir `tenantId`, `tenant_id`, `companyId`, `userId`, scopes o contexto de creación en el cuerpo o los parámetros; tampoco permite cambiar de empresa con cabeceras. Los identificadores relacionados se comprueban dentro de la empresa autenticada.

## Crear, revocar y rotar claves

1. Seleccionar explícitamente la empresa en la pantalla de claves.
2. Indicar nombre y expiración: ninguna, 30 días, 90 días, 365 días o fecha personalizada.
3. Seleccionar permisos individuales, un módulo completo o **Acceso completo (Full Access)**.
4. Guardar el secreto que aparece una sola vez. No se puede recuperar después de cerrar la ventana.

Full Access guarda un conjunto explícito de scopes del catálogo actual. No es un comodín. Desmarcar una operación cambia la selección a personalizada; seleccionar nuevamente todas restaura Full Access. El servidor calcula y valida la selección usando la membresía actual. Una reducción posterior del rol reduce inmediatamente los permisos efectivos de la clave.

La revocación es permanente y bloquea nuevas solicitudes. La rotación ofrece dos procedimientos explícitos:

- **Convivencia:** genera un reemplazo y mantiene la anterior activa. Actualizar n8n, verificar `/me` y después revocar la anterior.
- **Reemplazo inmediato:** genera la nueva y revoca la anterior en la misma transacción.

La rotación conserva la intersección entre los permisos anteriores y los que siguen autorizados. No concede nuevos permisos por cambios del catálogo. Para ampliar permisos se crea una nueva clave con una selección explícita. Un administrador puede revocar claves de su organización; solo el propietario de la clave puede obtener un secreto de reemplazo.

## HTTP Request en n8n

Guardar la clave en una credencial de cabecera de n8n: nombre `Authorization`, valor `Bearer API_KEY`. Usar esa credencial en cada nodo HTTP Request.

| Automatización | Método y ruta | Scope |
| --- | --- | --- |
| Comprobar conexión | `GET /me` | Clave activa |
| Consultar productos | `GET /products?page=1&pageSize=50` | `products:read` |
| Consultar existencias | `GET /inventory/stock` | `stock:read` |
| Crear cliente | `POST /customers` | `customers:create` |
| Crear proforma | `POST /proformas` | `proformas:create` |
| Consultar ventas | `GET /sales` | `sales:read` |
| Crear venta | `POST /sales` | `sales:create` |
| Iniciar factura de una venta | `POST /invoices` | `invoices:create` |
| Actualizar producto | `PATCH /products/ID` | `products:update`; precios también `prices:manage` |

Las rutas de la tabla son relativas a la base pública configurada. Todas las escrituras requieren `Content-Type: application/json`, un objeto JSON y `Idempotency-Key`. Los endpoints de acciones sin parámetros reciben `{}`.

### Crear cliente

```json
{
  "name": "Cliente de integración",
  "identificationType": "PASSPORT",
  "identification": "INTEGRATION001",
  "email": "cliente@example.com"
}
```

El identificador devuelto es `data.id`. Los tipos fiscales admitidos son `RUC`, `CEDULA`, `PASSPORT` y `FOREIGN_ID`, sujetos a las validaciones existentes. PATCH permite actualizar únicamente los campos necesarios, por ejemplo `{"email":"nuevo@example.com"}`.

### Crear producto o servicio

```json
{
  "name": "Servicio de integración",
  "primaryCode": "API-SERVICE",
  "type": "SERVICE",
  "price": 25,
  "taxRate": 15,
  "trackInventory": false
}
```

Los productos con inventario requieren una bodega válida o predeterminada. No se modifica stock mediante campos del producto: usar ajustes, transferencias o recepciones. La composición de combos conserva su editor existente.

### Crear proforma

```json
{
  "customerId": "ID_CLIENTE_DE_ESTA_EMPRESA",
  "items": [
    {
      "productId": "ID_PRODUCTO_DE_ESTA_EMPRESA",
      "quantity": 2
    }
  ]
}
```

El servidor obtiene precio e IVA del catálogo y llama al servicio real de proformas. `unitPrice` y `discount` son opcionales; el IVA se obtiene del producto. Las cantidades respetan la validación existente de enteros positivos. PATCH recibe la proforma completa y sus líneas.

### Crear venta y solicitar factura

Primero `POST /sales` con una clave de idempotencia para el evento de venta:

```json
{
  "customerId": "ID_CLIENTE",
  "paymentMethod": "credit",
  "paidAmount": 0,
  "items": [
    {
      "productId": "ID_PRODUCTO",
      "quantity": 1
    }
  ]
}
```

Después `POST /invoices`, con otro identificador de idempotencia:

```json
{
  "saleId": "ID_DEVUELTO_EN_DATA_ID"
}
```

Se reutiliza `startSriFlowFromBasicSale`. Una respuesta 201 inicia o recupera el flujo; **no significa autorización del SRI**. Consultar el `documentId` devuelto mediante `/sri/documents/ID`. XML y RIDE solo se entregan para facturas autorizadas con XML disponible. Configuración fiscal, numeración, certificado, workers y conectividad deben estar listos.

Para cobrar una venta existente se usa `/sales/ID/payments`, con `method`, `amount` y, cuando corresponda, `treasuryAccountId`. Las operaciones de Tesorería conservan además su `requestKey` de negocio; este campo y `Idempotency-Key` cumplen funciones distintas.

## Respuestas, paginación y errores

```json
{
  "ok": true,
  "data": { "items": [], "total": 0 },
  "meta": { "page": 1, "pageSize": 50, "requestId": "identificador" }
}
```

Ese es el formato de listados como productos y clientes. Algunos catálogos devuelven un array en `data`; los contratos individuales constan en la documentación del endpoint. Las fechas se serializan como ISO y los importes Prisma Decimal como cadenas. Los listados paginados usan `page` y `pageSize` entre 1 y 100; detalles, árboles y reportes calculados no se paginan. El máximo por cuerpo es 1 MiB; los adaptadores de líneas aceptan hasta 200 elementos.

```json
{
  "ok": false,
  "error": {
    "code": "FORBIDDEN_SCOPE",
    "message": "La clave no tiene permiso para esta operación."
  }
}
```

HTTP 400 indica formato inválido; 401 clave ausente, inválida, vencida o revocada; 403 autorización, plan o estado operativo; 404 recurso no accesible en esta empresa; 409 conflicto; 413 tamaño excedido; 422 validación de negocio; 429 límite; 500 error interno; 503 migración pendiente. `X-Request-Id` permite investigar la solicitud.

## Idempotencia y concurrencia

Usar un identificador estable del evento, por ejemplo `pedido-123-venta`. Para la factura usar otro, como `pedido-123-factura`. Conservar el mismo identificador en todos los reintentos de esa operación y enviar el mismo payload. Cambiar el contenido o reutilizar el identificador para otra ruta produce 409.

Los registros se guardan en PostgreSQL y se reservan antes de los efectos de negocio. Una respuesta completada se reproduce con `Idempotency-Replayed: true`. La reserva no depende de memoria ni desaparece al reiniciar el servidor. El ámbito es por API key: una integración debe conciliar eventos pendientes antes de cambiar de clave.

Una interrupción puede dejar `PROCESSING`. En ese caso se devuelve `IDEMPOTENCY_IN_PROGRESS`: consultar los resultados y conciliar antes de volver a emitir el evento. No cambiar arbitrariamente el identificador ni liberar una reserva sin verificar sus efectos. La contención de una operación que no llegó a ejecutarse marca la reserva `RETRYABLE`; su reintento se adquiere de forma atómica. Las escrituras API de una misma empresa se coordinan con un bloqueo PostgreSQL; la lógica original conserva además sus propias transacciones.

## Rate limiting, auditoría y operación

Por clave y minuto: 120 solicitudes totales, 30 escrituras y 20 solicitudes costosas. Los contadores PostgreSQL son atómicos y compartidos entre instancias. HTTP 429 devuelve `Retry-After: 60`; las respuestas autenticadas incluyen cabeceras de límite cuando están disponibles.

La auditoría registra ID de clave, usuario, empresa, plantilla del endpoint, método, estado HTTP, duración y request ID. No guarda cabeceras, query strings ni cuerpos. `lastUsedAt` se actualiza como máximo una vez por minuto. Las respuestas operativas excluyen contraseñas, tokens y ubicaciones internas de almacenamiento.

No se añadió purga automática. La retención de logs y de reservas de idempotencia debe acordarse con la operación antes de eliminar información necesaria para conciliaciones. Un proxy de producción debe terminar HTTPS y establecer las cabeceras de protocolo de forma confiable; no se modificó su configuración en esta entrega.

## Límites y servicios existentes

- Proformas: el modelo actual solo admite `ACTIVE`. Se ofrecen creación, consulta y edición; no se inventó una conversión persistente ni una anulación inexistente.
- Órdenes de venta: consulta, creación en borrador, confirmación y anulación mediante el servicio compartido. La conversión web que prepara un borrador de factura conserva su flujo actual.
- Notas de crédito/débito: creación de borradores y consulta usando los servicios extraídos de la web. Su emisión electrónica completa requiere el flujo tributario correspondiente; un borrador no es un documento autorizado.
- Guías: son guías operativas; `ISSUED` no implica autorización SRI.
- Recepciones: el servicio actual confirma contra la bodega predeterminada. La API rechaza una bodega distinta para no dirigir stock a un destino diferente del solicitado.
- La anulación directa de ventas con comprobante SRI está bloqueada. La anulación tributaria solicita el proceso existente y no confirma resultados externos. Los cobros/pagos integrados conservan las restricciones de devolución y conciliación de Tesorería.
- La consulta de sincronizaciones y la solicitud de sincronización de recibidos reutilizan tablas y servicios actuales. No se duplicaron workers ni se expusieron credenciales. Las demás configuraciones y sincronizaciones comerciales conservan sus flujos web.
- La superficie v1 opera sobre los servicios Core de Facturom. No es un proxy genérico de ERPNext, de los importadores, ni de endpoints administrativos internos.
- Usuarios: solo consulta de miembros propios con autorización suficiente; no hay cambios de roles, membresías ni administración de claves mediante API key.

La fila comercial histórica de API no bloquea esta implementación. `apiKeyPlanPolicy` es el punto explícito para activar una política comercial futura. Se conserva `facturom-access.ts` y no se cambian precios ni planes. Los límites de productos, clientes, ventas y bodegas, bloqueos operativos y períodos contables siguen comprobándose.

## Pruebas y preparación de migración

```sh
npm run test:api
```

Sin base explícita ejecuta las pruebas unitarias y omite las de PostgreSQL. Para ejecutar las pruebas de persistencia se necesita una base local aislada cuyo nombre termine en `_test` y contenga el esquema actual:

```sh
FACTUROM_API_TEST_DATABASE_URL='postgresql://USUARIO@127.0.0.1:PUERTO/facturom_api_test' npm run test:api
```

El runner rechaza destinos externos. La migración aditiva es `prisma/migrations/20261109180000_add_integration_api_keys/migration.sql`. Se probó únicamente sobre PostgreSQL temporal, después del esquema previo con los cambios locales acumulados de pagos. No se ejecutaron migraciones en producción.

Antes de una subida conjunta autorizada, revisar el historial acumulado, las migraciones de transferencias y Paddle, el origen público HTTPS y los servicios SRI. Aplicar migraciones y desplegar requieren una fase posterior autorizada. El informe de entrega contiene los resultados y pendientes reales de calidad.
