# Centro tributario SRI: UX y auditoría funcional

Fecha: 19 de noviembre de 2026. Repositorio: `appsolux-dashboard`. Se revisaron pantallas, controladores, consultas, Prisma, importadores, trabajos de sincronización, validadores y generador existentes. No se ejecutaron consultas privadas al SRI, importaciones contra una base real, declaraciones, envíos, anulaciones, migraciones, commits, pushes ni despliegues.

## 1. Archivos de esta entrega

Modificados:

- `components/appsolux/sri-tax/tax-page.tsx`
- `components/appsolux/sri-tax/tax-center-client.tsx`
- `components/appsolux/sri-tax/received-documents-client.tsx`
- `components/appsolux/sri-tax/ats-report-client.tsx`
- `components/appsolux/sri-tax/tax-ui.tsx`
- `lib/core/sri-tax/received-documents.ts`
- `lib/core/sri-tax/api.ts` — exclusivamente control de descarga XSD y dependencia inyectable del validador para probar ese control.
- `lib/core/sri-tax/api.test.ts`
- `app/api/purchases/import-xml/route.ts`
- `package.json` — añade únicamente `test:sri-center-browser` a los scripts ya existentes.

Creados:

- `components/appsolux/sri-tax/tax-navigation.tsx`
- `components/appsolux/sri-tax/obligations-overview.tsx`
- `components/appsolux/sri-tax/tax-diagnostics.tsx`
- `components/appsolux/sri-tax/sri-center.module.css`
- `lib/core/sri-tax/ui-state.ts`
- `lib/core/sri-tax/received-import-input.ts`
- `lib/core/sri-tax/ui-review.test.ts`
- `scripts/sri/verify-center-browser.cjs`
- `docs/sri-center-ux-review.md`

Se conservaron los 41 archivos que ya tenían cambios al iniciar: su comparación SHA-256 solo detecta la adición del script en `package.json`. Los cambios de Clientes, Nueva factura, autenticación móvil, componentes animados y la migración anterior permanecen intactos. No se modificaron esquema Prisma, workers, credenciales, autenticación del portal SRI, inventario ni contabilidad.

## 2. Mejoras visuales y navegación

Las seis rutas originales se mantienen mediante enlaces reales: Resumen, Recibidos, ATS, Talón resumen, IVA 104 y Validaciones. La barra superior agrupa las opciones en una superficie continua con píldora fucsia animada, `aria-current`, foco visible, navegación con flechas/Inicio/Fin y desplazamiento horizontal. En móvil mantiene visible el enlace activo.

Se reutilizan `AnimatedSegmentedControl` en las vistas de recibidos y etapas ATS, `AnimatedFormPanel` para la transición de etapas y `BlobButton` en acciones destacadas. El switch de Clientes se conserva sin duplicarlo; estas pantallas no necesitan introducir un booleano nuevo. Las animaciones respetan reduced motion, incluidos los indicadores de trabajos dentro del Centro. No se añadieron dependencias.

El resumen prioriza fuente, empresa/RUC, período y obligaciones sin verificar; mantiene las métricas de ventas, compras, IVA y retenciones como información secundaria registrada en Facturom. La fecha visible de consulta local corresponde a la recepción de la respuesta y se etiqueta como tal, no como verificación del SRI.

## 3. Consultas de obligaciones que existen realmente

No se encontró un servicio, endpoint o modelo de obligaciones tributarias confirmadas del contribuyente, vencimientos oficiales o declaraciones cumplidas. `buildSriTaxSummary` resume documentos internos y estados del período; no consulta cumplimiento tributario autenticado. Las entidades `TreasuryObligation` corresponden a cuentas comerciales por cobrar/pagar y no se reutilizan como obligaciones SRI.

Por ello las cuatro tarjetas de vencidas, próximas, cumplidas y pendientes muestran **Sin verificar**, sin números inventados. El seguimiento muestra un estado vacío explicado. No se crean obligaciones IVA/ATS por inferencia de movimientos ni se muestra «Al día».

