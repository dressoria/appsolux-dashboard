# Appsolux - Reglas Multitenant

## Regla principal

Appsolux es una plataforma multitenant.

Cada empresa cliente debe tener su propio tenant.

Nunca se debe mezclar informacion de un tenant con otro.

## Prohibido

Esta prohibido usar identificadores fijos en el codigo.

Ejemplos prohibidos:

```ts
const accountId = 1;
const chatwootAccountId = 1;
const tenantId = "tenant_1";
const companyId = "company_1";
const inboxId = 1;