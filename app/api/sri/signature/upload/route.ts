import { NextRequest, NextResponse } from "next/server";

import { buildSriCertificateStorageKey, saveEncryptedSriCertificate } from "@/lib/core/sri-certificate-storage";
import { updateSriSignatureSecureMaterial } from "@/lib/core/sri";
import { validateCertificateUpload } from "@/lib/core/sri-signature";
import { getCurrentUser } from "@/lib/auth/current-user";
import { encryptBuffer, encryptText, SRI_ENCRYPTION_KEY_VERSION } from "@/lib/security/encryption";
import { getOptionalEnv, getRequiredEnv } from "@/lib/security/env";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesion requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulario invalido." }, { status: 400 });
  }

  const file = formData.get("certificate");
  const password = String(formData.get("password") ?? "");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Debes adjuntar un certificado .p12 o .pfx." }, { status: 400 });
  }

  const validation = validateCertificateUpload({
    fileName: file.name,
    fileSize: file.size,
    password,
  });

  if (!validation.valid) {
    return NextResponse.json({ error: validation.errors.join(" "), errors: validation.errors }, { status: 422 });
  }

  const encryptionKey = getRequiredEnv("SRI_CERT_ENCRYPTION_KEY");
  const storageRoot = getOptionalEnv("SRI_CERT_STORAGE_PATH");
  if (!storageRoot) {
    return NextResponse.json(
      { error: "SRI_CERT_STORAGE_PATH no esta configurada en el servidor." },
      { status: 500 }
    );
  }

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const encryptedCertificate = encryptBuffer(fileBuffer, encryptionKey);
    const encryptedPassword = encryptText(password.trim(), encryptionKey);
    const storageKey = buildSriCertificateStorageKey({
      tenantId: tenant.id,
      originalFileName: file.name,
    });

    await saveEncryptedSriCertificate({
      storageRoot,
      storageKey,
      encryptedContent: encryptedCertificate,
    });

    const config = await updateSriSignatureSecureMaterial(tenant.id, {
      certificateFileName: file.name,
      encryptedCertificateStorageKey: storageKey,
      encryptedCertificatePassword: encryptedPassword,
      encryptionKeyVersion: SRI_ENCRYPTION_KEY_VERSION,
    });

    return NextResponse.json({
      ok: true,
      status: config.status,
      hasEncryptedCertificate: Boolean(config.encryptedCertificateStorageKey),
      hasEncryptedPassword: Boolean(config.encryptedCertificatePassword),
      certificateUploadedAt: config.certificateUploadedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo guardar el certificado de firma.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
