# Facturom: cierre de regresiones SRI — 31/10/2026

## Resultado y límites

**IMPLEMENTADO y PROBADO AUTOMÁTICAMENTE en Mac. La aceptación con SRI real está PENDIENTE.** No se declara GO completo.

Bases revisadas: dashboard `4526d56`, ventas `c67d969`, compras `79fd964`. Los tres checkouts estaban limpios al comenzar. No se ha hecho push ni deploy, no se ha alterado el worker de firma, no se han ejecutado importaciones históricas ni escrito en una base de datos real.

La rama Ubuntu `backup/ubuntu-sri-20261031-045645`, su respaldo y los dos scripts funcionales `/tmp` no existen en este Mac ni se publicaron como ramas remotas consultables. Se conserva esa evidencia: no se ha restaurado, sobrescrito ni eliminado nada de Ubuntu. Su comparación exacta con el candidato está **PENDIENTE** y requiere acceso al entorno original. No existe una conexión SSH configurada ni Docker en este Mac.

## Causa de ventas y diferencias comprobables

El selector publicado elegía el primer `<form>` del HTML. Con `formMessages` antes de `frmPrincipal`, generaba filtros con el prefijo incorrecto y mezclaba controles detectados globalmente. Además descartaba campos/action del formulario, omitía encabezados JSF y no validaba adecuadamente las respuestas AJAX/TXT. HTML con tabulaciones o mensajes de «sin resultados» podía convertirse en cero documentos.

Ahora se elige el formulario por sus controles reales y se prioriza `frmPrincipal`; se conservan campos ocultos/action, se leen execute/render de PrimeFaces, se envían encabezados JSF y se actualizan ViewState y campos ocultos. La descarga usa `lnkTxtlistado` dentro del formulario seleccionado y valida tipo, contenido, cabecera y claves. Los tipos se obtienen del portal: no se limita permanentemente a factura. El límite de documentos genera error en lugar de truncar y avanzar checkpoint.

La URL de entrada de ventas **ya era correcta en config y Compose locales**:

`https://srienlinea.sri.gob.ec/tuportal-internet/accederAplicacion.jspa?redireccion=60&idGrupo=58`

Se conserva y se hace explícita en `.env.example`. El valor efectivo de Ubuntu aún no se ha inspeccionado aquí. La prueba entregada clasifica la URL del contenedor actual, incluyendo Markdown o entrada antigua, sin imprimir secretos. La configuración inválida ahora produce `CONFIG_ERROR` antes de abrir una conexión; no se atribuye automáticamente a un cambio del SRI.

## Estado por resultado

| Resultado | Clasificación | Evidencia / límite |
|---|---|---|
| URL permanente de ventas y validación estricta | IMPLEMENTADO; PROBADO AUTOMÁTICAMENTE | Config, Compose, ejemplo de entorno; rechazo de Markdown/URL antigua antes de la red. El override efectivo de producción queda PENDIENTE. |
| Keycloak, transformación de contraseña y campos ocultos | PROBADO AUTOMÁTICAMENTE | Fixtures HTTP, atributos sin comillas; transformación existente conservada. Login real PENDIENTE. |
| SSO `j_security_check`, cookies y redirecciones | PROBADO AUTOMÁTICAMENTE | Conserva `j_username`, `j_password`, `j_token`; prueba de redirección con cookies y POST 307. SSO real PENDIENTE. |
| Sesión de emitidos y consulta JSF | PROBADO AUTOMÁTICAMENTE | Verificación abre la página de emitidos y exige controles/ViewState; AJAX por action/formulario real. Consulta real PENDIENTE. |
| TXT de ventas | PROBADO AUTOMÁTICAMENTE | Flujo completo con fixtures, tipos dinámicos, ViewState/ocultos actualizados y rechazo de HTML. `TXT_WORKER_NUEVO_OK` real PENDIENTE. |
| Recuperación SOAP XML | PROBADO AUTOMÁTICAMENTE | Tests existentes de SOAP y validación XML; recuperación con claves reales PENDIENTE. |
| Importación a PostgreSQL | PROBADO AUTOMÁTICAMENTE; PENDIENTE en PostgreSQL real | Servicio real de importación con persistencia simulada: crea externo, deduplica por tenant, conserva original y rechaza otro emisor. No se escribió en PostgreSQL. |
| Progreso de ventas | IMPLEMENTADO; PROBADO AUTOMÁTICAMENTE | Dentro de Importación automática; job devuelto por API, polling real sin porcentajes inventados; conserva éxito/fallo y se recupera del servidor al recargar. Render/API probados; interacción en navegador autenticado PENDIENTE. |
| Progreso de compras | IMPLEMENTADO; PROBADO AUTOMÁTICAMENTE | Mismo componente y polling; último intento y últimos 20 trabajos; API de estado también incluye latestJob. Render/API probados; interacción en navegador autenticado PENDIENTE. |
| Navegación | IMPLEMENTADO; PROBADO AUTOMÁTICAMENTE | Ventas: consolidado, archivo y automática tienen destinos distintos; las tres páginas de compras comparten navegación visual sin duplicar sus clientes de datos. |
| Credenciales | IMPLEMENTADO; PROBADO AUTOMÁTICAMENTE | Se retira el formulario duplicado de compras y se enlaza Empresa → Configuración → SRI. Se preservan AES-256-GCM, aislamiento por tenant y respuestas públicas sin material cifrado/contraseñas. |
| Checkpoints y frecuencias | IMPLEMENTADO; PROBADO AUTOMÁTICAMENTE | Días de Ecuador, primer checkpoint solo tras éxito, parada al fallar el día, contadores/denominador al reanudar, inicio el 1 de enero fiscal y frecuencia de ventas configurada. |
| Conector HTTP real de recibidos | PENDIENTE | No se inventó otra URL ni se reconstruyó el conector. Se añadieron controles para que HTML, errores JSF y TXT inválido no representen un día vacío exitoso. No se implementó evasión de CAPTCHA. |
| `VERIFICADO CON SRI REAL` | Ninguno en esta sesión | El éxito histórico aportado por el usuario no se presenta como una nueva ejecución. |

