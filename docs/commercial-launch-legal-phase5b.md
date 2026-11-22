# FACTUROM WEB — Fase 5B: Identidad Legal y Preparación para Lanzamiento

> Fecha: 2026-11-22

## 1. Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `docs/legal-drafts/terms.txt` | Reemplazados `{{LEGAL_OPERATOR_NAME}}` → BICODEX SYSTEMS S.A.S., `{{LEGAL_OPERATOR_RUC}}` → 1793242481001, `{{LEGAL_SUPPORT_EMAIL}}` → facturomecuador@gmail.com |
| `docs/legal-drafts/privacy.txt` | Reemplazados `{{LEGAL_OPERATOR_NAME}}`, `{{LEGAL_OPERATOR_RUC}}`, `{{LEGAL_SUPPORT_EMAIL}}` |
| `docs/legal-drafts/payments.txt` | Reemplazado `{{LEGAL_SUPPORT_EMAIL}}` → facturomecuador@gmail.com |
| `docs/legal-drafts/refunds.txt` | Reemplazados 2 instancias de `{{LEGAL_SUPPORT_EMAIL}}` → facturomecuador@gmail.com |
| `components/public/public-footer.tsx` | Copyright actualizado: "Facturom — BICODEX SYSTEMS S.A.S." |
| `app/(public)/contacto/page.tsx` | Fallback de email actualizado a facturomecuador@gmail.com |
| `.env.example` | Valores documentados: `LEGAL_OPERATOR_NAME`, `LEGAL_OPERATOR_RUC`, `LEGAL_OPERATOR_COUNTRY`, `LEGAL_SUPPORT_EMAIL`, `SUPPORT_EMAIL` |
| `docs/commercial-launch-legal-phase5b.md` | Este documento |

## 2. Identidad empresarial configurada

| Campo | Valor | Fuente |
|-------|-------|--------|
| Razón social | BICODEX SYSTEMS S.A.S. | Comunicación del propietario con Paddle |
| Nombre comercial | Facturom | Ya configurado en `lib/legal/config.ts` como `tradingName` |
| RUC | 1793242481001 | Comunicación del propietario (formato 13 dígitos validado) |
| País | Ecuador | Confirmado |
| Dominio | facturom.com | Ya configurado en `app/layout.tsx` metadata |
| Correo comercial | facturomecuador@gmail.com | Comunicación del propietario |
| Paddle | Merchant of Record | Paddle procesa pagos en línea; BICODEX no procesa directamente los pagos con tarjeta |

**Distinción operador/tenant:** BICODEX SYSTEMS S.A.S. es el operador del software (proveedor). Los tenants son las empresas cliente que usan Facturom. Esta separación está implementada en el código: `getLegalOperator()` lee de variables de entorno, no del tenant activo.

## 3. Variables `LEGAL_OPERATOR_*` necesarias

| Variable | Valor en `.env.example` | Estado |
|----------|------------------------|--------|
| `LEGAL_OPERATOR_NAME` | BICODEX SYSTEMS S.A.S. | ✅ Configurada |
| `LEGAL_OPERATOR_RUC` | 1793242481001 | ✅ Configurada |
| `LEGAL_OPERATOR_DOMICILE` | (vacía) | ❌ **Pendiente — el propietario debe confirmar el domicilio legal** |
| `LEGAL_OPERATOR_COUNTRY` | Ecuador | ✅ Configurada |
| `LEGAL_SUPPORT_EMAIL` | facturomecuador@gmail.com | ✅ Configurada |
| `LEGAL_PRIVACY_EMAIL` | (vacía) | ❌ **Pendiente — el propietario debe confirmar si usa el mismo correo o uno específico** |
| `LEGAL_NOTICES_EMAIL` | (vacía) | ❌ **Pendiente — el propietario debe confirmar correo para notificaciones legales** |
| `LEGAL_EFFECTIVE_DATE` | (vacía) | ❌ Pendiente — se establece al momento de publicar |
| `LEGAL_DPO_APPLICABILITY` | (vacía) | ❌ **Pendiente — requiere evaluación jurídica: `required` o `not-required-reviewed`** |
| `LEGAL_DPO_CONTACT` | (vacía) | Condicional: solo si DPO es `required` |

