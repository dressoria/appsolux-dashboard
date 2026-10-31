# Ventas SRI: estabilización y presentación — 31/10/2026

## Resultado y alcance

Corrección implementada y probada automáticamente sobre dashboard `6af0452` y worker de ventas `2fa73ba`. No se reconstruyó Keycloak, SSO, formulario JSF, TXT ni el transformador de contraseña. Las pruebas anteriores del conector se conservan y pasan.

No se modificaron el módulo, las páginas ni el worker de compras, ni el firmador. La API y el servicio compartidos de credenciales se tocaron exclusivamente para conservar configuraciones sin cambios y permitir que la configuración central elija explícitamente la verificación de ventas. El cliente de compras que no envía ese selector conserva su ruta de verificación anterior, comprobada por test.

No se modificaron credenciales reales, documentos existentes ni checkpoints reales. No se ejecutaron migraciones, importaciones históricas, push ni deploy. No hay una verificación nueva con SRI real en esta sesión.

## 1. Causa y corrección de RECHAZADA

`downloadXmlBySoap()` convertía cualquier `authorized=false`, también `status=RECHAZADA`, en `SRI_DOWNLOAD_FAILED`. `handleSyncDocuments()` contaba esa excepción como fallo del día, la envolvía en `INTERNAL_IMPORT_FAILED` y detenía el período. Por eso un rechazo definitivo frenaba comprobantes posteriores y futuras fechas.

Ahora una autorización SOAP estructurada y definitiva `RECHAZADA` genera `SriDocumentRejectedError`/`SRI_DOCUMENT_REJECTED`. El worker registra `REJECTED`, estado y motivo de omisión, incrementa `documentsRejected` y continúa. No se envía ese comprobante a la API de importación ni se crea una venta, asiento o movimiento de inventario.

Los estados `AUTORIZADO` y `AUTORIZADA` requieren XML válido. `PENDIENTE`, `EN PROCESO`, respuestas incompletas, Fault, HTML y errores HTTP siguen siendo fallos técnicos. Una respuesta ambigua que mezcla rechazo y estado pendiente no se considera rechazo definitivo. Un texto que contiene «RECHAZADA» no basta por sí solo.

La tabla nueva `SalesSriSyncDocument` tiene una fila por job y clave, con tenant, fecha consultada, resultado, estado SRI y motivo. Las claves completas permanecen en persistencia del servidor; el log solo incluye una versión enmascarada. El rechazo confirmado se reutiliza entre trabajos del mismo tenant, evitando otra descarga SOAP de esa clave. Las clasificaciones finales del mismo job no vuelven a importarse; los errores y pendientes se pueden reevaluar.

Los contadores se separan en encontrados, importados, duplicados, rechazados/omitidos y errores técnicos. Los reintentos nuevos se contabilizan por clave y resultado persistido, sin sumar repetidamente intentos fallidos.

## 2. Checkpoint, reanudación y concurrencia

- «Sincronizar ahora» reutiliza un histórico recuperable antes de crear otro. Cuando corresponde, la acción principal cambia a «Reanudar sincronización», sin dos botones equivalentes.
- Se reencola el mismo job, conservando identificador, período, checkpoint, `totalDays`, `completedDays` y documentos. Se amplía su presupuesto de intentos sin poner `attemptCount` a cero.
- Se registra en `attemptHistory` el estado y error anterior al reanudar; el error activo se limpia. La historia no se elimina.
- Un día avanza solo después de clasificar todos sus comprobantes. Un rechazo definitivo cuenta como tratado; un error técnico deja el día pendiente.
- Los productores de ventas (API manual, reanudación, verificación y scheduler) comparten un advisory lock por tenant. Una solicitud concurrente devuelve el trabajo ya activo.
- El worker mantiene un heartbeat de 30 segundos y comprueba propietario e intento antes de importar o persistir progreso. Un proceso antiguo pierde el derecho a continuar al recuperarse el job.
- Un RUNNING sin actividad durante 15 minutos se presenta como interrumpido y recuperable. Una verificación huérfana puede finalizarse como interrumpida sin invalidar credenciales.
- Un índice parcial único de RUNNING por tenant refuerza la exclusión en PostgreSQL, incluso ante filas QUEUED antiguas duplicadas. No se deduplican ni borran jobs existentes para instalarlo.
- Tras terminar el histórico, la siguiente consulta parte del `dateTo` realmente cubierto por el último job exitoso, con un día de solapamiento. No toma la fecha de finalización del proceso como si fuera la cobertura fiscal ni vuelve al 1 de enero diariamente.
- La API devuelve el trabajo activo y el mejor candidato de reanudación aunque no aparezcan en la primera página del historial. Los resultados se ordenan por última actividad, evitando que un fallo creado después oculte un histórico más antiguo que acaba de reanudarse y terminar correctamente.

