import { managementHttp, listManagement, createManagedKey } from "@/lib/integration-api/management";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return managementHttp(request, () => listManagement(new URL(request.url).searchParams.get("tenantId") ?? undefined));
}
export async function POST(request: Request) { return managementHttp(request, createManagedKey); }