## Pantallas y estados

Ventas usa el mismo SalesImportClient en `/facturacion/sales/imports`, `/facturacion/sales/imports/file` y `/facturacion/sales/imports/automatic`. El historial conserva `/facturacion/sales/imports/sync-history` y muestra también el último resultado finalizado.

Compras mantiene sus rutas `/consolidated`, `/txt-import` y `/automatic-download`, con las tres pestañas visibles y selección de la ruta actual. Se reutilizan los servicios de consolidado/TXT existentes.

Ambas tarjetas muestran fecha procesada, días/total, encontrados/importados/duplicados/errores, hora final y mensaje real. Un total desconocido es indeterminado. El estado de conexión distingue configuración, verificación, autenticación verificada, errores, sincronización y verificación humana. Activar `sriEnabled` nunca presenta por sí solo «Conectado».

La revisión ampliada detectó un fallo visual anterior en el test de documentos SRI: los selectores de establecimiento/punto de emisión del editor de facturas habían perdido su ancho contenido y truncado. Se restauraron esas clases y títulos; no cambia lógica fiscal, de firma ni de facturación.

## Pruebas ejecutadas

| Proyecto / comando | Resultado |
|---|---|
| Ventas: `npm test` | 184 aprobados |
| Compras: `npm test` | 50 aprobados; 1 live omitido por falta de opt-in/credenciales |
| Dashboard: `npm run test:sri-regressions` | 11 aprobados |
| Dashboard: `npm run test:sri-final` | 54 aprobados |
| Dashboard: tests de sales-auto-sync-premium, sales-sri-sync-worker, purchases-module, receipts-and-imports, sri-received-import y review-06-purchases | 319 aprobados |
| Dashboard: `npm run test:sri-tax` | 45 aprobados |
| Dashboard: `npm run test:sri-documents` | 7 aprobados |
| TypeScript | Correcto en los tres proyectos (`npx tsc --noEmit` en dashboard y `npm run typecheck` en workers) |
| Builds | `npm run build` correcto en los tres proyectos |
| ESLint | Correcto en los componentes/APIs de sincronización revisados; guía vercel:react-best-practices aplicada |
| Shell de aceptación | `bash -n` correcto; ejecución Docker/SRI no realizada en este Mac |
| Instalación reproducible de ventas | `npm ci --ignore-scripts` correcto. Se eliminó Playwright/playwright-core obsoleto del lockfile; package, lock e imagen tienen regresión de ausencia de navegador |

Los tests de portal usan fixtures, los de persistencia usan SQL/Prisma simulados y los de interfaz renderizado React y llamadas a API con sesión simulada. No equivalen a un recorrido de navegador autenticado ni a una ejecución SRI real. No se añadieron dependencias.

## Aceptación Ubuntu y reconciliación

En el checkout candidato de `sri-sales-sync-worker`:

```bash
bash scripts/verify-sri-sales-readonly.sh
```

La prueba construye una imagen temporal con etiqueta separada, lee la configuración actual sin imprimir secretos, resuelve las URLs del Compose candidato y consulta exclusivamente el 17/10/2026. Lee las credenciales existentes mediante PostgreSQL READ ONLY, cierra la transacción y no importa documentos ni crea jobs. Solo emite `TXT_WORKER_NUEVO_OK` con todas las etapas observadas y exactamente un documento válido. No reemplaza el worker permanente ni necesita `-e SRI_PORTAL_LOGIN_URL`.

El procedimiento detallado de precedencia, comparación con respaldo, importación de bundles y worktree aislado está en `../appsolux-workers/sri-sales-sync-worker/docs/SRI_RECOVERY_2026-10-31.md` respecto a la raíz de los repositorios. El bundle de cada repositorio requiere la base publicada indicada arriba. Crear el worktree desde el bundle permite comparar sin tocar los archivos modificados de Ubuntu. No ejecutar push ni deploy hasta que el usuario lo autorice expresamente.

Pendientes verificables fuera de este Mac: comparación exacta del respaldo Ubuntu y sus scripts; configuración efectiva del contenedor; prueba TXT real; recuperación XML real; importación real PostgreSQL mediante una prueba autorizada separada; confirmación del conector de recibidos y recorrido de navegador autenticado. No se reduce esta lista a «solo falta el SRI»: aún no se ha ejecutado Docker ni la interfaz autenticada aquí.
