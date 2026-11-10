# Contratos Facturom: borradores y publicación

Los cinco archivos de `drafts/` son propuestas completas para revisión; **no se publican por desplegar código o aplicar la migración**. Contienen referencias `{{campo}}` deliberadamente sin resolver. No deben presentarse como contratos vigentes. Las cinco rutas públicas muestran un aviso de indisponibilidad hasta que exista un conjunto publicado completo; los contratos nuevos fallan con `LEGAL_NOT_PUBLISHED`. Las empresas existentes conservan su acceso, y la recuperación de pagos anteriores no exige inventar una aceptación retroactiva.

## Identificación y anexos por completar

Configurar en servidor los `LEGAL_*` de `.env.example`: razón social, RUC y titularidad verificados, domicilio, país, soporte, privacidad, notificaciones legales, vigencia ISO y evaluación de delegado. `not-required-reviewed` exige evaluación documentada; `required` exige contacto de delegado. La marca Facturom no reemplaza esta identidad. No se toma la identidad ni cuenta bancaria de otra empresa como sustituto.

El abogado y el operador deben completar también, en copias revisadas de los cinco textos, los anexos de avisos de renovación y entrega de copias, atención y revisión de transferencias, cancelación y reembolsos, transición de planes, tratamiento tributario, inventario de tratamientos y bases, subencargados/países, mecanismos de transferencia internacional, conservación/bloqueo/respaldos, seguridad, incidentes, derechos, salida, cambios de subencargados, evaluación de IA e inventario de cookies observado. No se inventaron SLA, retenciones, certificaciones o prohibiciones absolutas de reembolso.

La LODC publicada por el Ministerio incluye en su art. 41 información sobre entrega de copia y aviso de renovación automática con quince días de anticipación cuando sea aplicable. **Esta implementación no acredita que Paddle envíe ese aviso con el contenido y anticipación necesarios para cada comprador ecuatoriano**. Antes de publicar o comercializar, el abogado debe determinar aplicabilidad y el operador acreditar el mecanismo efectivo, responsable y entrega; no basta marcar la revisión. Debe habilitarse el envío adicional que resulte necesario antes de operar ese flujo. Similar validación se exige para desistimiento/devolución y las obligaciones del operador ante SRI; este cambio no implementa un nuevo emisor fiscal.

## Procedimiento explícito, después de revisión y autorización

1. `npm run legal:contracts -- check` no escribe en base ni publica; informa la configuración faltante.
2. Preparar un directorio con los cinco archivos `terms.md`, `privacy.md`, `payments.md`, `dpa.md`, `cookies.md` revisados. Sustituir **todos** los marcadores de anexos y confirmar los datos del operador. No alterar directamente versiones aprobadas.
3. `npm run legal:contracts -- prepare --version VERSION --directory DIRECTORIO_REVISADO` guarda solo un DRAFT con el contenido íntegro y hashes. Exige una fecha de vigencia real configurada; no asigna una ficticia. Revisar el `id` y el hash devueltos, y distribuir una copia verificable para aprobación.
4. Preparar un JSON de revisión con las claves enumeradas por `legalReviewAreas` en `lib/legal/publication.ts`. Cada `true` representa una revisión real sustentada en el expediente externo; no es un certificado automático. Aprobar el contenido exacto con `approve --id ID --hash SHA256 --lawyer-reference REFERENCIA_EXPEDIENTE --review-file ARCHIVO_JSON`.
5. Publicar únicamente con autorización: `publish --id ID --hash SHA256 --publish-reviewed-contracts`. No existe endpoint público de aprobación/publicación. Se serializa la publicación en PostgreSQL y se conserva el texto y la referencia de revisión. Si la vigencia es futura, el conjunto actual se conserva hasta que el nuevo resulte aplicable; el selector elige el publicado efectivo más reciente.
6. Verificar las cinco rutas públicas, cada enlace con versión, la evidencia de una operación local o autorizada y el procedimiento de avisos. Una modificación material exige una versión nueva y comunicación o aceptación conforme al análisis jurídico. No se presume retroactividad ni se impone un bloqueo masivo por la migración.

## Evidencia y límites

`LegalRelease` sella el conjunto; cada `LegalDocumentVersion` conserva tipo, versión, contenido, hash, publicación, vigencia y estado. `LegalAcceptance` vincula usuario de servidor, tenant, documentos/hashes/acción, contexto, plan/ciclo y referencia única de la operación. `acceptedAt` y `createdAt` son valores de servidor/base en UTC. El frontend aporta una acción afirmativa y referencia al conjunto vigente; no decide identidad, texto, fecha o hash aceptado. Se revalida membresía owner activa dentro de la transacción.

Términos, pagos y DPA se aceptan; privacidad y cookies se registran como información recibida, no como autorización universal. No hay consentimiento de marketing en esta casilla. La compra Paddle, autorización de cambio de plan y solicitud bancaria conservan una FK a su aceptación en la misma transacción. El onboarding guarda empresa, membresía, prueba y aceptación juntos. Con Clerk, las rutas antiguas de registro no crean otra cuenta/empresa al margen del onboarding autenticado. En el flujo alternativo de registro se exige la misma evidencia y se impide continuar con aprovisionamiento si no pudo guardarse.