Prueba específica del estado reportado: checkpoint 27/01, 27/304 días y tres errores anteriores; consulta primero 28/01, clasifica tres rechazos y un autorizado, guarda 28/304 y consulta después 29/01. Se utiliza un fallo controlado en el 29/01 para detener ese test sin recorrer el resto del año.

## 3. Credenciales: causas y separación de estados

Había tres fuentes comprobables de inestabilidad real o aparente:

1. La verificación explícita marcaba `ERROR` ante red, consulta o infraestructura, aunque la contraseña no se hubiera rechazado.
2. Cada guardado volvía a cifrar y hacía upsert a `PENDING_VERIFICATION`, borrando `verifiedAt`, incluso con el mismo usuario, contraseña e identificación adicional.
3. La pantalla combinaba `config.lastError`, el error del job y el estado de credenciales. Un fallo antiguo podía aparecer varias veces y parecer un problema de contraseña.

Ahora el worker de ventas solo marca `INVALID` cuando recibe `INVALID_CREDENTIALS` con evidencia de rechazo de autenticación. Un rechazo documental, descarga fallida, sesión expirada, CAPTCHA o consulta JSF no invalida la configuración guardada. Los fallos técnicos se registran en el job y, en una verificación explícita, en el último intento, conservando estado y fecha de verificación previa.

`lastVerificationAt` corresponde a la acción explícita de verificar; una sesión normal de sincronización no lo actualiza constantemente. La primera autenticación válida puede establecer `verifiedAt`; las sesiones posteriores conservan esa fecha y la verificación explícita exitosa sí la actualiza. Un éxito limpia el error activo que ya no corresponde.

El guardado compara los datos en el servidor, conservando cifrado, fechas y estado si no cambiaron. La comparación de contraseña utiliza resúmenes de longitud fija y timingSafeEqual; no se persisten ni se devuelven esos resúmenes. Omitir la identificación adicional conserva la existente; enviarla explícitamente vacía permite quitarla. AES-256-GCM se mantiene.

Las escrituras de estado del worker incluyen una condición sobre el cifrado que leyó. Una sesión iniciada con una credencial antigua no puede invalidar una contraseña que el usuario acaba de cambiar.

La configuración central envía `verificationTarget: sales` al guardar cambios. Los GET de configuración y progreso nunca crean verificaciones; el polling de una verificación pendiente solo lee estado. «Verificar conexión de ventas» queda como diagnóstico opcional en Configuración SRI. No hay un formulario duplicado de contraseñas en la pantalla de importación.

## 4. Nueva interfaz verificable

La pantalla conserva Consolidado, Importar archivo e Importación automática. La última muestra:

- Título «Importación automática de ventas» y la descripción solicitada.
- Acción principal azul Facturom #1E52F1: Sincronizar ahora o Reanudar sincronización según el estado real.
- Botones secundarios con iconos: Configuración SRI (abre `?tab=sri`) y Ver historial.
- Una franja compacta que separa «Credenciales configuradas» de la sesión actual. Solo una invalidación confirmada muestra «Credenciales inválidas».
- Una tarjeta de progreso con porcentaje real o indeterminado, días, fecha actual, checkpoint y cinco contadores independientes.
- Resultado compacto y explicación comprensible al detenerse. Códigos completos y errores anteriores quedan dentro de «Ver detalles» o el historial.
- Programación automática y otras integraciones por API en áreas plegables secundarias. Se preserva la integración API existente.

