# SRI Signing Worker — Arquitectura

## Decisión arquitectónica: Camino B

La firma electrónica XAdES-BES **no se ejecuta desde Next.js directamente**.

Next.js crea un job de firma (`SriSigningJob`) que un worker separado procesa de forma asíncrona.

### Por qué no firma Next.js directamente

- El certificado `.p12` es altamente sensible. Cargarlo en el proceso de Next.js lo expone al runtime de servidor web, que puede tener más superficie de ataque.
- La firma XAdES-BES puede tardar varios segundos y bloquear el event loop.
- Con un worker separado, se puede escalar horizontalmente (múltiples workers en paralelo).
- El worker puede reintentar automáticamente sin lógica compleja en la API.

---

## Flujo completo

```
Usuario solicita firma
        ↓
POST /api/sri/documents/[documentId]/signing-jobs
        ↓
Next.js valida:
  - Autenticación
  - Tenant (nunca desde body)
  - Documento existe y pertenece al tenant
  - Status == READY_FOR_TESTING
  - Checklist técnico sin bloqueos
  - Signature config con metadata mínima
        ↓
Crea SriSigningJob { status: QUEUED }
        ↓
Devuelve { jobId, status, alreadyExists, message }
        ↓
Worker (proceso separado) ejecuta claimNextSriSigningJob(workerId)
        ↓
Worker carga certificado .p12 desde almacenamiento cifrado
Worker aplica firma XAdES-BES al XML del documento
Worker guarda XML firmado en almacenamiento seguro
Worker llama markSriSigningJobSucceeded({ signedXmlStorageKey, signedXmlHash })
        ↓
SriDocument.status → SIGNED (solo cuando haya firma real verificable)
        ↓
Envío al web service del SRI (fase posterior)
```

---

## Modelos involucrados

### SriSigningJob

| Campo | Descripción |
|---|---|
| `tenantId` | Tenant propietario — nunca viene del cliente |
| `documentId` | Comprobante a firmar |
| `status` | QUEUED / RUNNING / SUCCEEDED / FAILED / CANCELLED |
| `priority` | Mayor número = mayor prioridad en la cola |
| `attempts` | Intentos realizados |
| `maxAttempts` | Límite de reintentos (default 3) |
| `lockedAt` | Timestamp cuando el worker tomó el job |
| `lockedBy` | ID del worker que tiene el lock |
| `runAfter` | No procesar antes de esta fecha (para backoff) |
| `startedAt` | Cuando comenzó a ejecutarse |
| `finishedAt` | Cuando terminó (éxito o fallo definitivo) |
| `errorCode` | Código de error (e.g. CERT_EXPIRED, INVALID_XML) |
| `errorMessage` | Mensaje legible del error |
| `unsignedXmlHash` | SHA-256 del XML sin firmar (verificación) |
| `signedXmlStorageKey` | Referencia al XML firmado en almacenamiento seguro |
| `signedXmlHash` | SHA-256 del XML firmado (integridad) |

**Lo que NO hay en el modelo:**
- Certificado binario
- Contraseña del certificado
- Datos sensibles del tenant

---

## Concurrencia y race conditions

`claimNextSriSigningJob` usa una transacción Prisma:

```typescript
prisma.$transaction(async (tx) => {
  const job = await tx.sriSigningJob.findFirst({ where: { status: "QUEUED", ... } });
  if (!job) return null;
  return tx.sriSigningJob.update({
    where: { id: job.id, status: "QUEUED" },  // re-verifica status
    data: { status: "RUNNING", lockedAt, lockedBy, attempts: { increment: 1 } },
  });
});
```

El `where: { status: "QUEUED" }` en el `update` garantiza que si dos workers tomaron el mismo job simultáneamente, solo uno tendrá éxito (el otro recibirá un error de Prisma por no encontrar el registro).

**Riesgo residual:** Si la DB no es serializable, puede haber un read-then-write gap. Los workers deben verificar que el update afectó exactamente 1 registro.

---

## Reintentos

`markSriSigningJobFailed` implementa backoff exponencial:

```typescript
runAfter = new Date(Date.now() + 60_000 * job.attempts)
```

- Intento 1 falla → espera 60s
- Intento 2 falla → espera 120s
- Intento 3 falla → status FAILED (definitivo)

Si `attempts >= maxAttempts`, el status queda como `FAILED` y no se encola de nuevo.

---

## Seguridad del certificado

El certificado `.p12` **nunca se almacena en la base de datos principal** como texto plano o base64.

Opciones de almacenamiento (para la fase de implementación real):

1. **KMS (Key Management Service):** El certificado cifrado se almacena en S3/OCI Object Storage. La clave de cifrado en AWS KMS / OCI Vault.
2. **Volumen cifrado:** El worker corre en una VM con volumen cifrado montado. El certificado vive en el filesystem cifrado.
3. **Secreto de entorno:** Para ambientes de prueba, como variable de entorno base64 en el worker (no recomendado para producción).

El campo `encryptedCertificateStorageKey` en `SriSignatureConfig` almacenará la referencia al certificado cifrado (e.g. `s3://bucket/tenant-id/cert.enc`) — nunca el contenido.

---

## Variables de entorno del worker (futuras)

```env
# Almacenamiento del certificado
SIGNING_CERT_STORAGE_BUCKET=appsolux-signing-certs
SIGNING_CERT_KMS_KEY_ARN=arn:aws:kms:...

# Identidad del worker
SIGNING_WORKER_ID=worker-1

# Base de datos (misma que Next.js o replica)
DATABASE_URL=postgresql://...

# Logging (sin datos sensibles)
LOG_LEVEL=info
```

---

## Lo que NO hace el worker

- NO guarda contraseñas.
- NO expone el certificado por red.
- NO loguea datos sensibles (XML completo, contraseñas, claves privadas).
- NO conecta al SRI todavía (eso es una fase posterior).
- NO usa n8n — n8n es para onboarding y workflows de negocio, no firma criptográfica.

---

## Estado actual (Fase 11)

- [x] Modelo `SriSigningJob` en Prisma
- [x] Enum `SriSigningJobStatus`
- [x] Helpers: `createSriSigningJobForDocument`, `getLatestSriSigningJobForDocument`, `listSriSigningJobsForTenant`, `claimNextSriSigningJob`, `markSriSigningJobSucceeded`, `markSriSigningJobFailed`
- [x] API: `POST /api/sri/documents/[documentId]/signing-jobs`
- [x] API: `GET /api/sri/documents/[documentId]/signing-jobs/latest`
- [x] UI: `SriSigningJobSection` en detalle del comprobante
- [ ] Worker real (proceso separado — fase posterior)
- [ ] Carga de certificado .p12 desde almacenamiento cifrado
- [ ] Firma XAdES-BES real
- [ ] Envío al SRI
- [ ] Autorización y RIDE

---

## Fase siguiente

1. Crear repositorio/carpeta `signing-worker/` (Node.js o similar).
2. Instalar librería XAdES (e.g. `xades4j` equivalente en JS, o invocar herramienta CLI).
3. Implementar `claimNextSriSigningJob` desde el worker con polling o notificación.
4. Configurar almacenamiento cifrado para el `.p12`.
5. Conectar al web service del SRI (SOAP, ambiente pruebas primero).
6. Implementar flujo de autorización y generación de RIDE.