## 4. Datos e integración faltantes para obligaciones

Falta un contrato verificado con el portal autenticado que entregue obligaciones aplicables al tenant, periodicidad efectiva, vencimientos y evidencia de presentación/cumplimiento, junto con fuente y fecha de verificación. Tener credenciales o un trabajo de descarga de comprobantes no sustituye ese contrato. No se implementó un calendario normativo ni se asumió que la frecuencia elegida por el usuario demuestra una obligación mensual/semestral.

## 5. Estado del listado de recibidos

`listReceivedDocuments` sigue consultando `PurchaseInboxItem` no vinculado y `PurchaseDocument` del tenant, evitando duplicar un documento por su vínculo con la bandeja. Conserva filtros previos y paginación. Añade `view`, `counts` y fecha de autorización persistida:

| Vista | Criterio disponible en el modelo |
| --- | --- |
| Sin registrar | Bandeja sin compra vinculada y no excluida; compras DRAFT, NEEDS_REVIEW o REJECTED. Incluye una bandeja huérfana aunque su estado anterior diga REGISTERED. |
| Registradas | Compras REGISTERED o AUTHORIZED según su estado interno. Esto no verifica autorización vigente con el SRI. |
| Anuladas | Compras CANCELLED y bandeja IGNORED. Se identifican como cancelación/exclusión interna y muestran anulación SRI sin verificar. No existe evidencia oficial persistida para afirmar «anulado por el SRI». |

Los conteos son consultas de la base por tenant y respetan fechas, búsqueda, tipo, RUC, clave y estado aplicados; no se calculan a partir de la página visible. La clasificación por registro usa los estados disponibles de Compra, no una nueva validación fiscal o contable.

La tabla incluye las 13 columnas solicitadas, selección de filas por página, encabezados y scroll local. La fecha de autorización solo se muestra cuando está persistida en la compra. Receptor y retención indican «Sin información» porque el contrato actual del listado no conserva esos datos; no se inventan a partir del tenant activo. El menú por fila conserva Registrar/Ver compra/Clasificar/Excluir según las capacidades y estado existentes. El detalle muestra importes, identificación, fechas, origen y clave como datos locales.

`receivedAction(register)` ya usa transacción serializable, comprobación del vínculo y unicidad de compra por tenant/clave. Crea una compra NEEDS_REVIEW porque la bandeja no tiene el desglose fiscal completo. No se añadió otra vía para crear compras duplicadas.

No se implementó borrado. «Excluir de bandeja (local)» reutiliza el estado IGNORED existente, no anula el comprobante del proveedor. No se invocaron esas acciones contra datos reales.

## 6. Importaciones: funcionalidad y límites reales

**XML manual:** se conserva `/api/purchases/import-xml` y su importador. Se agregó una validación de entrada antes de persistir, sin modificar `purchase-xml-import.ts` ni sus cálculos:

- RUC válido de la empresa activa obligatorio, receptor coincidente y emisor válido. Antes se omitía comprobar el receptor cuando faltaba el RUC del tenant o el del archivo.
- Límite de 4 MB en archivo/JSON y comprobación del tipo de entrada.
- Clave de 49 dígitos con módulo 11 mediante el algoritmo existente; emisor, tipo, número y fecha coherentes con ella.
- Tipo soportado por el parser existente, campos básicos presentes e importes finitos/no negativos.
- Rechazo de DTD/entidades y de una autorización declarada en el archivo que sea negativa, incompleta o corresponda a otra clave; reutiliza `parseSoapResponse`, sin llamar al SOAP remoto.

Esto **no sustituye validación completa de XML/XSD de comprobantes, firma digital o autorización vigente ante el SRI**. La respuesta identifica `authorizationVerification: NOT_PERFORMED` y `reviewRequired: true`. La UI informa importados/repetidos/rechazados/revisión pendiente, sin tratar un fallo de conexión como una importación confirmada. Revisión pendiente es un subconjunto de importados y una necesidad de revisión manual, no un cambio del estado persistido.