## 4. Placeholders que permanecen en borradores

Los siguientes placeholders impiden la publicación automática (el sistema `approveLegalDraft()` rechaza documentos con `{{`):

### Datos del operador (propietario debe confirmar)

| Placeholder | Aparece en | Dato necesario |
|-------------|-----------|----------------|
| `{{LEGAL_OPERATOR_DOMICILE}}` | terms, privacy | Dirección legal completa de BICODEX SYSTEMS S.A.S. |
| `{{LEGAL_PRIVACY_EMAIL}}` | privacy (3 veces) | Correo del responsable de privacidad |
| `{{LEGAL_NOTICES_EMAIL}}` | terms | Correo para notificaciones legales |
| `{{LEGAL_EFFECTIVE_DATE}}` | todos (6 documentos) | Se establece al crear el draft legal |

### Datos técnicos y operativos (propietario debe confirmar)

| Placeholder | Aparece en | Dato necesario |
|-------------|-----------|----------------|
| `{{CONFIRMAR_PROVEEDOR_CLOUD}}` | privacy, dpa | Nombre del proveedor de infraestructura (ej. Oracle Cloud) |
| `{{CONFIRMAR_REGION_DB}}` | privacy | Región de la base de datos |
| `{{CONFIRMAR_MEDIDAS_SEGURIDAD_ADICIONALES}}` | privacy, dpa | Medidas de seguridad adicionales o eliminar el placeholder |
| `{{CONFIRMAR_POLITICA_RENOVACION_AUTOMATICA}}` | terms, payments | Política de renovación automática (texto o eliminar) |
| `{{CONFIRMAR_PERIODO_REFLEXION_APLICABLE}}` | refunds | Período de reflexión aplicable según LODC |

**Total: 21 placeholders en 6 documentos.** La publicación está correctamente bloqueada hasta que todos se resuelvan.

## 5. Documentos que requieren aprobación

| Documento | Ruta pública | Estado actual | Qué falta |
|-----------|-------------|---------------|-----------|
| Términos y Condiciones | `/terminos-y-condiciones` | Borrador con 5 placeholders | Domicilio, email legal, renovación, fecha |
| Política de Privacidad | `/politica-de-privacidad` | Borrador con 8 placeholders | Domicilio, email privacidad, proveedor cloud, región DB, seguridad, fecha |
| Pagos y Suscripciones | `/pagos-y-suscripciones` | Borrador con 2 placeholders | Renovación automática, fecha |
| Tratamiento de Datos | `/acuerdo-tratamiento-datos` | Borrador con 3 placeholders | Proveedor cloud, seguridad, fecha |
| Política de Cookies | `/politica-de-cookies` | Borrador con 1 placeholder | Fecha |
| Política de Reembolsos | `/politica-de-reembolsos` | Borrador con 2 placeholders | Período de reflexión, fecha |

**Pipeline de publicación:**
1. Propietario completa los placeholders.
2. Se ejecuta `prepareLegalDraft()` con el contenido completo.
3. Revisión jurídica de las 11 áreas obligatorias.
4. `approveLegalDraft()` valida: sin `{{`, sin `[PENDIENTE`, identidad completa.
5. `publishLegalRelease()` publica con advisory lock y verifica integridad.

**Mientras no haya release publicado:** Las páginas legales muestran "Documento en preparación" con enlace a contacto. El checkout no procede porque `assertContractOwner()` y `validateLegalProof()` requieren un release activo.

## 6. Estado de las páginas públicas