No se muestra el `lastError` antiguo de configuración en varias tarjetas. Un job nuevo conserva su propio error real. El historial mantiene los errores anteriores en detalles por trabajo, sin una lista adicional enorme repitiéndolos.

Vistas estáticas con datos de prueba, generadas por React y el CSS del build:

- `appsolux-secure/sri-sales-stability-20261031/preview/en-progreso.html`
- `appsolux-secure/sri-sales-stability-20261031/preview/reanudar.html`

Son ejemplos visuales claramente rotulados, no capturas ni resultados de producción. Se regeneran con `npx tsx scripts/render-sales-sync-preview.ts <directorio-nuevo>`. Los tests comprueban el HTML renderizado, etiquetas, progreso, contadores y destinos de botones. No se ejecutó un navegador autenticado en esta sesión.

## 5. Migración y validación segura

`20261031700000_sales_sri_document_outcomes` añade columnas y la tabla de resultados. Se ejecuta dentro de una transacción. No borra historial, credenciales, documentos ni checkpoints.

Antes de aplicarla, comprobar en privado que no existe más de un RUNNING por tenant:

```sql
SELECT "tenantId", count(*) FROM "SalesSriSyncJob"
WHERE status = 'RUNNING' GROUP BY "tenantId" HAVING count(*) > 1;
```

Si devuelve filas, reconciliar sus procesos y estados con evidencia; no borrarlos ni resetearlos automáticamente. El índice único abortaría la migración sin cambios parciales. Este índice parcial se mantiene en SQL porque Prisma no lo representa como un `@@unique` ordinario.

Tras autorización de despliegue: aplicar primero la migración y verificarla, después activar el worker y dashboard compatibles. No permitir que un worker anterior que desconoce el heartbeat siga procesando al probar una recuperación. Conservar los respaldos Ubuntu y comparar cualquier modificación funcional local antes de integrar los commits. No se hizo nada de esto sobre producción durante esta sesión.

Para la comprobación real controlada de clasificación, en el checkout candidato de ventas en Ubuntu:

```bash
bash scripts/verify-sri-sales-readonly.sh --classify --from 2026-01-28 --to 2026-01-29
```

El comando toma las credenciales existentes de forma segura, utiliza PostgreSQL READ ONLY únicamente para leerlas y cierra la transacción antes de conectar al SRI. Consulta TXT y XML sin crear jobs ni importar documentos. Admite como máximo tres días y veinte comprobantes para clasificación. Un fallo técnico sale con error. Conserva el modo TXT original del 17/10 al ejecutarse sin argumentos.

No usar la acción normal de sincronización como prueba limitada: esa acción autoriza la reanudación del histórico completo. La importación PostgreSQL real de un comprobante autorizado sigue requiriendo una validación separada y expresamente controlada; el comando anterior deliberadamente no escribe.

## 6. Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| Worker ventas `npm test` | 194 aprobados |
| Dashboard `test:sri-sales-stability` | 13 aprobados |
| Dashboard `test:sri-regressions` | 11 aprobados |
| Dashboard `test:sri-final` | 54 aprobados |
| Suites existentes de ventas, importaciones y compatibilidad de compras | 319 aprobados |
| Worker compras, sin cambios, `npm test` | 50 aprobados; 1 live omitido |
| TypeScript y builds de ventas y dashboard | Correctos |
| ESLint de archivos modificados | Correcto |
| Generación Prisma y sintaxis shell | Correctas |