El importador existente crea una `PurchaseDocument` y su bandeja vinculada, deduplica por tenant/clave y no crea por sí mismo asientos de diario ni movimientos de inventario. Sin embargo, asigna AUTHORIZED por presencia de clave y copia esa clave a `authorizationNumber`: ese estado local no prueba autorización oficial. La UI lo distingue. También se identificó que el parser captura base al 5 %, mientras la persistencia existente no expone una columna equivalente; revisar ese recorrido requiere una fase fiscal separada. No se cambiaron bases, tarifas o importes en esta entrega.

**TXT:** existe parser tabulado SRI y contrato en `/api/purchases/txt-import`, con límite de 50 filas, deduplicación y recuperación de XML mediante el SOAP existente. Se ofrece un enlace claro al flujo de Compras, sin añadir otro parser ni formatos. La guardia nueva aplica a la ruta manual XML, no modifica TXT, importaciones internas o workers; esas otras entradas requieren revisar por separado la suficiencia de comprobación del receptor, autorización e integridad.

**XML original e impresión:** existen campos `xmlPath`, `ridePath` y `xmlStorageKey`, pero los importadores inspeccionados no conservan el original mediante una ruta autorizada de lectura disponible en el Centro. No hay una representación de impresión verificada conectada al listado. Sus acciones aparecen deshabilitadas y explicadas; no se reconstruye XML desde totales ni se expone un path privado como URL.

## 7. Sincronización de compras

Se mantienen el botón y `/api/purchases/sri-sync/run`. El servidor existente exige credencial VERIFIED y crea/reutiliza un trabajo; eso no demuestra que la descarga haya terminado. La UI conserva el botón visible, explica la falta de configuración y lo deshabilita durante un trabajo activo.

Se reutilizan `useSyncJobs` y `SyncProgressCard` para leer los trabajos almacenados y mostrar en proceso, finalizado, error, documentos encontrados/importados/repetidos/fallidos, fechas y mensajes del trabajo. La configuración de descarga y la fecha de sincronización se distinguen del resultado del trabajo. Un error de lectura no se convierte en «sin documentos» ni en éxito.

No se alteraron las consultas a SRI del worker, adaptadores, autenticación, reintentos o configuración. El adaptador de servidor delega la descarga al worker. No se verificaron credenciales ni una sincronización real contra el portal: ese es el bloqueo de validación funcional externa, que no se oculta con las pruebas de UI.

## 8. Motivo exacto de «Generar ATS» y correcciones

Había dos problemas diferentes:

1. El botón superior solo hacía `setPeriod` con la misma selección. El recurso dependía de una URL estable y la clave del componente era el mismo período; repetir la acción podía no hacer otra petición. Tampoco existía una separación clara entre consulta, validación y XML.
2. El backend bloquea deliberadamente los períodos con transacciones mediante `ATS_CATALOG_MAPPING_PENDING`. El repositorio tampoco dispone aún de la clasificación fiscal completa. Otros diagnósticos, como `FISCAL_CLASSIFICATION_MISSING`, pueden bloquear; `RECEIVED_WITHHOLDINGS_UNAVAILABLE` conserva su severidad original. Un resumen HTTP 200 con esos diagnósticos no significa que el XML esté listo.

Ahora Preparar actualiza el período con una revisión explícita; Generar vuelve a solicitar la vista previa existente y muestra un resultado: bloqueado, pendiente, con advertencias, correcto o error real. Las etapas Preparar/Revisar/Generar separan resumen, documentos/diagnósticos y requisitos/descargas. Los errores HTTP, `{ok:false}` y errores dentro de HTTP 200 son visibles; una respuesta JSON no se guarda como falso PDF/XML.

La descarga requiere validación de dominio correcta, ausencia de errores bloqueantes, XML generado y XSD validado. Se detectó y cerró también una brecha del controlador: antes el endpoint directo permitía XSD pendiente; ahora devuelve 422 sin adjunto cuando XSD está pendiente o falla. Este cambio controla la respuesta HTTP usando el validador existente; no modifica el generador, las reglas tributarias ni sus diagnósticos.

