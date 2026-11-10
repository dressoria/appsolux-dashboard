import { openApiDocument } from "@/lib/integration-api/openapi";
export const dynamic = "force-dynamic";
export function GET() { return Response.json(openApiDocument(), { headers: { "Cache-Control": "public, max-age=300" } }); }
