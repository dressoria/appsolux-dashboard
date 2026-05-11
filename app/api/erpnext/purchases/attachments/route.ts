import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  getErpnextDocumentFiles,
  uploadErpnextDocumentFile,
  type ErpnextAttachablePurchaseDoctype,
} from "@/lib/api/erpnext/files";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_DOCTYPES = new Set(["Purchase Invoice", "Purchase Order"]);
const ALLOWED_EXTENSIONS = new Set([".pdf", ".xml"]);
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/xml",
  "application/xml",
  "application/octet-stream",
]);

function isAllowedDoctype(
  value: string
): value is ErpnextAttachablePurchaseDoctype {
  return ALLOWED_DOCTYPES.has(value);
}

function getSafeFilename(name: string) {
  return name
    .replace(/[/\\?%*:|"<>]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function getExtension(name: string) {
  const normalized = name.toLowerCase();
  const dotIndex = normalized.lastIndexOf(".");
  return dotIndex >= 0 ? normalized.slice(dotIndex) : "";
}

async function requireActiveErp() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: { code: "UNAUTHORIZED", message: "User session is required" },
        },
        { status: 401 }
      ),
    };
  }

  const tenant = await getCurrentTenant(user);
  const tenantMode = await getTenantModeState(tenant);

  if (!tenantMode.erpProvisioning.isRealActive) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "ERP_NOT_ACTIVE",
            message: "El ERP dedicado debe estar activo para adjuntar archivos.",
          },
        },
        { status: 403 }
      ),
    };
  }

  return { error: null };
}

export async function GET(request: Request) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const { searchParams } = new URL(request.url);
    const doctype = searchParams.get("doctype") ?? "";
    const name = searchParams.get("name") ?? "";

    if (!isAllowedDoctype(doctype) || !name.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ATTACHMENT_QUERY",
            message: "Documento de compra requerido.",
          },
        },
        { status: 400 }
      );
    }

    const files = await getErpnextDocumentFiles(doctype, name);

    return NextResponse.json({ success: true, data: { files } });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No se pudieron cargar los adjuntos.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_ATTACHMENT_LIST_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const formData = await request.formData();
    const doctype = String(formData.get("doctype") ?? "");
    const name = String(formData.get("name") ?? "").trim();
    const fileValue = formData.get("file");

    if (!isAllowedDoctype(doctype) || !name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ATTACHMENT_TARGET",
            message: "Selecciona una factura u orden de compra valida.",
          },
        },
        { status: 400 }
      );
    }

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "MISSING_FILE", message: "Archivo requerido." },
        },
        { status: 400 }
      );
    }

    const filename = getSafeFilename(fileValue.name);
    const extension = getExtension(filename);

    if (!ALLOWED_EXTENSIONS.has(extension)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_FILE_EXTENSION",
            message: "Solo se permiten archivos PDF o XML.",
          },
        },
        { status: 400 }
      );
    }

    if (
      fileValue.type &&
      !ALLOWED_MIME_TYPES.has(fileValue.type.toLowerCase())
    ) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_FILE_TYPE",
            message: "El tipo de archivo no esta permitido.",
          },
        },
        { status: 400 }
      );
    }

    if (fileValue.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "El archivo no puede superar 5 MB.",
          },
        },
        { status: 400 }
      );
    }

    const file = await uploadErpnextDocumentFile({
      doctype,
      name,
      file: fileValue,
      filename,
    });

    return NextResponse.json({ success: true, data: { file } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo adjuntar el archivo.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_ATTACHMENT_UPLOAD_ERROR", message },
      },
      { status: 500 }
    );
  }
}
