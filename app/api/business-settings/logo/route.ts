import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import { getPrismaClient } from "@/lib/db/prisma";
import { saveLogo, deleteLogo, readLogo } from "@/lib/core/logo-storage";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

function detectMimeType(buffer: Buffer): string | null {
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return "image/png";
  }
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  return null;
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const settings = await prisma.businessSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { logoStorageKey: true, logoMimeType: true },
  });

  if (!settings?.logoStorageKey) {
    return NextResponse.json({ error: "No hay logo configurado." }, { status: 404 });
  }

  try {
    const buffer = await readLogo(settings.logoStorageKey, tenant.id);
    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": settings.logoMimeType || "image/png",
        "Content-Length": String(buffer.length),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error al leer el logo.";
    const status = msg.includes("denegado") ? 403 : 500;
    console.error(`[logo] GET failed tenant=${tenant.id}: ${msg}`);
    return NextResponse.json({ error: "Error al leer el logo." }, { status });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Formulario inválido." }, { status: 400 });
  }

  const file = formData.get("logo");

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "Archivo requerido." }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "El archivo excede el tamaño máximo de 2 MB." },
      { status: 400 },
    );
  }

  const ext = file.name.split(".").pop()?.toLowerCase();
  if (!ext || !["png", "jpg", "jpeg"].includes(ext)) {
    return NextResponse.json(
      { error: "Formato no permitido. Usa PNG, JPG o JPEG." },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const detectedMime = detectMimeType(buffer);
  if (!detectedMime) {
    return NextResponse.json(
      { error: "El contenido del archivo no corresponde a un formato de imagen válido." },
      { status: 400 },
    );
  }

  const existingSettings = await prisma.businessSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { logoStorageKey: true },
  });

  if (existingSettings?.logoStorageKey) {
    try {
      await deleteLogo(existingSettings.logoStorageKey, tenant.id);
    } catch {
      // Old file cleanup is best-effort
    }
  }

  let storageKey: string;
  try {
    storageKey = await saveLogo(tenant.id, file.name, buffer);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error(`[logo] POST saveLogo failed tenant=${tenant.id}: ${msg}`);
    return NextResponse.json(
      { error: "No se pudo guardar el logo." },
      { status: 500 },
    );
  }

  try {
    await prisma.businessSettings.upsert({
      where: { tenantId: tenant.id },
      create: {
        tenantId: tenant.id,
        logoStorageKey: storageKey,
        logoFileName: file.name,
        logoMimeType: detectedMime,
      },
      update: {
        logoStorageKey: storageKey,
        logoFileName: file.name,
        logoMimeType: detectedMime,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    console.error(`[logo] POST DB update failed tenant=${tenant.id}: ${msg}`);
    return NextResponse.json(
      { error: "No se pudo guardar el logo." },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    data: { fileName: file.name, mimeType: detectedMime },
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sesión requerida." }, { status: 401 });

  const tenant = await getCurrentTenant(user);
  const prisma = getPrismaClient();

  const settings = await prisma.businessSettings.findUnique({
    where: { tenantId: tenant.id },
    select: { logoStorageKey: true },
  });

  if (settings?.logoStorageKey) {
    try {
      await deleteLogo(settings.logoStorageKey, tenant.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      console.error(`[logo] DELETE failed tenant=${tenant.id}: ${msg}`);
    }
  }

  await prisma.businessSettings.upsert({
    where: { tenantId: tenant.id },
    create: { tenantId: tenant.id },
    update: {
      logoStorageKey: null,
      logoFileName: null,
      logoMimeType: null,
    },
  });

  return NextResponse.json({ success: true });
}
