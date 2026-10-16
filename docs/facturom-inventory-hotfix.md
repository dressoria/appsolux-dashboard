# Hotfix de productos de Facturom

Fecha: 16 de octubre de 2026. Rama: `master`. Cambios locales, sin commit, push, deploy ni migraciones.

## Diagnóstico y alcance de la evidencia

El formulario original propagaba `primaryCode: ""` y `barcode: ""` al crear y editar. `createProduct` los almacenaba literalmente. El esquema contiene índices únicos `(tenantId, primaryCode)` y `(tenantId, barcode)`: una segunda cadena vacía colisiona con la primera. Incluso con códigos principales distintos, dejar el barcode vacío produce esa colisión. El tratamiento correcto del campo opcional es `null`.

POST no capturaba las excepciones de Prisma. PATCH entregaba todo el cuerpo recibido directamente a `update`. El formulario intentaba leer JSON de una respuesta de error sin comprobar su formato y no tenía `catch` para errores de red/parseo. Esa combinación podía dejar Guardar sin una explicación visible.

Esto identifica defectos concretos en el código y reproduce el contrato con índices únicos simulados. **No equivale a una captura del error de producción:** la base configurada localmente devuelve `PrismaClientInitializationError`. No se obtuvo un HTTP/JSON real de producción, consola de navegador autenticado, ni excepción Prisma real del incidente. No se modificaron datos reales.

## Cambios

| Punto solicitado | Resultado |
| --- | --- |
| 1. Causa de Guardar | Códigos opcionales vacíos sujetos a índices únicos; errores sin manejo. Falta confirmar la excepción exacta del incidente en un entorno conectado. |
| 2. Frontend | `app/facturacion/products/product-form-client.tsx`: normalización compartida, errores visibles, loading y bloqueo inmediato de doble clic. |
| 3. Backend | `lib/core/inventory-products.ts`: validación, referencias del tenant y defaults existentes; `inventory-product-errors.ts`: respuestas estructuradas. |
| 4. POST | Guarda solo campos permitidos; persiste `isActive` y los cuatro precios; devuelve 201, 400 o 409 según el caso. |
| 5. PATCH | Valida igual que crear, conserva valores omitidos y no acepta modificar tenant, ID ni stock desde el cuerpo. |
| 6. Números | Strings con trim; costo/precios vacíos a cero; valores no finitos rechazados antes de Prisma. |
| 7. Negativos | Rechazados en UI y backend con “El precio no puede ser negativo.” |
| 8. IVA | Un selector visible con 15%, 5%, 8%, 12%, 0%, No Objeto de Impuesto y Exento de IVA. |
| 9. Mapeo | 15/5/8/12 → TAXABLE; 0 → ZERO; NON_OBJECT y EXEMPT → tarifa cero. Se rechazan combinaciones incompatibles y tarifas libres. |
| 10. Producto 15% | Fixture BLOOM con PVP 6.09 y tarifa 15 probado al crear/editar. Registro real pendiente. |
| 11. Producto 0% | Fixtures UROCAPS/URO OVULOS con tarifa cero; categorías históricas nulas se interpretan según la tarifa. Registros reales pendientes. |
| 12. Acciones | Crear, actualizar precios, importar, descargar formato y combos habilitados. |
| 13. Barcode | Depende de selección, tooltip sin selección; PDF con Code 128 solo para IDs seleccionados del tenant. |
| 14. Importación | CSV/XLSX → preview sin escrituras → errores por fila → confirmación transaccional con nueva validación. Incluye unidades, bodegas, cuatro precios, clasificación IVA, balances y movimientos de apertura. |
| 15. Plantilla | XLSX real con las 19 columnas solicitadas, listas de valores y hoja de instrucciones. |
| 16. Combos | Filtro `type=COMBO` aplicado en servidor; listado con paginación. |
| 17. Precios masivos | Seleccionados por defecto; también todos/filtrados. Preview, confirmación, auditoría y rechazo de vista previa desactualizada. |
| 18. Mensajes UI | Error de backend visible; fallback HTTP si la respuesta no es JSON; errores de conexión capturados. Toast de creación/edición al regresar al listado. |
| 19. Tests | Ver resultados de validación al final. Base simulada explícita en pruebas de servicios y rutas HTTP; renderizado HTML para acciones. |
| 20. Typecheck | Ver resultados de validación al final. |
| 21. Lint | Ver resultados de validación al final. |
| 22. Build | Ver resultados de validación al final. |
| 23. Diff | Ver resultados de validación al final. |
| 24. Migración | Ninguna necesaria: el esquema ya contiene taxRate/taxCategory y price/price2/price3/price4. No se modificó el esquema para este hotfix ni se ejecutaron migraciones. |

