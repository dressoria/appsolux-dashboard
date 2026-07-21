import { NextRequest, NextResponse } from "next/server";

import { buildImportTemplateCsv } from "@/lib/core/business-suite/billing-imports";

export async function GET(request: NextRequest) {
  const type = request.nextUrl.searchParams.get("type") === "customers" ? "customers" : "products";
  const content = buildImportTemplateCsv(type);

  return new NextResponse(content, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${type}-template.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
