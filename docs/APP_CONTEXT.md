# Appsolux - Contexto del Producto

## Que es Appsolux

Appsolux es una plataforma SaaS B2B para automatizacion, atencion al cliente, mensajeria omnicanal y gestion empresarial.

El objetivo es que una empresa pueda centralizar sus conversaciones, conectar canales como WhatsApp, Instagram y Messenger, automatizar procesos, y gestionar informacion empresarial desde un mismo portal.

## Infraestructura existente

Appsolux ya cuenta con estos servicios backend desplegados en contenedores Docker en Oracle Cloud:

- Chatwoot: motor central de conversaciones.
- ERPNext v15: gestion empresarial, clientes, empresas, facturacion, contabilidad y suscripciones.
- n8n: orquestador de workflows, aprovisionamiento, reintentos y automatizaciones.
- Evolution API: conexion WhatsApp mediante instancia QR.
- Meta API: conexion oficial para WhatsApp Cloud API, Instagram y Messenger.

## Objetivo de este repositorio

Este repositorio contiene el dashboard SaaS de Appsolux construido con Next.js.

El dashboard debe permitir:

- Registro de nuevos clientes.
- Inicio de sesion.
- Visualizacion de conversaciones.
- Conexion de canales.
- Visualizacion de estado de WhatsApp.
- Gestion basica de datos empresariales.
- Consulta futura de facturas, suscripciones y contabilidad.
- Configuracion del tenant.
- Panel administrativo para cada cliente.

## Principio principal

Appsolux es multitenant.

Cada empresa cliente debe tener su propio tenant y sus propios identificadores internos.

Nunca se debe mezclar informacion entre tenants.

## Separacion conceptual

- Canales: medios por donde se conecta el cliente.
- Conversaciones: mensajes gestionados principalmente en Chatwoot.
- ERP: informacion empresarial y contable.
- Automatizaciones: flujos manejados principalmente por n8n.
- Dashboard: interfaz segura y rapida para el usuario final.

## Regla de oro

Si una accion necesita respuesta inmediata en la interfaz, debe hacerse desde Next.js server-side.

Si una accion es larga, involucra varios sistemas o necesita reintentos, debe hacerse con n8n.