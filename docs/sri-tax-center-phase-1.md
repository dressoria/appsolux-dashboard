# SRI Tax Center — fase 1

Implementación sobre el working tree existente de `master`, sin commits, push, deploy, migraciones ni modificaciones al schema Prisma. No se modificó Purchase SRI Sync, firma, autorización ni emisión.

## Navegación y configuración (puntos 1–5)

Antes, SRI agrupaba Comprobantes electrónicos, Configuración SRI, Firma electrónica, Secuenciales, Establecimientos y Puntos de emisión.

Ahora el sidebar y la navegación del centro usan `config/sri-tax-navigation.ts`:

1. Resumen tributario — `/facturacion/sri`.
2. Comprobantes recibidos — `/facturacion/sri/received`.
3. Anexo Transaccional (ATS) — `/facturacion/sri/ats`.
4. Talón resumen ATS — `/facturacion/sri/ats/summary`.
5. Reporte IVA 104 — `/facturacion/sri/iva-104`.
6. Validaciones tributarias — `/facturacion/sri/validations`.

Empresa → Configuración conserva sus ajustes actuales y reemplaza el tab Firma por SRI. Contiene accesos a datos fiscales, firma, establecimientos, puntos de emisión, secuenciales, ambiente y automatización. `/facturacion/configuration/sri` reutiliza el centro de preparación existente de `/sri`; no reproduce ni modifica su lógica.

Todas las rutas legacy `/facturacion/sri/{company,signature,establishments,issue-points,sequences,environment}` y `/sri/...` se conservan. Las pantallas de configuración ofrecen navegación de regreso a Empresa → Configuración. Comprobantes electrónicos continúa accesible en Transacciones → Ventas.

La nueva landing muestra accesos a los cinco módulos y el resumen del período: ventas y compras netas registradas, IVA registrado, crédito potencial, retenciones emitidas, retenciones recibidas desconocidas, problemas y estado del período. Los ceros de agregados representan ausencia de registros locales, no certeza de ausencia de transacciones ante SRI.

## Recibidos y Purchase Sync (puntos 6–7)

`received-documents.ts` consulta PurchaseInboxItem y PurchaseDocument. Las compras vinculadas a la bandeja aparecen una sola vez. Hay filtros Desde/Hasta, tipo, estado, emisor/documento, RUC, clave; tipos derivados de los registros existentes; paginación; tabla responsive con importes y origen.

Acciones implementadas:

- Importar XML mediante el endpoint existente de Compras.
- Sincronizar ahora mediante el endpoint existente, cuando hay credenciales verificadas y no hay trabajo activo.
- Ver compra registrada o por revisar.
- Clasificar contablemente, verificando que la categoría pertenece al tenant.
- Ignorar exclusivamente elementos pendientes no vinculados.
- Crear una compra desde un elemento pendiente. Como Inbox no almacena bases por tarifa ni autorización verificada, esta compra queda `NEEDS_REVIEW`, conserva en notas la base agregada original y queda excluida de reportes definitivos. Su base original sigue visible en Recibidos. No se distribuye automáticamente entre tarifas.

Limitación explícita: los importadores actuales no conservan XML recibido en un almacenamiento accesible. No se ofrece una descarga ficticia ni se reconstruye un XML desde totales. Tampoco se implementó un adaptador de storage nuevo para el worker concurrente.

El estado se obtiene mediante `getSyncStatus()` de Compras. Se muestran disponibilidad, activo/pendiente/error y fechas. Solo errores Prisma de tablas/columnas opcionales ausentes se convierten en estado pendiente; errores de conexión se conservan como errores. No se implementó robot, credenciales, jobs ni worker.

## ATS, fuente única, XML y Talón (puntos 8–13)

`buildAtsPeriodData(snapshot)` es la fuente única de preview, totales, XML, validaciones ATS y Talón. Incluye facturas/notas autorizadas de producción, compras registradas/autorizadas, retenciones emitidas autorizadas y cancelados registrados para revisión. Excluye borradores, rechazados, pendientes y ambiente de pruebas de transacciones definitivas. Las notas de crédito restan; no se modifican los originales.

La UI admite mensual y semestral. No se deduce una obligación tributaria desde un régimen ambiguo. El semestre usa junio/diciembre y límites de fecha de Ecuador. Parámetros inválidos/futuros fallan antes de consultar datos.

