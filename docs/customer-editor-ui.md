# Nuevo cliente: UI y controles animados

Entrega local del 18 de noviembre de 2026. Alcance: Facturom Web, creación y edición de clientes. Sin commit, push, despliegue ni ejecución de migraciones.

## Comportamiento

- «Completo» aparece a la izquierda y es el modo inicial de `/facturacion/customers/new`. «Rápido» aparece a la derecha.
- Rápido permite guardar solo el nombre. Añade teléfono, dirección, código interno, estado y observación interna opcionales.
- El teléfono empieza vacío: no se guarda un prefijo `+593` si no se ha ingresado un teléfono. Se conservan los formatos telefónicos que ya acepta el servidor, sin nuevas expresiones regulares restrictivas.
- Completo conserva identificación y consulta tributaria, contactos múltiples, ubicación, clasificación, vendedor, relaciones y demás campos existentes. Expone el mismo bloque de gestión interna que Rápido.
- Todos los valores editables viven en el estado del editor. Alternar no reinicia clasificación, teléfonos, correos, notas ni estado.
- Guardar desde Rápido incluye también los datos escritos previamente en Completo. Si se ingresó una identificación o contacto inválido en Completo, el servidor lo seguirá validando; se debe corregir en ese modo. No se descartan datos silenciosamente.
- Las notas reutilizan `LightweightCustomer.notes`, exclusivamente como observación interna. No se añadió ningún mapeo hacia comprobantes electrónicos.
- `isActive` se reutiliza y se envía como booleano real en POST/PATCH. Su valor inicial es `true`.
- Se manejan errores de red al guardar y consultar, y se permite reintentar conservando los datos.

## Componentes y estilos

| Componente | Contrato y comportamiento |
| --- | --- |
| `AnimatedSegmentedControl` | Controlado mediante `value`, `onValueChange` y `options`. Usa radiogroup/radio, foco itinerante, flechas, Inicio/Fin y botones nativos para Espacio/Enter. Píldora desplazada con `transform`, 320 ms y curva `cubic-bezier(0.22, 1, 0.36, 1)`. Acepta iconos, etiqueta y estado deshabilitado. |
| `AnimatedSwitch` | `checked` y `onCheckedChange`; acepta atributos de botón, etiqueta accesible, `id`, `disabled` y referencia de React 19. Usa `role="switch"`, `aria-checked`, foco visible y un círculo con desplazamiento de 280 ms. El editor serializa su valor en JSON. |
| `BlobButton` | Extiende el botón existente; variantes `solid` y `outline`, atributos nativos y `type="button"` por defecto. Para enviar formularios se indica `type="submit"`. Cuatro círculos con desplazamiento y escala, demoras escalonadas y transiciones de 420 ms se superponen para llenar el fondo. El texto permanece encima. Hover y foco de teclado activan el efecto; al salir se revierte. |
| `AnimatedFormPanel` | Recibe `mode` y `children`. `ResizeObserver` mide la altura para una transición de 240 ms; la entrada usa 6 px de desplazamiento durante 220 ms. No recorta menús desplegables. Los valores del formulario deben residir fuera del panel, como en este editor. |

Los cuatro controles usan `animated-controls.module.css`. Respetan `prefers-reduced-motion: reduce`, sin animaciones continuas, filtros SVG, Sass ni dependencias visuales nuevas.

Se agregaron los tokens `--facturom-action: #EC008C`, `--facturom-action-strong: #C90077` y `--facturom-action-soft: #FFF0F8`, con sus equivalentes Tailwind. El fondo fucsia bajo etiquetas blancas pequeñas recibe un sombreado negro del 7 % para mantener contraste. Los tokens de azul corporativo, sidebar, rojo semántico y el acento previo permanecen disponibles para sus consumidores existentes. Los estilos de campos nuevos están limitados a `.customer-editor`.

## Persistencia y migración

El modelo no disponía de un código de cliente independiente de `id` y `identification`. Se agregó `internalCode String? @db.VarChar(100)` con índice único `[tenantId, internalCode]`.

- Se recortan espacios exteriores, se conservan mayúsculas/minúsculas y ceros iniciales; vacío se normaliza a `NULL`.
- La unicidad distingue mayúsculas de minúsculas, conforme a la comparación habitual de la columna PostgreSQL. No existía una regla previa de códigos que migrar.
- El servicio verifica duplicados dentro del tenant; el índice también protege contra carreras. POST/PATCH traducen el conflicto `P2002` del código a un mensaje legible y HTTP 409.
- El campo es opcional para los consumidores existentes. PATCH conserva el código si se omite y lo limpia si se envía una cadena vacía.
- El tenant continúa obteniéndose de la sesión; se conservan las verificaciones existentes de cliente relacionado, destinatario fiscal, vendedor y acceso operativo.

