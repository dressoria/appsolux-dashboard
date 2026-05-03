import { NextResponse } from "next/server";
import { getErpnextItemGroups } from "@/lib/api/erpnext/masters";
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
