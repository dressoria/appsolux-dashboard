# FACTUROM WEB — Fase 3: Documentos Legales y Privacidad

## 1. Archivos creados y modificados

### Creados

| Archivo | Propósito |
|---------|-----------|
| `app/politica-de-reembolsos/page.tsx` | Nueva ruta pública para Política de Reembolsos |
| `components/public/legal-document-page.module.css` | CSS module para diseño de páginas legales: TOC, tipografía, cross-links, responsive, brand colors |
| `docs/legal-drafts/privacy.txt` | Borrador: Política de Privacidad |
| `docs/legal-drafts/terms.txt` | Borrador: Términos y Condiciones |
| `docs/legal-drafts/cookies.txt` | Borrador: Política de Cookies |
| `docs/legal-drafts/payments.txt` | Borrador: Condiciones de Pagos y Suscripciones |
| `docs/legal-drafts/dpa.txt` | Borrador: Acuerdo de Tratamiento de Datos |
| `docs/legal-drafts/refunds.txt` | Borrador: Política de Reembolsos |
| `docs/legal-compliance-phase3.md` | Este documento |

### Modificados

| Archivo | Cambio |
|---------|--------|
| `lib/legal/catalog.ts` | Añadido tipo "refunds" al catálogo de documentos legales (6 documentos total) |
| `lib/legal/publication.ts` | Corregido conteo hardcodeado de documentos (5 → `legalDocuments.length`) |
| `components/public/legal-document-page.tsx` | Rediseño completo: brand colors (#000345/#FF0099), índice navegable (desktop sidebar + mobile dropdown), parsing de secciones (## / ### / listas), cross-links entre documentos, diseño "pending" para documentos no publicados, SEO metadata export |
| `components/public/public-footer.tsx` | Añadido enlace "Reembolsos" al nav legal del footer |
| `app/(public)/precios/page.tsx` | Añadido texto legal bajo CTA: Términos y Privacidad |
| `app/sign-up/[[...sign-up]]/page.tsx` | Añadidos enlaces a Términos y Privacidad (panel lateral izquierdo + bajo el formulario Clerk) |
| `app/politica-de-privacidad/page.tsx` | Añadido export de metadata SEO |
| `app/terminos-y-condiciones/page.tsx` | Añadido export de metadata SEO |
| `app/politica-de-cookies/page.tsx` | Añadido export de metadata SEO |
| `app/pagos-y-suscripciones/page.tsx` | Añadido export de metadata SEO |
| `app/acuerdo-tratamiento-datos/page.tsx` | Añadido export de metadata SEO |

## 2. Rutas legales

| Ruta | Documento | Autenticación | Estado |
|------|-----------|---------------|--------|
| `/terminos-y-condiciones` | Términos y Condiciones | Pública | Existente, rediseñada |
| `/politica-de-privacidad` | Política de Privacidad | Pública | Existente, rediseñada |
| `/pagos-y-suscripciones` | Condiciones de Pagos y Suscripciones | Pública | Existente, rediseñada |
| `/acuerdo-tratamiento-datos` | Acuerdo de Tratamiento de Datos | Pública | Existente, rediseñada |
| `/politica-de-cookies` | Política de Cookies | Pública | Existente, rediseñada |
| `/politica-de-reembolsos` | Política de Reembolsos | Pública | **Nueva** |

Todas las rutas son accesibles sin autenticación. No están dentro de `(public)` route group porque tienen su propio layout autocontenido con header y footer.

## 3. Identidad del prestador encontrada

El proyecto utiliza variables de entorno para la identidad del operador legal, definidas en `lib/legal/config.ts`:

| Variable | Propósito | Estado |
|----------|-----------|--------|
| `LEGAL_OPERATOR_NAME` | Razón social del operador | **No configurada** |
| `LEGAL_OPERATOR_RUC` | RUC del operador (13 dígitos) | **No configurada** |
| `LEGAL_OPERATOR_DOMICILE` | Domicilio del operador | **No configurada** |
| `LEGAL_OPERATOR_COUNTRY` | País | **No configurada** |
| `LEGAL_SUPPORT_EMAIL` | Correo de soporte | **No configurada** |
| `LEGAL_PRIVACY_EMAIL` | Correo de privacidad | **No configurada** |
| `LEGAL_NOTICES_EMAIL` | Correo de notificaciones legales | **No configurada** |
| `LEGAL_EFFECTIVE_DATE` | Fecha de vigencia (ISO) | **No configurada** |
| `LEGAL_DPO_APPLICABILITY` | Evaluación DPO | **No configurada** |

La marca comercial es "Facturom" (configurada en `config.ts` como `tradingName`).

**El dominio de producción es `facturom.com`** (confirmado en `app/layout.tsx` metadata y footer).

**No se encontró razón social, RUC ni datos públicos empresariales en el código fuente.** El sistema está diseñado para que esta información se configure externamente vía variables de entorno, y la publicación de documentos legales no procede hasta que esté completa (ver `missingLegalOperatorFields()`).

## 4. Información que falta confirmar

Los borradores en `docs/legal-drafts/` contienen marcadores `{{PLACEHOLDER}}` para datos que requieren confirmación:

| Marcador | Aparece en | Requiere |
|----------|-----------|----------|
| `{{LEGAL_OPERATOR_NAME}}` | Todos | Razón social del titular del negocio |
| `{{LEGAL_OPERATOR_RUC}}` | Todos | RUC del operador (13 dígitos verificado) |
| `{{LEGAL_OPERATOR_DOMICILE}}` | Todos | Domicilio completo del operador |
| `{{LEGAL_PRIVACY_EMAIL}}` | privacy, dpa | Correo del responsable de protección de datos |
| `{{LEGAL_SUPPORT_EMAIL}}` | Todos | Correo de soporte al cliente |
| `{{LEGAL_NOTICES_EMAIL}}` | terms | Correo para notificaciones legales |
| `{{LEGAL_EFFECTIVE_DATE}}` | Todos | Fecha de vigencia de los documentos |
| `{{CONFIRMAR_PROVEEDOR_CLOUD}}` | privacy, dpa | Nombre del proveedor de infraestructura (Oracle Cloud, AWS, etc.) |
| `{{CONFIRMAR_REGION_DB}}` | privacy | Región de la base de datos |
| `{{CONFIRMAR_MEDIDAS_SEGURIDAD_ADICIONALES}}` | privacy, dpa | Medidas de seguridad verificadas no listadas |
| `{{CONFIRMAR_POLITICA_RENOVACION_AUTOMATICA}}` | terms, payments | Si la renovación automática está implementada y comunicada |
| `{{CONFIRMAR_PERIODO_REFLEXION_APLICABLE}}` | refunds | Evaluación jurídica del período de reflexión aplicable en Ecuador |

**El sistema de publicación (`approveLegalDraft`) rechaza automáticamente contenido con `{{` para evitar publicación accidental de borradores incompletos.**

## 5. Proveedores tecnológicos identificados

| Proveedor | Función | País | Referencia en código |
|-----------|---------|------|---------------------|
| Clerk | Autenticación (SSO, sesiones, MFA) | EE.UU. | `@clerk/nextjs` en layout, sign-up/sign-in |
| Paddle | Procesamiento de pagos (merchant of record) | UK/UE | `PaddleCheckoutClient`, env `PADDLE_*` |
| SRI Ecuador | Autorización de comprobantes electrónicos | Ecuador | `app/sri/`, `lib/core/sri-*` |
| PostgreSQL | Base de datos principal | {{CONFIRMAR}} | `DATABASE_URL` en env |
| Oracle Cloud | Infraestructura backend (Chatwoot, ERPNext, n8n, Evolution API) | {{CONFIRMAR_REGION}} | CLAUDE.md documenta Docker en Oracle Cloud |

**No se encontraron:** Google Analytics, PostHog, Mixpanel, Hotjar, Clarity, Vercel Analytics, ni otras herramientas de analítica web.

## 6. Estado de cookies

### Sistema existente
El proyecto ya tiene un sistema funcional de gestión de cookies:
- `CookiePreferences` component: diálogo modal con opciones de aceptar/rechazar cookies funcionales opcionales.
- `browser-storage.ts`: gestión granular de localStorage con lista explícita de claves funcionales.
- Se muestra en todas las páginas (incluido en el root `layout.tsx`).

### Clasificación de cookies implementada

| Categoría | Tecnologías | Consentimiento |
|-----------|-------------|----------------|
| **Necesarias** | Cookies de sesión Clerk, cookies de checkout Paddle, registro de preferencia de cookies | No requerido |
| **Funcionales opcionales** | 5 claves de localStorage para preferencias del menú lateral | Consentimiento explícito |
| **Analíticas** | Ninguna | N/A |
| **Marketing** | Ninguna | N/A |

### Verificaciones realizadas
- `grep` exhaustivo en el codebase: no se encontraron scripts de analítica, rastreo ni marketing.
- El botón "Preferencias de cookies" funciona correctamente.
- Al rechazar cookies opcionales, se eliminan las claves de localStorage asociadas.
- La autenticación no se ve afectada al rechazar cookies opcionales.

## 7. Estado del registro

### Flujo actual (Clerk)
1. Usuario accede a `/sign-up` → Clerk `<SignUp />` maneja creación de cuenta.
2. Tras autenticación, usuario accede a `/onboarding` → formulario de registro de empresa.
3. `createTenantAction()` recoge `proofFromForm(formData)` para aceptación legal.
4. `bootstrapAuthenticatedUserTenant()` → `recordLegalAcceptance()` persiste la aceptación.

### Enlaces legales añadidos
- **Sign-up page** (`/sign-up`): texto "Al crear tu cuenta aceptas los Términos y Condiciones y reconoces nuestra Política de Privacidad" con enlaces, debajo del componente `<SignUp />` de Clerk y en el panel lateral izquierdo.
- **Pricing page** (`/precios`): texto similar bajo la sección CTA.
- **Footer público**: enlace "Reembolsos" añadido al nav legal existente.

### Distinciones implementadas
- **Aceptación contractual** (Terms, Payments, DPA): `action: "ACCEPTED"` en el catálogo.
- **Notificación de privacidad** (Privacy, Cookies, Refunds): `action: "ACKNOWLEDGED"` en el catálogo.
- El componente `ContractAcceptance` muestra checkbox de aceptación explícita ("He leído y acepto...") + checkbox de representación ("Declaro estar autorizado..."), vinculados a la versión exacta del release legal.

## 8. Integración pendiente de Clerk

**No se modificó Clerk Production.** Los cambios en la página de sign-up son puramente de UI (texto informativo y enlaces). Clerk no recibe información adicional.

### Configuración manual pendiente
Si se desea agregar los enlaces a Términos y Privacidad dentro del componente `<SignUp />` de Clerk (no debajo), se debe configurar en Clerk Dashboard:
- Clerk Dashboard → Customization → Terms of Service URL: `https://facturom.com/terminos-y-condiciones`
- Clerk Dashboard → Customization → Privacy Policy URL: `https://facturom.com/politica-de-privacidad`

Esto es independiente de los cambios de esta fase y no afecta la funcionalidad actual.

## 9. Revisión jurídica pendiente

Los borradores en `docs/legal-drafts/` son **borradores sujetos a revisión jurídica** antes de publicación. Las áreas de revisión están definidas en `legalReviewAreas` en `lib/legal/publication.ts`:

| Área | Descripción | Estado |
|------|-------------|--------|
| `operator` | Identidad completa del operador | Pendiente de configuración de env vars |
| `subprocessorsAndCountries` | Verificación de subencargados y países | Pendiente: confirmar proveedor cloud |
| `retentionSchedule` | Plazos de retención de datos | Pendiente: verificar con normativa SRI |
| `securityAndIncidents` | Medidas de seguridad verificadas | Pendiente: confirmar medidas adicionales |
| `consumerRenewalNotices` | Avisos de renovación al consumidor | Pendiente: confirmar flujo de renovación |
| `cancellationAndRefunds` | Cancelación y reembolsos | Pendiente: validar con jurídico |
| `taxTreatment` | Tratamiento fiscal | Pendiente: confirmar manejo de IVA |
| `cookiesBrowserInventory` | Inventario de cookies verificado | Completado en esta fase |
| `dpoAssessment` | Evaluación de necesidad de DPO | Pendiente: evaluación jurídica |
| `internationalTransfers` | Transferencias internacionales | Pendiente: confirmar garantías |
| `aiAssessment` | Evaluación de IA/decisiones automatizadas | Completado: sin IA actualmente |

### Proceso de publicación
El sistema requiere 3 pasos secuenciales, cada uno con verificación de integridad:
1. `prepareLegalDraft()` → crea borrador con SHA-256 de cada documento.
2. `approveLegalDraft()` → requiere identidad completa + revisión de TODAS las áreas + contenido sin `{{` ni `[PENDIENTE]`.
3. `publishLegalRelease()` → verifica identidad igual a la aprobada, publica inmediatamente.

## 10. Pruebas realizadas

### Verificaciones automatizadas
- **TypeScript** (`tsc --noEmit`): Sin errores.
- **ESLint**: Sin errores ni warnings en archivos modificados.
- **Next.js build**: Compilación exitosa. Todas las rutas generadas.

### Verificaciones de ruta
- `/politica-de-reembolsos` aparece en el build output como ruta dinámica (ƒ).
- Todas las rutas legales (6) accesibles sin autenticación.

### Verificaciones de diseño
- CSS module compila correctamente.
- Responsive: layout sidebar TOC en desktop (≥1024px), dropdown TOC en mobile.
- Brand colors aplicados: #000345 para títulos y headings, #1769E0 para links.
- Cross-links entre todos los documentos legales.
- Estado "pending": box con icono, texto informativo y enlace a contacto.

### No verificados en esta fase
- Sesión autenticada real con Clerk.
- Visualización en navegador del contenido publicado (requiere release legal activo en DB).
- Renderizado real de borradores en las páginas (requiere configuración de operator + publicación).

## 11. Riesgos antes del lanzamiento comercial

### 1. Identidad del operador no configurada
**Criticidad: BLOQUEANTE.**
Sin las variables `LEGAL_OPERATOR_*` configuradas, no se puede aprobar ni publicar ningún release legal. Los documentos legales muestran el mensaje de "pendiente de publicación". Ninguna contratación comercial puede procesarse hasta que los documentos estén publicados.

### 2. Revisión jurídica no realizada
**Criticidad: BLOQUEANTE.**
Los borradores son un punto de partida basado en la inspección del código y la normativa ecuatoriana, pero NO constituyen asesoramiento jurídico. Un abogado debe revisar:
- Cumplimiento LOPDP y Reglamento General.
- Conformidad con Ley de Defensa del Consumidor.
- Cláusulas de limitación de responsabilidad.
- Período de reflexión aplicable.
- Política de renovación automática.
- Obligaciones tributarias del operador respecto a la venta del servicio SaaS.

### 3. Eliminación de datos y cuentas
**Criticidad: ALTA.**
No existe un mecanismo de autoservicio para:
- Solicitar eliminación de cuenta.
- Ejercer derechos ARCO/LOPDP de forma automatizada.
- Dar seguimiento a solicitudes de protección de datos.

La Política de Privacidad indica un proceso manual por email, lo cual es legal pero no escalable. Se recomienda implementar un flujo de solicitud en una fase posterior, con las protecciones necesarias para datos sujetos a conservación tributaria obligatoria.

### 4. Enforcement de límites de plan
Los Términos mencionan límites de productos, usuarios y puntos de emisión por plan. Como se documentó en la Fase 2 (riesgo #3), no hay evidencia de enforcement server-side. Publicar límites contractuales sin enforcement técnico podría generar expectativas no cumplidas.

### 5. Renovación automática
Los Términos y Condiciones de Pagos no afirman categóricamente la renovación automática (`{{CONFIRMAR_POLITICA_RENOVACION_AUTOMATICA}}`). Si Paddle ejecuta renovación automática, los términos deben reflejarlo explícitamente y se deben implementar avisos de renovación conforme a normativa de consumidor.

### 6. DPO (Delegado de Protección de Datos)
La variable `LEGAL_DPO_APPLICABILITY` requiere una evaluación jurídica para determinar si Facturom está obligado a designar un DPO conforme a la LOPDP. Esta evaluación debe completarse antes de la publicación de la Política de Privacidad.

### 7. Firmas electrónicas almacenadas
Los certificados P12 (firma electrónica) se almacenan cifrados. Verificar que el mecanismo de cifrado cumple con las mejores prácticas y documentarlo para la revisión jurídica de seguridad.
