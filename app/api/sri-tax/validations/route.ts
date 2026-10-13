import { NextRequest } from "next/server";
import { handleTaxRequest } from "@/lib/core/sri-tax/api";

export async function GET(req: NextRequest) {
  return handleTaxRequest(req, "validations");
}
