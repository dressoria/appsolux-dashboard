import { NextRequest } from "next/server";
import { treasuryApi } from "@/lib/core/treasury/api";

type Context = { params: Promise<{ path: string[] }> };
async function handle(request: NextRequest, context: Context) {
  return treasuryApi(request, (await context.params).path.join("/"));
}
export { handle as GET, handle as POST, handle as PATCH };
