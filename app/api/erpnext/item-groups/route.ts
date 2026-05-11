import { NextResponse } from "next/server";
import {
  createErpnextItemGroup,
  deleteErpnextItemGroup,
  getErpnextItemGroups,
  updateErpnextItemGroup,
} from "@/lib/api/erpnext/item-groups";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getTenantModeState } from "@/lib/core/tenant-mode";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type {
  CreateErpnextItemGroupInput,
  UpdateErpnextItemGroupInput,
} from "@/types/erpnext";

function getStringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "string" ? value.trim() : "";
}

function getBooleanField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  return typeof value === "boolean" ? value : false;
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
            message: "El ERP dedicado debe estar activo para categorias.",
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
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const itemGroups = await getErpnextItemGroups();

    return NextResponse.json({
      success: true,
      data: { itemGroups },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext item groups error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_ITEM_GROUPS_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const body = (await request.json()) as Record<string, unknown>;
    const itemGroupName = getStringField(body, "item_group_name");

    if (!itemGroupName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ITEM_GROUP_INPUT",
            message: "Nombre de categoria requerido.",
          },
        },
        { status: 400 }
      );
    }

    const input: CreateErpnextItemGroupInput = {
      item_group_name: itemGroupName,
      parent_item_group:
        getStringField(body, "parent_item_group") || undefined,
      is_group: getBooleanField(body, "is_group"),
    };
    const itemGroup = await createErpnextItemGroup(input);

    return NextResponse.json({ success: true, data: { itemGroup } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo crear categoria.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_CREATE_ITEM_GROUP_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request) {
  try {
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const body = (await request.json()) as Record<string, unknown>;
    const name = getStringField(body, "name");
    const itemGroupName = getStringField(body, "item_group_name");

    if (!name || !itemGroupName) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ITEM_GROUP_UPDATE_INPUT",
            message: "Categoria y nombre son requeridos.",
          },
        },
        { status: 400 }
      );
    }

    const input: UpdateErpnextItemGroupInput = {
      item_group_name: itemGroupName,
      parent_item_group:
        getStringField(body, "parent_item_group") || undefined,
      is_group: getBooleanField(body, "is_group"),
      disabled: getBooleanField(body, "disabled"),
    };
    const itemGroup = await updateErpnextItemGroup(name, input);

    return NextResponse.json({ success: true, data: { itemGroup } });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo actualizar categoria.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_UPDATE_ITEM_GROUP_ERROR", message },
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const guard = await requireActiveErp();
    if (guard.error) return guard.error;

    const body = (await request.json()) as Record<string, unknown>;
    const name = getStringField(body, "name");

    if (!name) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "INVALID_ITEM_GROUP_DELETE_INPUT",
            message: "Categoria requerida.",
          },
        },
        { status: 400 }
      );
    }

    try {
      await deleteErpnextItemGroup(name);
      return NextResponse.json({
        success: true,
        data: { action: "deleted", name },
      });
    } catch {
      const itemGroup = await updateErpnextItemGroup(name, {
        item_group_name: name,
        disabled: true,
      });

      return NextResponse.json({
        success: true,
        data: { action: "disabled", itemGroup },
      });
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudo eliminar categoria.";

    return NextResponse.json(
      {
        success: false,
        error: { code: "ERPNEXT_DELETE_ITEM_GROUP_ERROR", message },
      },
      { status: 500 }
    );
  }
}
