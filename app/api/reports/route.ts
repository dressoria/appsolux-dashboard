import { NextResponse } from "next/server";
import { buildReportsDashboardData } from "@/lib/api/erpnext/reports";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getCurrentTenant } from "@/lib/tenant/current-tenant";
import type { ReportDateRange } from "@/types/reports";

function getDateRange(request: Request): ReportDateRange {
  const url = new URL(request.url);
  const from = url.searchParams.get("from")?.trim();
  const to = url.searchParams.get("to")?.trim();

  return {
    from: from || undefined,
    to: to || undefined,
  };
}

export async function GET(request: Request) {
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

    const tenant = await getCurrentTenant(user);
    const reports = await buildReportsDashboardData(getDateRange(request));

    return NextResponse.json({
      success: true,
      data: {
        tenant: {
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
        },
        reports,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "No se pudieron cargar reportes";

    return NextResponse.json(
      {
        success: false,
        error: {
          code: "REPORTS_ERROR",
          message,
        },
      },
      { status: 500 }
    );
  }
}
