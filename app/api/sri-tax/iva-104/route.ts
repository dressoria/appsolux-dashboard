import { NextRequest } from "next/server";
import { handleTaxRequest } from "@/lib/core/sri-tax/api";

export async function POST(req: NextRequest) {
  return handleTaxRequest(req, "iva-104");
}
