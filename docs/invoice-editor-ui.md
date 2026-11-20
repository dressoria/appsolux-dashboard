# Nueva factura: mejoras de interfaz

Entrega local del 19 de noviembre de 2026, limitada a Facturom Web. Se conservaron los cambios previos de Clientes, sus componentes animados y su migración pendiente, además de los cambios de autenticación móvil que ya estaban staged. No se ejecutaron migraciones, commits, pushes ni despliegues.

## Interfaz y controles reutilizados

- `AnimatedSwitch`: reemplaza los checkboxes de reembolso/exportación. Ambos siguen utilizando el mismo enum `invoiceKind`: activar uno desactiva el otro. Se conservan sus formularios condicionales, payloads y reglas existentes; no se habilitó ninguna modalidad nueva.
- `AnimatedSegmentedControl`: alterna Detalles / Asiento con píldora móvil y teclado. Los campos de Detalles permanecen montados al cambiar de sección. El selector sigue disponible cuando los campos de una venta guardada quedan bloqueados.
- `BlobButton`: acciones Guardar factura y Guardar y enviar al SRI; conservan sus callbacks y condiciones de activación previas.
- Se reutilizan los tokens fucsias existentes y el azul corporativo. Los cambios de CSS están encapsulados en el editor, sin modificar el dashboard global. Animaciones de selección y controles respetan reduced motion.

«Pag. SRI» pasa a «Forma de pago SRI». El selector ocupa una fila completa, tiene `width: 100%` y `min-width: 0`, y ofrece la descripción íntegra debajo y en `title`. Los contenedores grid/flex también permiten reducir su ancho. El catálogo y todos sus códigos, incluido `20`, permanecen iguales. El método comercial conserva su lógica independiente y sus modales.

La selección de cliente se muestra en una tarjeta con nombre principal, indicador Seleccionado y acciones Cambiar/Limpiar. Identificación, teléfono, correo y dirección se organizan con `dl` responsive. La búsqueda ya no repite el nombre seleccionado. «+ Nuevo cliente» mantiene su ruta. La observación de factura conserva su propio estado `notes`, sin leer ni copiar notas internas del cliente.

Los campos usan etiquetas asociadas y foco visible. `EditableNumberInput` solo recibe atributos opcionales `id` y `aria-label`; no se modificaron sus cálculos ni su comportamiento numérico. La fecha visible se entrega desde el servidor en horario de Ecuador para evitar diferencias de hidratación; no se cambió la fecha persistida o emitida.

## Vendedor: origen, autorización y persistencia real

Antes, el campo de solo lectura utilizaba `currentUserName={user.name}`. Por tanto, el texto observado como «131 studio» procedía del perfil del usuario autenticado, no de una consulta a vendedores ni de una asignación comercial de la factura.

Ahora `getInvoiceSellerContext` reutiliza las membresías de la empresa activa. Solo admite membresías activas de usuarios activos con permiso de venta según `getRolePermissions` existente. Los roles actuales que cumplen esa condición son owner, admin y seller. No se crearon empleados ni vendedores ficticios.

- El usuario autenticado se propone únicamente si su ID pertenece a esa lista validada. Su nombre visible procede del registro de usuario de esa membresía.
- Buscar por nombre/correo, elegir, limpiar y cambiar se implementa con el Popover de Radix ya instalado. La selección muestra nombre completo, fondo y borde fucsia e indicador Seleccionado.
- Se respetan las opciones existentes `selectSellerOnInvoice` y `editSellerData`. Si ambas están desactivadas, se informa dónde habilitar el cambio. El backend rechaza la asignación de otro vendedor en esa situación; permite conservar un vendedor válido previamente guardado.
- Un vendedor anterior que ya no esté disponible se muestra como tal y puede quitarse explícitamente. No se reemplaza silenciosamente por otro.
- `sellerId` es opcional en el JSON existente de `SalesInvoiceDraft`. POST y PATCH validan membresía, estado y configuración en el servidor. PATCH preserva el vendedor si un cliente anterior omite ese campo. Una cadena vacía lo limpia.
- Se conserva al reabrir y actualizar el borrador; también permanece en el borrador marcado CONVERTED mediante el flujo actual.