Se comprueban RUC, tercero, identificación, autorización, número de documento, clave y dígito verificador, correspondencia con fecha/RUC/tipo/ambiente/número, bases/IVA, retenciones, pendientes y duplicados. Las observaciones tienen severidad, documento, explicación, acción y enlace cuando existe.

**Limitación sustantiva: ATS con transacciones NO está listo para exportación.** No se pudo descargar el catálogo vigente; además faltan sustentos ATS y clasificaciones/relaciones fiscales completas en la persistencia actual. La descarga responde 422 con `ATS_CATALOG_MAPPING_PENDING`. No se inventaron códigos ni se omitieron registros para producir un archivo aparentemente válido.

El generador XML implementa la cabecera conforme al orden del XSD y serialización de períodos sin transacciones: escape de caracteres XML, rechazo de controles inválidos y dinero a dos decimales. No incluye `version="1.19.0"`. El estado separa `DOMAIN_VALIDATION_OK/ERROR`, `XML_GENERATED/NOT_GENERATED` y `XSD_VALIDATED/VALIDATION_ERROR/VALIDATION_PENDING`. Un período vacío puede generar un XML técnico; el aviso de falta de información permanece visible.

Se incluye el esquema descargado del SRI y se ejecuta xmllint cuando está disponible. Se comprobó `XSD_VALIDATED` para una muestra vacía y rechazo de una muestra estructuralmente inválida. Para períodos bloqueados no se genera XML ni se ejecuta XSD: `XSD_VALIDATION_PENDING`. La disponibilidad del ejecutable en otro entorno se informa en tiempo de ejecución; no se certifica su instalación.

El Talón muestra empresa, RUC, período, frecuencia, registros, bases, IVA, retenciones emitidas, cancelados y ambos estados de validación. Descarga un PDF de Facturom desde los mismos totales. Incluye el pie solicitado. No es un Talón oficial ni un comprobante de presentación.

## IVA 104 (puntos 14–18)

`buildIva104Report()` concentra cálculos fuera de React. Presenta secciones de ventas, compras/gastos, impuesto y operaciones por clasificar; bruto/neto/IVA; separación informativa por tasas históricas; notas de crédito con signo negativo; PDF y XLSX reales. Ambos exports preservan valores del servicio y datos manuales, y se identifican como apoyo ESTIMADO.

Las clasificaciones siguientes están verificadas contra la guía oficial y requieren selección explícita del usuario en este formulario; no se infieren por IVA, proveedor ni nombre de categoría contable:

| Clasificación | Casilleros |
| --- | --- |
| Venta local gravada, excluye activos fijos | 401 / 411 / 421 |
| Venta de activos fijos gravada | 402 / 412 / 422 |
| Venta local 0% sin derecho a crédito | 403 / 413 |
| Venta local 0% con derecho a crédito | 405 / 415 |
| Exportaciones bienes | 407 / 417 |
| Exportaciones servicios/derechos | 408 / 418 |
| Compra local gravada con derecho a crédito, excluye activos fijos | 500 / 510 / 520 |
| Activo fijo gravado con derecho a crédito | 501 / 511 / 521 |
| Compra gravada sin derecho a crédito | 502 / 512 / 522 |
| Compra 0% | 507 / 517 |
| Compra no objeto IVA | 531 / 541 |
| Compra exenta | 532 / 542 |

Los grupos gravados anteriores admiten tasas históricas almacenadas 12/14/15; no reescriben históricos ni aplican una tasa actual. Operaciones mixtas y tarifas diferenciadas se conservan por clasificar, porque requieren clasificación por línea o tratamiento específico. Las compras del campo histórico `subtotal15` no se consideran automáticamente al 15%: las tasas vienen de sus items.

Saldos manuales temporales: 605 (compras anterior), 606 (retenciones anterior), 564 (crédito aplicable revisado). Vacío significa desconocido; un cero ingresado explícitamente se conserva. El crédito aplicable no puede superar el potencial de compras clasificadas. La categoría/deducibilidad de renta no se utiliza como prueba de derecho a crédito IVA. Los valores y clasificaciones viven en estado de formulario y se incluyen al exportar; se reinician al cambiar período/salir.

601 se muestra como estimación basada en IVA registrado menos crédito aplicable confirmado. 609 permanece desconocido porque no existe un modelo que permita obtener IVA de retenciones recibidas registradas. El subtotal parcial excluye retenciones/ajustes desconocidos y se etiqueta así; subtotal a pagar, saldo siguiente y total estimado permanecen no disponibles. No se completa una declaración ni se asume que otros ajustes son cero.