Los catálogos opcionales usan registros SIN CATEGORÍA/SIN UNIDAD/SIN MARCA si existen, sin crear duplicados. Un producto con inventario resuelve una bodega predeterminada activa del tenant; si falta, recibe el mensaje solicitado. SERVICE desactiva inventario y no exige bodega ni cuenta de inventario.

## Semántica de precios

`lightweight-pos.ts` usa `calculateLine` de `sale-totals-calculator.ts`: multiplica el precio unitario por la cantidad y suma el impuesto a ese subtotal. El PVP almacenado es neto. El formulario conserva esa semántica: ganancia = precio − costo; porcentaje = ganancia/costo × 100 cuando costo > 0, y cero en otro caso; valor con IVA = precio × (1 + tarifa/100). No se modifican facturas históricas ni cálculos de ventas.

## Operación

- Ejecutar `npm run test:inventory` y `npm run test:inventory-ui` para las pruebas nuevas y existentes de inventario.
- Importación: máximo 2000 filas y 5 MB; CSV UTF-8 separado por comas, con códigos tratados como texto para conservar ceros iniciales. Variantes de IVA documentadas en la hoja Instrucciones del XLSX.
- Barcode: máximo 200 seleccionados por PDF; usa barcode y, si falta, código principal. Si ambos faltan, muestra un error indicando el producto. Códigos Code 128 hasta 64 caracteres.
- Se añadió `bwip-js` para generar códigos escaneables con su [interfaz Node oficial](https://github.com/metafloor/bwip-js). La generación sucede en servidor y no usa servicios externos.
- Se recuperaron archivos de dependencias locales marcados por iCloud como `dataless`, desde los tarballs exactos del lockfile y comprobando su integridad. No se cambiaron versiones por esa recuperación.

## Pendiente de comprobación en entorno conectado

Crear tres productos consecutivos desde un navegador autenticado y confirmar sus filas reales; abrir BLOOM/UROCAPS/URO OVULOS reales, editar y recargar; verificar impresión física/escaneo de las etiquetas. La ausencia de conexión local impide afirmar esa verificación end-to-end.

## Validaciones ejecutadas

| Validación | Resultado |
| --- | --- |
| `npx prisma generate` | OK, Prisma Client 6.19.3. No ejecuta migraciones. |
| `npx tsc --noEmit` | OK, sin errores después de corregir los tipos del hotfix. |
| `npm run test:inventory` | 179 pruebas aprobadas. Incluye rutas HTTP reales con autenticación y Prisma simulados, tres POST 201, PATCH 200, duplicados 409 y validaciones 400. |
| `npm run test:inventory-ui` | 3 pruebas aprobadas: acciones habilitadas, barcode condicional y acceso a Crear. Pruebas de renderizado, sin navegador. |
| Regresiones | 335 pruebas aprobadas: POS, proformas, AI invoicing y solver, accounting-core, purchases-module, SRI tax/documentos y recibos/importaciones. |
| ESLint de todos los archivos del hotfix | OK, sin errores ni advertencias. |
| `npm run lint` | FALLA: 23 errores y 35 advertencias en archivos ajenos al hotfix. Incluye efectos con setState en AI/compras/POS y `any` en pruebas de importación de clientes. Se preservan esos cambios previos. |
| `npm run build` | Compilación de producción OK en 68 segundos. **Build completo NO confirmado:** se bloqueó en su fase de TypeScript leyendo `node_modules/@clerk/shared/dist/errors/metamaskError.d.mts`, un archivo `dataless` de iCloud. Se interrumpió el proceso bloqueado. |
| `git diff --check` | OK en la revisión final. |

Para evitar la caché local incompleta se usó temporalmente `distDir: "build/inventory-hotfix"` durante el build. Esa configuración y los cambios automáticos de Next a `tsconfig.json` fueron restaurados. No se omitió ni deshabilitó la comprobación de tipos.

`eslint.config.mjs` ahora excluye `.next-*/**`: existían builds antiguos de Treasury que el comando lint estaba analizando como código fuente. Los 23 errores reportados arriba corresponden a archivos fuente y no se ocultaron.

También se comprobó `invoice-editor.tsx`: calcula IVA sobre el subtotal neto y suma ambos al total, consistente con POS. Los archivos fuente y migraciones recuperados de iCloud conservan exactamente su contenido del índice de Git; no hay cambios de contenido en ellos por esa recuperación.

El último reintento de tests y lint también encontró dependencias `dataless` (Prisma y ESLint). Los conteos aprobados corresponden a las ejecuciones completas previas; ese reintento no se reporta como aprobado. Los últimos guardas de cuerpos JSON nulos se comprobaron sintácticamente y sus casos quedaron agregados al test HTTP. La copia temporal fuera de iCloud tampoco pudo completarse porque se bloqueó la lectura de un archivo de autenticación ajeno al hotfix; se canceló sin modificar el proyecto.