Migración preparada: `prisma/migrations/20261118120000_add_customer_internal_code/migration.sql`. Agrega una columna nullable sin valores inventados y su índice por tenant. Las filas previas quedan con `NULL`. **No se ejecutó en ninguna base de datos.** Antes de usar esta versión con una base existente se debe aplicar y verificar la migración en un entorno de desarrollo o staging autorizado. Se regeneró únicamente el cliente Prisma local.

## Archivos de esta entrega

Modificados:

- `app/facturacion/customers/new/page.tsx`
- `components/appsolux/customers/customer-editor.tsx`
- `app/globals.css`
- `app/api/basic/customers/route.ts`
- `app/api/basic/customers/[customerId]/route.ts`
- `lib/core/lightweight-pos.ts`
- `prisma/schema.prisma`
- `package.json` (solo scripts de prueba)

Creados:

- `components/ui/animated-segmented-control.tsx`
- `components/ui/animated-switch.tsx`
- `components/ui/blob-button.tsx`
- `components/ui/animated-form-panel.tsx`
- `components/ui/animated-controls.module.css`
- `lib/core/customer-internal-code.ts`
- `lib/core/customer-editor.test.ts`
- `scripts/customers/verify-editor-browser.cjs`
- `prisma/migrations/20261118120000_add_customer_internal_code/migration.sql`
- `docs/customer-editor-ui.md`

Los siete archivos que ya estaban staged al iniciar, relativos a autenticación móvil, permanecen intactos. No se modificaron Facturom Mobile, workers SRI, Clerk, permisos, planes, inventario ni suscripciones.

## Verificación realizada

| Comando / revisión | Resultado real |
| --- | --- |
| `npm run test:customer-editor` | 12/12 pruebas: API real y servicio real con autenticación, acceso operativo y Prisma simulados. Nombre mínimo; opcionales; ambos estados; notas; código; duplicados; edición; aislamiento de lecturas, escrituras y relaciones; errores de validación y carreras. |
| `npm run test:customer-editor-browser` | 11/11 comprobaciones en Google Chrome headless, con los componentes y CSS reales, render SSR/hidratación, HTTP y navegación simulados. Orden/inicio; teclado; desplazamiento intermedio del indicador; payloads; conservación de datos; consulta tributaria; errores; blobs; reduced motion; ancho 320/390/768/1280 px en ambos modos; ausencia de errores de hidratación y JavaScript. |
| `npm run test:customer-import` | 64/64 pruebas existentes. |
| `npm run test:proformas` | 7/7 pruebas existentes, incluidos contratos del checkout POS. |
| `npx tsx --test lib/core/people-module.test.ts` | 40/40 pruebas existentes. |
| `npx tsc --noEmit` | Correcto. |
| `npm run build` | Correcto; 385 páginas generadas. Turbopack emitió 21 advertencias de trazado/acceso dinámico al filesystem en archivos ajenos a esta entrega. |
| ESLint de los archivos TS/TSX/CJS de esta entrega | Sin errores ni advertencias. |
| `npm run lint` | Falla por 44 errores y 61 advertencias en otros archivos existentes. Ejemplos: `customer-admin.tsx`, formularios de compras, `supplier-editor.tsx` y `customer-import.test.ts`. No se ampliaron los cambios a esos módulos. |
| `prisma migrate diff` entre el esquema previo y el nuevo | Genera únicamente la columna y el índice incluidos en la migración preparada. Comparación local de esquemas, sin conexión a DB. |
| `git diff --check` y revisión visual de capturas desktop/mobile | Correctos. |

El script de navegador sigue el patrón de verificación existente de billing: Playwright se proporciona mediante `FACTUROM_PLAYWRIGHT_MODULE` o debe estar disponible en el entorno de herramientas. `FACTUROM_CHROME_PATH` permite usar Chrome instalado; `FACTUROM_CUSTOMER_SCREENSHOTS` permite guardar capturas. Para esta entrega se utilizó Playwright desde la caché temporal de npm y Chrome instalado, sin añadir paquetes al proyecto ni modificar el lockfile.

Pendiente fuera de esta ejecución: aplicar la migración en desarrollo/staging autorizado y comprobar el ciclo con una sesión real contra PostgreSQL. Las pruebas aisladas no certifican la conexión con una base real ni la consulta SRI externa. No se contactó producción ni se cambiaron credenciales o configuración de entorno.
