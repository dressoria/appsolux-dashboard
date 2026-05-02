# Appsolux - Arquitectura Base

## Vision general

Appsolux es un SaaS B2B multitenant construido sobre varios sistemas especializados.

El dashboard en Next.js no reemplaza a los servicios existentes. Su funcion es actuar como portal seguro, rapido y moderno para que cada cliente gestione su cuenta, canales, conversaciones, automatizaciones y datos empresariales.

## Servicios principales

### Next.js Dashboard

Responsable de:

- Interfaz de usuario.
- Login y sesion.
- Validacion del tenant actual.
- Dashboard del cliente.
- API routes seguras.
- Lecturas rapidas.
- Acciones inmediatas del usuario.
- Comunicacion server-side con servicios externos.

### Chatwoot

Responsable de:

- Conversaciones.
- Contactos.
- Inboxes.
- Agentes.
- Bandeja omnicanal.

Chatwoot es el motor principal de atencion al cliente.

Cada tenant de Appsolux debe tener asociado su propio `chatwoot_account_id`.

### ERPNext v15

Responsable de:

- Clientes.
- Empresas.
- Facturacion.
- Contabilidad.
- Suscripciones.
- Pagos.
- Datos fiscales.
- Estado administrativo del cliente.

ERPNext no debe tratarse como una simple base de clientes. Es la fuente administrativa y contable del negocio.

### n8n

Responsable de:

- Aprovisionamiento inicial.
- Registro automatico.
- Crear cuenta en Chatwoot.
- Crear cliente en ERPNext.
- Crear o preparar instancia en Evolution API.
- Procesos largos.
- Automatizaciones con reintentos.
- Workflows personalizados por cliente.

n8n se usa cuando una accion involucra varios sistemas o puede fallar parcialmente.

### Evolution API

Responsable de:

- Conexion WhatsApp mediante QR.
- Instancias por cliente.
- Estado de conexion.
- Reinicio o reconexion de sesiones.
- Envio y recepcion de mensajes por WhatsApp cuando se use este canal.

Cada tenant debe tener su propia instancia o identificador de instancia.

### Meta API

Responsable de conexiones oficiales mediante Meta:

- WhatsApp Cloud API.
- Instagram.
- Messenger.
- Plantillas de WhatsApp.
- Webhooks oficiales.
- OAuth o procesos de conexion autorizados por Meta.

Meta API y Evolution API son canales diferentes. No deben mezclarse como si fueran lo mismo.

## Separacion principal

Appsolux debe separar estos conceptos:

### Canales

Son las formas en que una empresa conecta sus medios de comunicacion.

Ejemplos:

- WhatsApp por Evolution API.
- WhatsApp Cloud API por Meta.
- Instagram por Meta.
- Messenger por Meta.

### Conversaciones

Son los mensajes, contactos e interacciones gestionadas principalmente desde Chatwoot.

### ERP

Es la informacion empresarial, administrativa, contable y comercial del cliente.

### Automatizaciones

Son los procesos orquestados principalmente por n8n.

## Regla de velocidad

Usar Next.js directo cuando el usuario espera una respuesta rapida.

Ejemplos:

- Ver conversaciones.
- Ver contactos.
- Ver estado de WhatsApp.
- Ver QR.
- Ver facturas.
- Ver datos del tenant.
- Cambiar una configuracion simple.

Usar n8n cuando la accion sea larga o involucre varios sistemas.

Ejemplos:

- Registro inicial del cliente.
- Crear cuenta en Chatwoot.
- Crear cliente en ERPNext.
- Crear instancia en Evolution API.
- Ejecutar automatizaciones.
- Procesos con reintentos.
- Sincronizaciones complejas.

## Flujo de registro propuesto

1. El usuario llena el formulario de registro en Next.js.
2. Next.js llama a una API route interna.
3. La API route valida datos basicos.
4. La API route llama un webhook de n8n.
5. n8n crea la cuenta en Chatwoot.
6. n8n obtiene el `chatwoot_account_id`.
7. n8n crea el cliente en ERPNext.
8. n8n crea o prepara la instancia de Evolution API.
9. n8n devuelve los datos iniciales del tenant.
10. Next.js crea o prepara la sesion del usuario.
11. El usuario entra al dashboard.

## Flujo diario del dashboard

1. El usuario inicia sesion.
2. Next.js resuelve el usuario actual.
3. Next.js resuelve el tenant actual.
4. Next.js valida permisos.
5. Next.js obtiene el `chatwoot_account_id` del tenant.
6. Next.js consulta Chatwoot server-side.
7. Next.js devuelve al frontend solo los datos permitidos.
8. El usuario ve sus conversaciones y canales.

## Estructura de carpetas

### app/

Contiene rutas, paginas, layouts y API routes.

### components/appsolux/

Contiene componentes visuales propios de Appsolux.

### components/ui/

Contiene componentes de shadcn/ui.

### lib/api/

Contiene clientes server-side para servicios externos.

Subcarpetas:

- chatwoot/
- evolution/
- meta/
- erpnext/
- n8n/

### lib/auth/

Contiene logica de sesion, usuario actual y permisos.

### lib/tenant/

Contiene logica para resolver el tenant actual y validar acceso.

### lib/security/

Contiene helpers de seguridad server-side.

### types/

Contiene tipos TypeScript compartidos.

### store/

Contiene estado del cliente cuando haga falta.

### docs/

Contiene documentacion tecnica para humanos y agentes IA.

### config/

Contiene rutas, navegacion y configuracion general de la app.

## Regla de seguridad general

El frontend nunca debe tener acceso directo a tokens privados.

Tokens prohibidos en componentes cliente:

- CHATWOOT_PLATFORM_API_TOKEN
- EVOLUTION_API_KEY
- ERPNEXT_API_SECRET
- META_APP_SECRET
- META_WHATSAPP_ACCESS_TOKEN
- N8N_WEBHOOK_SECRET
- INTERNAL_API_SECRET

Toda integracion privada debe pasar por codigo server-side.

## Estado actual

Este proyecto esta en fase inicial.

Primero se debe construir:

1. Base visual.
2. Tipos principales.
3. Variables de entorno.
4. Registro conectado a n8n.
5. Resolucion de usuario y tenant.
6. Dashboard base.
7. Modulo de conversaciones.
8. Modulo de canales.
9. Integracion con ERPNext.
10. Integracion con Meta.