**Limitación:** `LightweightSale`, su API de creación y `SriDocument` no disponen de vendedor de factura. Por ello no se envía un campo inexistente a la venta final ni se reutilizan notas u otras columnas para simularlo. La interfaz explica que la atribución persiste en el borrador. La persistencia del vendedor en la venta definitiva necesita una fase posterior con contrato/modelo explícitos.

## Asiento: información existente, sin contabilización nueva

El proyecto ya dispone de plan/catálogo de cuentas, parámetros, periodos, asientos y líneas, servicios de creación manual, contabilización y reversión, informes y cierre contable. Existe una asociación lógica por `AccountingJournalEntry.sourceType = SALE` y `sourceId = sale.id`, utilizada también por la cancelación existente. No se encontró un motor de vista previa de la factura actual ni una contabilización automática conectada a este editor.

Se añadió `GET /api/basic/sales/[saleId]/journal` como consulta de solo lectura:

1. Resuelve usuario y tenant en el servidor, aplica el permiso existente `erp:read` y la política actual `getFacturomAccess().accounting` sin cambiar planes ni permisos.
2. Confirma que la venta pertenezca al tenant. Un ID desconocido o ajeno devuelve 404.
3. Busca exclusivamente el asiento `SALE` de esa venta y reutiliza `getJournalEntryById`.
4. Comprueba que líneas y cuentas pertenezcan a la misma empresa antes de devolver datos. Referencias inconsistentes no se exponen.
5. Suma los importes realmente almacenados en las líneas mediante Decimal. No genera cuentas, impuestos, movimientos ni partidas. La diferencia refleja los datos, incluso si no cuadran o los totales antiguos de la cabecera están desactualizados.

La tabla muestra código y nombre de cuenta, Debe y Haber, y un pie con totales y diferencia en USD para Ecuador. El estado se identifica como Contabilizado, Revertido o Borrador contable · No contabilizado, según el dato real.

Antes de guardar, sin asiento o con líneas vacías, se muestra «Asiento contable no disponible todavía para esta factura.» y los totales aparecen como `—`. No se presentan ceros inventados. Sin permiso o ante un error se muestra información apropiada. Abrir/actualizar la sección solo hace GET; no crea ni contabiliza asientos.

La política comercial actual expone contabilidad a través de `getFacturomAccess`; no se introdujo una restricción nueva por suscripción ni se cambió la visibilidad de otros módulos.

## Archivos de esta fase

Modificados:

- `app/facturacion/sales/new/page.tsx`
- `components/appsolux/sales/invoice-editor.tsx`
- `components/appsolux/sales/editable-number-input.tsx`
- `app/api/facturacion/drafts/route.ts`
- `app/api/facturacion/drafts/[draftId]/route.ts`
- `package.json` (solo dos scripts de prueba adicionales; conserva los anteriores)

Creados:

- `components/appsolux/sales/invoice-seller-select.tsx`
- `components/appsolux/sales/selected-invoice-customer.tsx`
- `components/appsolux/sales/invoice-journal-panel.tsx`
- `components/appsolux/sales/invoice-editor.module.css`
- `lib/core/invoice-sellers.ts`
- `lib/core/invoice-journal.ts`
- `app/api/basic/sales/[saleId]/journal/route.ts`
- `types/invoice-ui.ts`
- `lib/core/invoice-editor-ui.test.ts`
- `scripts/sales/verify-invoice-editor-browser.cjs`
- `docs/invoice-editor-ui.md`

