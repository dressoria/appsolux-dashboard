-- Agrega campos fiscales faltantes al perfil tributario SRI por tenant.
-- dirMatriz: dirección de la matriz que va en <infoTributaria><dirMatriz>.
-- contribuyenteRimpe: etiqueta del régimen RIMPE, ej: "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE".
-- Ambos son opcionales (nullable); si están vacíos, el sistema usa la dirección del establecimiento.

ALTER TABLE "SriTaxpayerProfile" ADD COLUMN IF NOT EXISTS "dirMatriz" TEXT;
ALTER TABLE "SriTaxpayerProfile" ADD COLUMN IF NOT EXISTS "contribuyenteRimpe" TEXT;
