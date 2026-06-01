# Seguridad de la firma electrónica SRI

## El problema

El certificado `.p12` / `.pfx` de firma electrónica contiene una clave privada RSA protegida
por contraseña. Es la identidad digital del emisor. Si se filtra, un tercero puede emitir
comprobantes a nombre de la empresa.

## Lo que NUNCA debe hacerse

- Guardar la contraseña del certificado en texto plano (DB, logs, env vars en código).
- Enviar el certificado al navegador o al cliente.
- Logear el nombre del archivo o la contraseña en ningún nivel.
- Aceptar `tenantId` desde el frontend para buscar el certificado.
- Guardar el certificado como base64 en la DB sin cifrado.

## Diseño seguro para producción

### 1. Almacenamiento del certificado

El archivo `.p12` no se guarda en la DB. Se almacena en un sistema seguro:

- **Opción A**: Sistema de archivos cifrado + referencia en DB (`encryptedCertificateStorageKey`).
- **Opción B**: Gestor de secretos (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault).
- **Opción C**: Volumen cifrado dedicado en el servidor.

La DB solo guarda metadata: nombre, fecha de expiración, emisor, serial, fingerprint SHA-256.

### 2. Contraseña del certificado

La contraseña **nunca** se guarda en texto plano. Si debe persistirse para el worker:

- Se cifra server-side con AES-256-GCM.
- Se guarda solo el valor cifrado (`encryptedCertificatePassword`).
- Nunca se devuelve al frontend ni se escribe en logs.

### 3. Ejecución de la firma

La firma siempre ocurre **server-side**:

1. El servidor carga el certificado desde storage seguro.
2. Descifra con la clave/contraseña disponible solo en servidor.
3. Firma el XML con XAdES-BES usando la clave privada.
4. El XML firmado nunca se envía al cliente (solo al SRI).

```
Client → [POST /api/sri/documents/:id/sign] → Server
Server → [carga cert de storage seguro] → firma XML → [POST SRI WS] → respuesta
```

### 4. Rotación y expiración

- Los certificados del BCE / Security Data tienen vigencia 2-3 años.
- `expiresAt` se guarda en DB para alertas tempranas.
- Al expirar, el sistema debe impedir emisión y alertar al administrador.
- La rotación implica cargar nuevo certificado y actualizar metadata.

### 5. Auditoría

Cada intento de firma debe registrar (sin secretos):

- tenantId
- documentId
- timestamp
- resultado (ok / error)
- Sin certificado, sin contraseña, sin XML en el log.

## Estado actual

- La DB almacena metadata del certificado.
- El certificado cifrado se guarda fuera de la DB y la referencia queda en `encryptedCertificateStorageKey`.
- La contraseña cifrada se guarda en `encryptedCertificatePassword`.
- El dashboard no devuelve ni la ruta real del storage ni secretos al frontend.
- El worker usa ambos valores cifrados para la firma real en ambiente de pruebas.
- No se envía nada al SRI en esta fase.