El PDF se identifica como **resumen local**, independiente del XML. No se afirma presentación ni aceptación del SRI. Los diagnósticos se agrupan en errores, advertencias e información, con totales y siguiente acción; el detalle expandible conserva códigos, documentos, descripciones, acciones y enlaces originales, incluida su paginación.

## 9. Esquema y catálogo ATS: contraste oficial

La [página oficial de Anexos y guías del SRI](https://www.sri.gob.ec/formularios-e-instructivos1), consultada en esta revisión, publica ATS **1.19.0**, actualizado el 23/09/2026 para períodos desde septiembre de 2026, catálogo con fecha 06/08/2026, ficha técnica con fecha 07/02/2025 y enlace al esquema. Se usó la página canónica consultada directamente, no un resultado de búsqueda antiguo que aún mostraba 1.18.0.

- [Ficha técnica ATS](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/72d717c2-88ed-47b7-baba-50b87b7198b7/Ficha%20Tecnica%20Transaccional%20Simplificado%20ATS.pdf): revisada como documentación de estructura y requisitos; no se transcribieron calendarios al código.
- [Catálogo ATS publicado](https://www.sri.gob.ec/o/sri-portlet-biblioteca-alfresco-internet/descargar/e6a826af-b22c-40bb-8752-d711f293b8f9/Catalogo_ATS.xls): descarga correcta, XLS de 3 823 616 bytes, SHA-256 `bd3f7834f2cd31187af39cd2f4c685a646d7e49316e92ee493da5f2dd9776e3e`. Descargarlo no verifica ni implementa equivalencias tributarias en el motor.
- [Esquema oficial ATS](https://descargas.sri.gob.ec/download/anexos/ats/ats.xsd): descarga de 70 379 bytes, SHA-256 `4756fe58c139aff5073137ca3b2e66f7a6a55b096861c682b007d5f99b276a9a`. El recurso local tiene SHA-256 `5d4804b9ede4e637ccc1ffb3f5e22d75abaa4b87e8de67ca399c5eaaafd2bbaf` y coincide al normalizar exclusivamente espacios finales y saltos de línea. No se reemplazó.

`ats-xml.ts` únicamente serializa la estructura técnica del período sin transacciones; rechaza períodos con información hasta completar el mapeo oficial. La versión del programa no es un atributo inventado del XML.

La ficha describe `numEstabRuc` como obligatorio, mientras el XSD publicado lo admite con `minOccurs=0` y el serializador mínimo actual no lo incluye. Esto muestra por qué pasar XSD no basta para afirmar cumplimiento funcional del anexo. El contraste con campos, periodicidad, catálogo y período debe cerrarse manualmente antes de ampliar el generador. `xmllint` está disponible y se ejecutó localmente en las pruebas técnicas; no se presupone instalado en producción.

## 10. Validaciones pendientes

- Confirmar obligaciones y frecuencia aplicables mediante una fuente autorizada, no por operaciones registradas o una selección visual.
- Homologar catálogo ATS por período y completar sustentos, clasificación fiscal, partes relacionadas, retenciones recibidas/emitidas y documentos modificados/cancelados.
- Verificar reglas semánticas que el XSD no exige, incluido el informante y datos de establecimientos.
- Validar end-to-end parser, firma, autorización, ambiente y almacenamiento del XML recibido; revisar todos los puntos de entrada, incluida la base al 5 % y la persistencia de fechas/receptor/retenciones.
- Probar despliegue real del validador XSD. Su ausencia bloquea la descarga; no se oculta como validación correcta.
- Verificar worker y portal autenticado con una empresa de prueba autorizada, sin confundir estados guardados con evidencia externa.

## 11. Multitenant y autorización

`handleTaxRequest` obtiene usuario y tenant del servidor; no utiliza `tenantId`, RUC o razón social del navegador para elegir el informante. `loadTaxSnapshot` filtra perfil, emitidos, compras, bandeja y autorizaciones por tenant. `assertTaxScope` rechaza documentos/bandeja ajenos. La descarga utiliza el mismo conjunto del período y el RUC del perfil autorizado, tanto para XML como para nombre del archivo.

Se probó que parámetros maliciosos no cambien el contexto y que un XML técnico sin transacciones conserve el RUC autorizado, usando sesión/datos de prueba y el generador existente. También se prueban aislamiento en conteos y acciones de recibidos y la protección de receptor en importación manual.

La referencia a un ATS de BIONVERS SAS frente a una captura de otra empresa no demuestra una fuga. En esta ejecución solo se adjuntó el encargo de texto, no ese XML para cotejar su contenido real. La revisión de código no encontró selección del informante por parámetros del cliente. Sigue pendiente una prueba de integración con dos tenants reales de staging y el archivo de referencia, sin usar producción.

La autorización actual de los endpoints del Centro usa sesión y tenant. No existe una política granular específica de roles para todas sus acciones; los flags del listado representan estado/capacidad del registro. No se cambió la matriz de permisos ni se presenta esa política como implementada. Debe revisarse por separado la autorización fina de importación, clasificación, exclusión y exportación.

## 12. Pruebas y evidencia

| Comando / revisión | Resultado real |
| --- | --- |
| `npm run test:sri-tax` | 56/56 pruebas. Incluyen las existentes y las nuevas de vistas/conteos/filtros/paginación, diagnósticos, descarga bloqueada por XSD, precondiciones XML, receptor obligatorio y RUC autorizado en el XML. |
| `NODE_OPTIONS=--conditions=react-server npx tsx --test lib/core/sri-received-import.test.ts` | 110/110 pruebas existentes de parser/importación y contratos. |
| `npm run test:sri-regressions` | 11/11 pruebas existentes de regresión de sincronización y UI. |
| `npm run test:sri-center-browser` | 11/11 comprobaciones aisladas: navegación, resumen sin falsas obligaciones, 13 columnas, filtros/paginación/contadores, acciones, importación comunicada, estados de trabajo, ATS, errores HTTP/200/descarga, período, responsive 320/390/768/1440 px, reduced motion, teclado y ausencia de errores de hidratación/JS. |
| `npx tsc --noEmit` | Correcto. |
| ESLint de los archivos TS/TSX/CJS de esta fase | Sin errores ni advertencias. La inspección inicial de las pantallas originales tampoco registró problemas en esos archivos. |
| `npm run build -- --webpack` | Compilación correcta con 385 páginas; se utiliza el mismo comando verificado en la fase anterior. |
| `git diff --check`, inspección de capturas y comparación de archivos previos | Correctos; los cambios anteriores permanecen intactos. |

**Alcance de las pruebas:** Prisma/sesiones/HTTP se simulan donde corresponde; el navegador usa componentes y estilos reales con fixtures. Se prueban localmente generación técnica y validación XSD donde lo indican los tests. No son pruebas reales del portal SRI, ni de sincronización remota, ni validación contra una base PostgreSQL operativa. Ninguna solicitud de sincronización fue ejecutada por el navegador de prueba. Playwright y Chrome se usaron desde las herramientas existentes; no se instalaron dependencias en el proyecto.

## 13. Cambios tributarios que requieren validación manual

La integración de obligaciones, autenticación/descarga del portal, nuevo mapeo o ampliación del generador ATS, reglas de periodicidad y fechas, conservación/validación de XML, semántica de autorizaciones/anulaciones y correcciones de bases/impuestos quedan para fases autorizadas y validadas. No se alteraron `ats-data.ts`, `ats-xml.ts`, `ats-validation.ts`, `tax-validations.ts`, cálculos IVA, parser fiscal de Compras o workers. No se realizó presentación de anexos ni se generó evidencia ficticia de aceptación.
