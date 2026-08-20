# Stripe Test para Facturom

Esta integración usa Stripe Checkout alojado y Stripe Billing Portal. Empieza exclusivamente en **Test mode**.

Stripe es opcional: si las ocho variables indicadas abajo están vacías o incompletas, Facturom sigue iniciando y mostrando planes, trial y estado de billing. Checkout, Portal y Webhook responden como proveedor no disponible sin intentar conectarse a Stripe.

## 1. Crear productos y Prices

En Stripe Dashboard, activa **Test mode** y crea tres productos con dos Prices recurrentes USD cada uno:

| Producto | Mensual | Anual |
| --- | ---: | ---: |
| Facturom Básico | USD 6.99 | USD 69.00 |
| Facturom Negocio | USD 12.99 | USD 129.00 |
| Facturom Empresarial | USD 29.99 | USD 299.00 |

Cada Price debe ser `Recurring`: intervalo mensual o anual según corresponda. Copia sus identificadores `price_...` en:

```dotenv
STRIPE_PRICE_BASIC_MONTHLY=
STRIPE_PRICE_BASIC_YEARLY=
STRIPE_PRICE_BUSINESS_MONTHLY=
STRIPE_PRICE_BUSINESS_YEARLY=
STRIPE_PRICE_ENTERPRISE_MONTHLY=
STRIPE_PRICE_ENTERPRISE_YEARLY=
```

## 2. Clave secreta

Desde **Developers → API keys**, copia la clave secreta de Test mode a `STRIPE_SECRET_KEY`. Nunca uses `NEXT_PUBLIC_` para esta clave.

## 3. Webhook local

Con Stripe CLI autenticado en Test mode:

```bash
stripe listen --forward-to localhost:3000/api/billing/stripe/webhook
```

Copia el `whsec_...` mostrado por la CLI a `STRIPE_WEBHOOK_SECRET`. Para el endpoint de Stripe Dashboard usa:

```text
https://TU_DOMINIO/api/billing/stripe/webhook
```

Suscribe estos eventos:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

## 4. Billing Portal

En **Settings → Billing → Customer portal**:

- permite actualizar métodos de pago;
- permite consultar facturas;
- habilita cancelación al final del periodo;
- habilita cambios entre los seis Prices si se usarán upgrades/downgrades;
- revisa la política de prorrateo elegida por el negocio.

Facturom delega upgrades y downgrades de suscripciones activas al Portal para no implementar prorrateos manuales.

## 5. URLs

Configura `PLATFORM_PUBLIC_URL` con el origen público de la aplicación, sin ruta final. Checkout vuelve a:

- éxito: `/billing?checkout=success`
- cancelación: `/billing?checkout=cancelled`

El redirect de éxito no activa el plan; solo `invoice.paid` verificado lo hace.

## 6. Prueba mínima

1. Crea un tenant nuevo y confirma estado `trialing`.
2. Elige Básico mensual en `/billing`.
3. Completa Checkout con una tarjeta Test de Stripe.
4. Confirma recepción de `invoice.paid` y estado local `active`.
5. Simula `invoice.payment_failed`: debe quedar `past_due` con tres días de gracia.
6. Simula el pago recuperado: debe volver a `active` y limpiar `graceEndsAt`.
7. Programa cancelación en Portal: debe conservar acceso hasta el fin del periodo.

Antes de Live mode crea Prices live separados, registra un endpoint webhook live y carga secretos live únicamente en el gestor de variables del entorno de producción.

## Activar Stripe posteriormente

1. Crea los seis Prices recurrentes y copia sus identificadores en las seis variables `STRIPE_PRICE_*`.
2. Configura `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET` para el mismo modo, Test o Live.
3. Configura `PLATFORM_PUBLIC_URL` con el dominio correcto.
4. Reinicia o vuelve a desplegar la aplicación para cargar las variables.
5. Ejecuta la prueba mínima anterior y verifica los eventos en Stripe Dashboard antes de habilitar el cobro a clientes.

La disponibilidad solo se activa cuando las ocho variables de Stripe están completas. Nunca copies claves secretas a variables `NEXT_PUBLIC_*` ni al navegador.
