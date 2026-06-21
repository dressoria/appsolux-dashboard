-- Agrega campos de almacenamiento para XML autorizado y RIDE/PDF por comprobante.
-- authorizedXmlStorageKey: ruta relativa al XML de autorización devuelto por el SRI.
-- ridePdfStorageKey: ruta relativa al PDF/RIDE generado tras autorización.

ALTER TABLE "SriSubmissionJob" ADD COLUMN IF NOT EXISTS "authorizedXmlStorageKey" TEXT;
ALTER TABLE "SriDocument"      ADD COLUMN IF NOT EXISTS "ridePdfStorageKey"       TEXT;