La completitud indica la proporción de siete controles completados: clasificación, pendientes/fechas, errores, saldos, crédito, disponibilidad de retenciones recibidas e información registrada. No es una probabilidad ni certificación. El control de retenciones recibidas permanece pendiente en esta fase.

Casilleros pendientes de clasificación/reglas: 404/414, 406/416, 410/420/430, 425/435/445, 423, 424, 431/441, 499, 530/533/534, 540/550/560, 503/513/523, 504/514/524, 505/515/525, 506/516, 508/518, 526, 527, 615, 617, 620 y 699. Totales de documentos registrados se muestran como agregados informativos y no se hacen pasar por casilleros oficiales completos.

## Validaciones y APIs (puntos 19–22)

- GET `/api/sri-tax/summary`.
- GET `/api/sri-tax/received` y POST para register/ignore/classify.
- GET `/api/sri-tax/ats/preview`.
- GET `/api/sri-tax/ats/xml`.
- GET `/api/sri-tax/ats/summary`; `format=pdf` exporta el resumen.
- POST `/api/sri-tax/iva-104`; `format=json|pdf|xlsx`, `manualInputs`.
- GET `/api/sri-tax/validations`; período, severidad y tipo.

Todos resuelven usuario y tenant de sesión. `tenantId` del frontend se ignora. Cada consulta raíz incluye tenantId; relaciones de proveedor/establecimiento/punto se comprueban antes de incorporar sus datos. Los datos normalizados rechazan mezclas de tenants. Las acciones verifican estado y tenant; registro se ejecuta en transacción serializable con protección de duplicados. Las respuestas privadas usan `Cache-Control: private, no-store`.

Los cálculos monetarios usan Prisma.Decimal y ROUND_HALF_UP a dos decimales; React recibe strings. Se reutilizan las funciones existentes de fechas Ecuador y módulo 11 sin modificarlas.

## Verificación (puntos 23–26)

Comandos y resultados finales se registran al terminar la tarea:

- `npx prisma generate`: correcto; únicamente generación del cliente.
- `npx tsc --noEmit`: correcto.
- ESLint de servicios, APIs, navegación y componentes nuevos: correcto.
- `npm run test:sri-tax`: 45/45 correctos. Cubren navegación, legacy, aislamiento en repositorio/API, sesión, parámetros maliciosos, decimales, tasas históricas, notas de crédito, clasificación, unknown/zero, XSD real/pendiente, duplicados, filtros, acciones y contenido PDF/XLSX.
- Regresiones de Compras, recibos/importaciones, documentos SRI, RIDE y regímenes: 97/99. Fallos en archivos no modificados por esta tarea: `AA-cred – maskUsername masks middle characters` (expectativa de máscara distinta a la función actual) y `RIDE — FACTUROM COM not Appsolux` (busca texto literal en los bytes de un PDF). No se alteró el trabajo de credenciales ni RIDE para cambiar esas expectativas.
- `npm run build`: correcto; warnings de tracing de filesystem en módulos existentes de storage.
- `git diff --check`: correcto. También se revisa whitespace de archivos nuevos.
- Hash SHA-256 del schema antes/después: `d73dc963ec2106e7a98d9657f70e0dd4883ce2b1a98030abb81c6949a34b4d0b`.
- Sin prueba contra una base real migrada ni sesión real del navegador; las pruebas de APIs/repositorio usan fixtures aislados. No se ejecutaron migraciones ni se enviaron anexos/declaraciones al SRI.

## Pendientes expresos (punto 27)

- `ATS_CATALOG_MAPPING_PENDING`: catálogo no descargado/verificado, sustentos y datos obligatorios incompletos; XML con transacciones bloqueado.
- `XSD_VALIDATION_PENDING`: no ejecutado sobre períodos bloqueados, o si falta xmllint en el entorno. La muestra técnica vacía sí fue validada.
- `PERSISTENCE_EXTENSION_RECOMMENDED`: persistencia de clasificaciones fiscales por documento/línea, sustento ATS, relación de notas de crédito, retenciones recibidas y conservación accesible de XML. No se creó ningún modelo/campo/migración. Los saldos manuales temporales sí funcionan sin persistencia adicional.

Referencias y hashes del XSD: `lib/core/sri-tax/resources/README.md`.
