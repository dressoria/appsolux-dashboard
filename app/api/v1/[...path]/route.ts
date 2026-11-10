import { integrationApi } from "@/lib/integration-api/gateway";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ path: string[] }> };
async function handle(request: Request, context: Context) { return integrationApi(request, (await context.params).path.join("/")); }
export { handle as GET, handle as POST, handle as PATCH, handle as DELETE };
