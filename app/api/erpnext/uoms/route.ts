import { NextResponse } from "next/server";
import { getErpnextUoms } from "@/lib/api/erpnext/masters";
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
