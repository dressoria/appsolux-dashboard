import { NextResponse } from "next/server";
import { requireActiveErpTenantForApi } from "@/lib/core/require-active-erp-tenant";
import {
  createErpnextUom,
  deleteErpnextUom,
  getErpnextUoms,
  updateErpnextUom,
} from "@/lib/api/erpnext/uoms";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

async function requireActiveErp() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      error: NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
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
            message: "El ERP dedicado debe estar activo para unidades.",
          },
        },
        { status: 403 }
      ),
    };
  }

  return { error: null };
}

export async function GET() {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const uoms = await getErpnextUoms();

    return NextResponse.json({
      success: true,
      data: { uoms },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected ERPNext UOMs error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_UOMS_ERROR",
          message,
        },
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

    const body = (await request.json()) as Record<string, unknown>;
    const uomName = getStringField(body, "uom_name");

    if (!uomName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_UOM_INPUT",
            message: "Nombre de unidad requerido.",
          },
        },
        { status: 400 }
      );
    }

    const uom = await createErpnextUom({ uom_name: uomName });

    return NextResponse.json({ success: true, data: { uom } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear unidad.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_CREATE_UOM_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const body = (await request.json()) as Record<string, unknown>;
    const name = getStringField(body, "name");
    const uomName = getStringField(body, "uom_name");

    if (!name || !uomName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_UOM_UPDATE_INPUT",
            message: "Unidad y nombre son requeridos.",
          },
        },
        { status: 400 }
      );
    }

    const enabled = body.enabled;
    const uom = await updateErpnextUom(name, {
      uom_name: uomName,
      enabled: typeof enabled === "boolean" ? enabled : undefined,
    });

    return NextResponse.json({ success: true, data: { uom } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar unidad.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_UPDATE_UOM_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const erpGuard = await requireActiveErpTenantForApi();
    if (!erpGuard.ok) return erpGuard.response;
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const body = (await request.json()) as Record<string, unknown>;
    const name = getStringField(body, "name");

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: { code: "INVALID_UOM_DELETE_INPUT", message: "Unidad requerida." },
        },
        { status: 400 }
      );
    }

    try {
      await deleteErpnextUom(name);
      return NextResponse.json({
        success: true,
        data: { action: "deleted", name },
      });
    } catch {
      const uom = await updateErpnextUom(name, { uom_name: name, enabled: false });

      return NextResponse.json({
        success: true,
        data: { action: "disabled", uom },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar unidad.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_DELETE_UOM_ERROR", message },
      },
      { status: 500 }
    );
  }
}