| Página | URL | Estado | Observaciones |
|--------|-----|--------|---------------|
| Landing | `/` | ✅ Funcional | Identifica Facturom |
| Precios | `/precios` | ✅ Funcional | Tres planes con precios correctos, FAQ, enlaces legales |
| Contacto | `/contacto` | ✅ Funcional | WhatsApp + email (facturomecuador@gmail.com) |
| Registro | `/sign-up` | ✅ Funcional | Clerk, enlaces legales, enlace a precios |
| Términos | `/terminos-y-condiciones` | ⚠️ "En preparación" | Correcto: no hay release publicado |
| Privacidad | `/politica-de-privacidad` | ⚠️ "En preparación" | Correcto: no hay release publicado |
| Cookies | `/politica-de-cookies` | ⚠️ "En preparación" | Correcto: no hay release publicado |
| Pagos | `/pagos-y-suscripciones` | ⚠️ "En preparación" | Correcto: no hay release publicado |
| DPA | `/acuerdo-tratamiento-datos` | ⚠️ "En preparación" | Correcto: no hay release publicado |
| Reembolsos | `/politica-de-reembolsos` | ⚠️ "En preparación" | Correcto: no hay release publicado |
| Footer | Todas las páginas | ✅ Actualizado | "© 2026 Facturom — BICODEX SYSTEMS S.A.S." con 6 enlaces legales |

### Checklist de visibilidad para un visitante

- [x] ¿Qué es Facturom? → Landing + descripción en footer
- [x] ¿Qué empresa opera? → Footer: "BICODEX SYSTEMS S.A.S."
- [x] ¿Qué planes ofrece? → `/precios` con tres planes y precios
- [x] ¿Condiciones de contratación? → Enlaces presentes, contenido pendiente de publicación
- [x] ¿Cómo contactar? → `/contacto` con WhatsApp y email
- [x] ¿Políticas legales? → 6 enlaces en footer, contenido pendiente de publicación

## 7. Estado de los enlaces de registro

| Paso | Estado | Verificación |
|------|--------|-------------|
| Abrir página pública | ✅ | Landing accesible |
| Consultar precios | ✅ | `/precios` con planes correctos |
| Consultar documentos legales | ⚠️ | "En preparación" (correcto, no hay release) |
| Registrarse | ✅ | `/sign-up` con Clerk |
| Crear empresa | ✅ | Flujo existente post-registro |
| Elegir plan | ✅ | UI de planes disponible |
| Activar suscripción | ✅ Bloqueado | No hay Paddle configurado; no hay release legal |

**Protecciones activas:**
- No se activa suscripción por seleccionar plan (requiere checkout completo)
- No se fuerza aceptación de textos legales no publicados (checkout requiere `validateLegalProof()` con release activo)
- No se modifica Clerk Production

### Inconsistencia detectada

| Ubicación | Texto | Problema |
|-----------|-------|----------|
| `/precios` | "Prueba Facturom Básico gratis por 7 días" | Dice 7 días |
| `/sign-up` | "Primeros 3 meses gratis para empezar" | Dice 3 meses |

**Recomendación:** El propietario debe confirmar la oferta de prueba correcta y unificar ambas páginas. No se modificó ninguna porque no se dispone de la información correcta y la restricción prohíbe inventar promociones.

### Nombres de planes en página de contacto

La página `/contacto` usa nombres de planes antiguos en su `intentMap` ("Emprendedor", "Pymes", "Corporativo"). Los planes comerciales actuales son "Básico", "Negocio", "Empresarial". El propietario debería alinear estos nombres.

## 8. Preparación para revisión de Paddle

### Lo que Paddle necesita ver

| Requisito | Estado |
|-----------|--------|
| Identidad comercial coherente | ✅ BICODEX SYSTEMS S.A.S. en footer |
| Descripción del software | ✅ Landing + meta descriptions |
| Precios claros | ✅ `/precios` con tres planes |
| Contacto | ✅ `/contacto` con WhatsApp + email |
| Enlaces legales funcionales | ⚠️ Presentes pero muestran "En preparación" |
| Ausencia de información ficticia | ✅ Solo datos confirmados por el propietario |

### Diferencia entre dominios

| Dominio | Propósito |
|---------|-----------|
| `facturom.com` | Sitio público, landing, precios, legal, contacto |
| `app.facturom.com` | Dashboard de la aplicación (requiere autenticación) |

