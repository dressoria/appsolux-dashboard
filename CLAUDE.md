# Appsolux Dashboard - Reglas para Claude Code

## Contexto del proyecto

Appsolux es una plataforma SaaS B2B enfocada en automatizacion, atencion al cliente y gestion empresarial.

Este repositorio contiene el frontend principal del dashboard SaaS de Appsolux.

## Stack

- Next.js con App Router
- TypeScript
- Tailwind CSS
- shadcn/ui
- Server Components cuando sea posible
- Client Components solo cuando se necesite estado, eventos o interaccion
- API Routes / Server Actions para operaciones seguras

## Infraestructura backend existente

Appsolux ya tiene backend desplegado en contenedores Docker en Oracle Cloud:

- Chatwoot: motor central de conversaciones.
- ERPNext v15: clientes, empresas, facturacion, contabilidad, suscripciones y gestion empresarial.
- n8n: aprovisionamiento, workflows largos y automatizaciones con reintentos.
- Evolution API: conexion WhatsApp mediante QR / instancia.
- Meta API: conexion oficial para WhatsApp Cloud API, Instagram y Messenger.

## Regla principal

Este proyecto es multitenant.

Nunca se debe usar un ID fijo como:

- account_id: 1
- chatwoot_account_id: 1
- tenant_id fijo
- company_id fijo
- inbox_id fijo

Todo debe resolverse dinamicamente desde el usuario autenticado y su tenant.

## Separacion de responsabilidades

- Next.js: dashboard, sesion, permisos, UI, lecturas rapidas y acciones inmediatas.
- n8n: registro inicial, aprovisionamiento, flujos largos y tareas con reintentos.
- Chatwoot: conversaciones, contactos, inboxes y atencion al cliente.
- Evolution API: conexion WhatsApp por QR o instancia.
- Meta API: WhatsApp Cloud API, Instagram y Messenger oficiales.
- ERPNext: clientes, empresas, facturacion, contabilidad, suscripciones y datos empresariales.

## Reglas de seguridad

- Nunca exponer tokens privados en el frontend.
- Nunca usar tokens en componentes React visibles para el cliente.
- Todo acceso a Chatwoot, ERPNext, Evolution API, Meta API y n8n debe pasar por codigo server-side.
- Validar siempre que el usuario pertenece al tenant antes de consultar datos.
- Nunca consultar conversaciones sin validar primero el tenant.
- Nunca confiar en account_id enviado desde el cliente sin validarlo.
- Las variables privadas deben vivir en .env.local o en variables de entorno de produccion.

## Reglas para Chatwoot

- Chatwoot es el motor central de conversaciones.
- Cada tenant debe tener su propio chatwoot_account_id.
- Las URLs de Chatwoot deben recibir el account_id dinamicamente.
- Nunca hardcodear /api/v1/accounts/1.
- La cuenta correcta viene del tenant autenticado.

## Reglas para canales

Appsolux puede conectar varios canales:

- WhatsApp por Evolution API.
- WhatsApp oficial por Meta Cloud API.
- Instagram por Meta.
- Messenger por Meta.

Los canales no son lo mismo que conversaciones.

- Canales: como se conecta el cliente.
- Conversaciones: se gestionan principalmente en Chatwoot.

## Reglas para ERPNext

ERPNext es la fuente administrativa del negocio.

Puede manejar:

- Clientes
- Empresas
- Planes
- Suscripciones
- Facturas
- Pagos
- Contabilidad
- Datos fiscales
- Estado de cuenta del cliente

No tratar ERPNext como un simple registro de clientes.

## Reglas para n8n

Usar n8n para:

- Registro inicial del cliente.
- Crear cuenta en Chatwoot.
- Crear cliente en ERPNext.
- Crear o preparar instancia en Evolution API.
- Procesos con reintentos.
- Automatizaciones personalizadas.

No usar n8n para lecturas rapidas del dashboard si se puede consultar directo desde Next.js server-side.

## Regla de velocidad

Si el usuario espera una respuesta inmediata en el dashboard, usar codigo directo en Next.js.

Ejemplos:

- Ver conversaciones.
- Ver estado de WhatsApp.
- Ver QR.
- Ver facturas.
- Ver estado de tenant.

Si el proceso es largo o involucra varios sistemas, usar n8n.

## Estructura esperada

- app/: rutas, layouts y API routes.
- components/appsolux/: componentes propios de Appsolux.
- components/ui/: componentes shadcn/ui.
- lib/api/: clientes internos para Chatwoot, Evolution, Meta, ERPNext y n8n.
- lib/auth/: sesion y usuario actual.
- lib/tenant/: resolucion y validacion de tenant.
- lib/security/: helpers de seguridad server-side.
- types/: tipos TypeScript compartidos.
- store/: estado cliente si hace falta.
- docs/: documentacion del proyecto.
- config/: configuracion de navegacion, rutas y marca.

## Forma de trabajo

Antes de modificar codigo:

1. Leer estructura actual.
2. Explicar que se va a tocar.
3. Esperar aprobacion si el cambio es grande.
4. Hacer cambios pequenos.
5. Validar con npm run lint o npm run build cuando aplique.

## Prohibido

- Crear una app completa de golpe.
- Hacer refactors grandes sin permiso.
- Instalar paquetes sin explicar por que.
- Borrar archivos sin autorizacion.
- Cambiar configuracion global sin avisar.
- Usar any salvo que sea estrictamente necesario y explicado.
- Inventar endpoints externos.
- Inventar credenciales.