No se modificaron Prisma ni migraciones en esta fase. Tampoco SRI, workers, XML, cálculos tributarios, inventario, autenticación, suscripciones ni mapas de permisos. Las fórmulas de totales y los flujos Guardar/Enviar/RIDE/Ticket permanecen en su implementación existente.

## Pruebas y resultados

| Verificación | Resultado |
| --- | --- |
| `npm run test:invoice-editor-ui` | 13/13 pruebas nuevas. Servicios y rutas reales, con sesión y Prisma simulados. Comprueban vendedor activo/autorizado, configuración, borradores, compatibilidad, conversión, lectura contable, sumas/diferencia, vacíos, permisos y aislamiento de venta/asiento/línea/cuenta. |
| `npm run test:invoice-editor-browser` | 11/11 comprobaciones con componentes/CSS reales y HTTP de prueba. SRI legible y separado; búsqueda de vendedor por teclado; selección/cambio/limpieza de cliente; observación independiente; switches excluyentes; reapertura de borrador; Detalles/Asiento; cantidades/descuentos/IVA/totales; guardado interno; estados contables; responsive 320/390/768/1024/1440 px; reduced motion; ausencia de errores de hidratación/JS. |
| `NODE_OPTIONS=--conditions=react-server npx tsx --test lib/core/invoice-final-review-03.test.ts lib/core/pos-checkout.test.ts` | 17/17 pruebas existentes. La primera invocación sin la condición react-server falló al importar `server-only`; ejecutadas con la condición apropiada, pasan. No se alteraron esos tests ni el código SRI. |
| `npm run test:customer-editor` | 12/12 pruebas de la fase anterior, sin regresiones. |
| `npx tsc --noEmit` | Correcto. |
| ESLint de los 14 archivos TS/TSX/CJS de esta fase | Sin errores ni advertencias. La inspección previa registró un `any` y una variable no usada en los dos archivos editados; se corrigieron sin cambiar sus contratos externos. |
| `npm run build` | Compila, pasa TypeScript y genera las 385 páginas, pero sale con error al compactar la caché de Turbopack: `ENOSPC`, disco sin espacio. No se considera exitoso. |
| `npm run build -- --webpack` | Correcto, código de salida 0; 385 páginas generadas. Permite verificar la compilación sin la compactación de caché que falló con Turbopack. |
| Revisión visual y `git diff --check` | Capturas desktop/móvil y diferencias revisadas; sin errores de whitespace. |
| Comparación SHA-256 con el estado inicial de 25 archivos ya modificados/no versionados | Todos preservados salvo `package.json`, donde se añadieron únicamente los dos scripts de esta fase. Los cambios previos de Clientes, migración, componentes compartidos y autenticación móvil siguen intactos. |

El navegador se ejecuta en un servidor temporal aislado; Playwright y Chrome se proporcionan desde el entorno de herramientas existente mediante `FACTUROM_PLAYWRIGHT_MODULE` y `FACTUROM_CHROME_PATH`. `FACTUROM_INVOICE_SCREENSHOTS` guarda capturas opcionales. No se añadieron dependencias ni se cambió el lockfile. No se solicitó ni simuló ningún envío al SRI; la prueba de guardado usa exclusivamente el modo interno con HTTP simulado.

## Pendientes y límites

- Verificar el flujo contra una sesión real y una base de desarrollo/staging autorizada. Las pruebas aisladas no certifican una conexión real con PostgreSQL, Clerk o SRI.
- Definir en otra fase la persistencia del vendedor en la venta final y su visualización posterior. Hoy se conserva en el borrador existente.
- La futura integración de generación/vista previa/contabilización requiere instrucciones específicas. Esta entrega solo muestra asientos ya almacenados.
- La migración anterior de Clientes continúa pendiente; este trabajo no la ejecutó. Una base sin esa migración debe prepararse antes de probar los flujos que ya dependen de ella.
- El cierre del build estándar de Turbopack necesita suficiente espacio de caché; no se modificó la configuración del proyecto para ocultar ese fallo.