**Nota:** No se agregaron ni reenviaron dominios a Paddle. No se modificó la cuenta Paddle.

### Bloqueante para Paddle Review

Los documentos legales muestran "En preparación". Paddle podría requerir que las condiciones de servicio estén publicadas antes de aprobar la integración. Se recomienda completar los placeholders y publicar el release legal antes de solicitar la revisión de Paddle.

## 9. Pruebas realizadas

| Prueba | Resultado |
|--------|-----------|
| TypeScript (`tsc --noEmit`) | ✅ Sin errores |
| ESLint | ✅ Sin errores en archivos TS modificados |
| `next build` | ✅ Exitoso |
| `module-access-gates.test.ts` | ✅ 72/72 |
| `paddle-billing.test.ts` | ✅ 34/34 |
| `billing-access-policy.test.ts` | ✅ 14/14 |
| `stripe-billing.test.ts` | ✅ 7/7 |
| **Total tests** | **127/127 pasan** |

### Verificaciones manuales de contenido

| Verificación | Resultado |
|-------------|-----------|
| Precios en `commercial-plans.ts` | ✅ $6.99/$69, $12.99/$129, $29.99/$299 — sin cambios |
| Footer identifica operador | ✅ "BICODEX SYSTEMS S.A.S." |
| Contacto muestra email confirmado | ✅ facturomecuador@gmail.com |
| Placeholders bloquean publicación | ✅ 21 `{{` impiden `approveLegalDraft()` |
| RUC formato válido (13 dígitos) | ✅ 1793242481001 |
| `.env.example` documenta variables | ✅ Con valores confirmados |

## 10. Información que debe proporcionar el propietario

### Urgente (bloquea publicación legal)

| Dato | Para qué | Dónde va |
|------|----------|----------|
| **Domicilio legal de BICODEX SYSTEMS S.A.S.** | Identificación del prestador + jurisdicción | `LEGAL_OPERATOR_DOMICILE` + borradores |
| **Correo de privacidad** (¿mismo que soporte o diferente?) | Solicitudes de datos personales | `LEGAL_PRIVACY_EMAIL` + borradores |
| **Correo de notificaciones legales** (¿mismo que soporte o diferente?) | Avisos contractuales | `LEGAL_NOTICES_EMAIL` + borradores |
| **Evaluación DPO** | ¿Aplica designar DPO? | `LEGAL_DPO_APPLICABILITY` |

### Importante (bloquea contenido legal)

| Dato | Para qué |
|------|----------|
| **Proveedor de infraestructura cloud** | Política de privacidad + DPA (subencargado) |
| **Región de base de datos** | Política de privacidad (transferencias internacionales) |
| **Medidas de seguridad adicionales** (si las hay) | Política de privacidad + DPA, o eliminar placeholder |
| **Política de renovación automática** | Términos + Pagos: ¿se renueva automáticamente o requiere acción? |
| **Período de reflexión** aplicable bajo LODC | Política de reembolsos |

### Recomendado (coherencia comercial)

| Dato | Para qué |
|------|----------|
| **Oferta de prueba correcta** | Alinear "7 días" (precios) vs "3 meses" (registro) |
| **Nombres de planes en contacto** | Alinear "Emprendedor/Pymes/Corporativo" → "Básico/Negocio/Empresarial" |

## Restricciones cumplidas

- ❌ No se cambiaron precios
- ❌ No se cambió identidad visual (#FF0099 / #000345)
- ❌ No se modificó SRI ni workers
- ❌ No se modificó Facturom Mobile
- ❌ No se alteró Clerk Production
- ❌ No se activaron pagos Live
- ❌ No se ejecutaron migraciones en producción
- ❌ No se hizo commit, push ni deploy
- ❌ No se inventaron datos no confirmados (domicilio, teléfonos, correos adicionales)
- ❌ No se publicaron documentos jurídicos incompletos
- ❌ No se escribieron secretos en el repositorio
