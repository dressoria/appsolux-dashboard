import { NextResponse } from "next/server";
import { getErpnextInventory } from "@/lib/api/erpnext/inventory";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "User session is required",
          },
        },
        { status: 401 }
      );
    }

    const inventory = await getErpnextInventory();

    return NextResponse.json({
      success: true,
      data: { inventory },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unexpected ERPNext inventory error";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "ERPNEXT_INVENTORY_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