Los triggers PostgreSQL impiden editar/eliminar evidencia contractual o contenidos revisados/publicados. Los roles de base de la aplicación deben tener privilegios mínimos y no poder deshabilitar triggers; un superusuario de PostgreSQL puede eludirlos, por lo que se requieren control de acceso y copias adecuadas. El hash prueba integridad comparada con una copia confiable, no una firma electrónica cualificada ni identidad jurídica verificada por terceros.

El owner puede consultar `/billing/contracts` y `/api/legal/history`; el tenant se resuelve de la sesión, sin aceptar uno del frontend. El historial no incluye IP o user-agent. Los textos que ya fueron publicados son públicos por versión; borradores y evidencias de otros tenants no lo son.

La recogida técnica adicional está apagada por defecto. Solo configurar `LEGAL_TECHNICAL_RETENTION_DAYS` después de aprobar necesidad, plazo y política. IP seudonimizada con HMAC solo si existe `LEGAL_IP_HASH_SECRET` y un encabezado expresamente confiable/sobrescrito por el proxy; nunca se confía automáticamente en X-Forwarded-For. User-agent se limita a 200 caracteres. Los datos quedan en una tabla expirable separada. `purge-expired-technical` informa el conteo; con `--apply` elimina exclusivamente esos metadatos vencidos, conservando el contrato. Programar la purga después de autorización; no se ejecutó en producción. La retención contractual e identidad debe aprobarse y operacionalizarse con sus excepciones legales y bloqueos, sin prometer conservación indefinida.

## Inventario técnico de cookies y asistentes

Comprobado en código: sesión alternativa `appsolux_session` (HttpOnly, SameSite=Lax, Secure en producción, siete días); Clerk en el layout y sus mecanismos documentados de sesión; Paddle cargado únicamente en la pantalla de checkout aceptado. No se identificaron scripts propios de analítica ni publicidad. El código no basta para enumerar las cookies efectivamente fijadas por proveedores en un despliegue; verificar dominios, duración y finalidades en navegador con la instancia real, sin generar otro pago.

Las preferencias locales conocidas de sidebar se controlan en `lib/legal/browser-storage.ts`: apagadas por defecto, rechazo/borrado y modificación desde Preferencias de cookies. La elección se guarda aparte en el navegador; no se mezcla con el registro contractual. No se bloquean las cookies necesarias de Clerk o pagos. No se añade una analítica para justificar un banner.

Los motores `ai-invoice-proposal-engine.ts` y `ai-invoice-exact-solver.ts` calculan propuestas localmente; no se encontró una llamada a modelos externos en ellos. Debe revisarse el despliegue y las integraciones realmente habilitadas antes de una afirmación pública más amplia. No se incorporó ningún proveedor de IA ni se solicitó una clave.

## Fuentes primarias consultadas (10 de noviembre de 2026)

- [Marco normativo SPDP: LOPDP y Reglamento General, particularmente art. 41 sobre encargo](https://www.spdp.gob.ec/marco-normativo/).
- [Registro Oficial 435, Decreto 904](https://www.registroficial.gob.ec/tercer-suplemento-al-registro-oficial-no-435/).
- [Resoluciones SPDP](https://www.spdp.gob.ec/resoluciones/): 2025-0006-R sobre cláusulas contractuales; 2026-0004-R transferencias; 2026-0009-R y reforma 2026-0037-R sobre IA; 2026-0040-R sobre notificación de vulneraciones. Revisar alcance, vigencia y disposiciones transitorias en el expediente jurídico, sin trasladar mecánicamente reglas ajenas al tratamiento real.
- [Texto oficial de Defensa del Consumidor publicado por Producción](https://www.produccion.gob.ec/wp-content/uploads/2025/03/LEY-ORGANICA-DE-DEFENSA-DEL-CONSUMIDOR_2022_02_11.pdf), incluidas contratación, cláusulas prohibidas, renovación y devolución según aplicabilidad.
- [Ley de Comercio Electrónico publicada por Telecomunicaciones](https://www.telecomunicaciones.gob.ec/wp-content/uploads/2020/07/LEY-DE-COMERCIO-ELECTRONICO-FIRMAS-Y.pdf).
- [Paddle Buyer Terms](https://www.paddle.com/legal/buyer-terms), [Refund Policy](https://www.paddle.com/legal/refund-policy) y [Terms](https://www.paddle.com/legal/terms).
- [Clerk: cookies](https://clerk.com/docs/guides/how-clerk-works/cookies) y [terminología de sesiones](https://clerk.com/docs/guides/development/sdk-development/terminology).

Estos borradores son propuestas sujetas a revisión por un profesional ecuatoriano y confirmación de operaciones. Las fuentes consultadas no constituyen certificación de cumplimiento de Facturom.