Total: 641 tests aprobados y un live omitido. Los tests de portal utilizan fixtures; la persistencia usa adaptadores SQL/Prisma de prueba. Incluyen tres rechazos más un autorizado, continuación de fechas, reintento sin repetir rechazos/importaciones, caso 27/304, pérdida de propiedad de un worker viejo, autenticación confirmada frente a fallos técnicos, guardado sin cambios, aislamiento por tenant, concurrencia de solicitudes, reanudación e incremental, recarga sin verificaciones, ausencia de secretos, HTML de interfaz y compatibilidad del flujo compartido de compras.

## 7. Archivos modificados

Dashboard:

- `app/api/sales-import/auto-sync/route.ts`
- `app/api/sales-import/sync-jobs/route.ts`
- `app/facturacion/sales/imports/sales-import-client.tsx`
- `app/facturacion/sales/imports/sync-history/sync-history-client.tsx`
- `components/appsolux/sri-tax/sales-automatic-sync-view.tsx` (nuevo)
- `components/appsolux/sri-tax/sync-progress-card.tsx` (variante de ventas; render de compras conservado)
- `components/appsolux/sri-tax/use-sync-jobs.ts` (metadatos opcionales de ventas; compras conserva su respuesta anterior)
- `components/appsolux/sri-tax/sri-credentials-section.tsx`
- `lib/core/sales-sync-adapter.ts`
- `lib/core/sri-sync-presentation.ts`
- `lib/core/purchase-sri-credentials.ts` y `app/api/purchases/sri-credentials/route.ts` (infraestructura compartida, alcance explicado arriba)
- `prisma/schema.prisma` y la migración aditiva indicada
- `lib/core/sales-sri-stability.test.ts` (nuevo), tests existentes adaptados al componente/enqueuador extraídos y `package.json` (comando de tests, sin dependencias nuevas)
- `scripts/render-sales-sync-preview.ts` y este reporte

Worker ventas:

- `src/document-outcomes.ts` (nuevo registro por clave)
- `src/jobs.ts`, `src/worker.ts`
- `src/facturom/import-client.ts` (plazo máximo de 30 segundos para evitar un job indefinidamente activo al esperar la API interna)
- `src/sri/soap-client.ts`, `src/sri/sri-download.ts`, `src/sri/sri-errors.ts`
- `src/sri/sri-portal-client.ts` (callback tras autenticar para separar autenticación de consulta)
- `src/tests/checkpoint-regressions.test.ts`, `src/tests/soap-classification.test.ts` (nuevo)
- `src/verify-sri-sales-readonly.ts`, `scripts/verify-sri-sales-readonly.sh`

## 8. Comprobaciones reales pendientes y límites

- SRI real: repetir la ventana pequeña indicada y contrastar estados/continuación con los documentos reales del 28/01. No se presenta el test con fixtures como prueba real.
- PostgreSQL real: aplicar/verificar la migración y sus restricciones tras autorización. No se ejecutó SQL de migración en una base real ni un servidor PostgreSQL aislado en este Mac.
- Navegador autenticado: verificar el recorrido completo con el job real. Las vistas entregadas son renderizados estáticos verificables.
- Jobs anteriores al registro por clave: se conservan importados/duplicados agregados como base y se reconstruyen los fallos pendientes. El caso reportado (0 importados, 0 duplicados, 3 errores) está cubierto. Si un job antiguo había importado parte del día fallido, su atribución histórica exacta de contadores puede requerir auditar los datos reales: antes no se guardaba qué claves correspondían a cada resultado. Ningún documento se vuelve a insertar por ello; la deduplicación existente y el nuevo registro por clave permanecen activos. No se inventó ese detalle perdido.
- Ubuntu: reconciliar cualquier diferencia local posterior a los commits base antes de integrar. La rama y los archivos de respaldo históricos se mantienen intactos.

Estado de esta entrega: IMPLEMENTADO y PROBADO AUTOMÁTICAMENTE. Aceptación con SRI y PostgreSQL reales: PENDIENTE. No se declara GO completo ni estabilidad real verificada únicamente por compilar.
