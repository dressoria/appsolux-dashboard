import "@/lib/security/server-only";
import { appConfig } from "@/config/app";
import { requestSchema, queryParameters, supportsPagination } from "./contracts";
import { API_ROUTES } from "./routes";
import { API_MODULES, API_SCOPES, API_CATALOG_VERSION } from "./catalog";

export function apiBaseUrl() { return `${appConfig.url.replace(/\/$/, "")}/api/v1`; }
export function openApiDocument() {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const route of API_ROUTES) {
    const path = `/${route.path}`, write = route.method !== "GET";
    const parameters: Record<string, unknown>[] = [...route.path.matchAll(/\{(\w+)\}/g)].map(m => ({ in: "path", name: m[1], required: true, schema: { type: "string" } }));
    if (write) parameters.push({ in: "header", name: "Idempotency-Key", required: true, schema: { type: "string", minLength: 1, maxLength: 128 }, description: "Identificador único por clave. Reutilizar únicamente para la misma operación y payload." });
    else if (supportsPagination(route.path)) parameters.push({ in: "query", name: "page", schema: { type: "integer", minimum: 1, default: 1 } }, { in: "query", name: "pageSize", schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } });
    if (!write) parameters.push(...queryParameters(route.path));
    const binary = route.path.endsWith("/xml") || route.path.endsWith("/ride");
    paths[path] ??= {};
    paths[path][route.method.toLowerCase()] = {
      operationId: `${route.method.toLowerCase()}_${route.path.replace(/[^a-z0-9]+/gi, "_")}`,
      summary: route.summary, tags: [route.path.split("/")[0]], security: [{ bearerAuth: [] }, { apiKeyAuth: [] }],
      description: `Permisos requeridos: ${route.scopes.join(", ") || "clave activa"}. ${route.expensive ? "Límite adicional: 20 solicitudes costosas/minuto." : ""}`,
      "x-facturom-scopes": route.scopes,
      parameters,
      ...(write ? { requestBody: { required: true, content: { "application/json": { schema: requestSchema(route.method, route.path), ...(route.example ? { example: route.example } : {}) } } } } : {}),
      responses: {
        [String(route.successStatus)]: { description: "Operación completada", content: binary ? { [route.path.endsWith("/xml") ? "application/xml" : "application/pdf"]: { schema: { type: "string", format: "binary" } } } : { "application/json": { schema: { $ref: "#/components/schemas/Success" } } } },
        ...Object.fromEntries([400, 401, 403, 404, 409, 413, 422, 429, 500, 503].map(code => [String(code), { description: ({ 400: "Solicitud inválida", 401: "Clave inválida", 403: "Acceso no permitido", 404: "No encontrado", 409: "Conflicto o conciliación pendiente", 413: "Solicitud demasiado grande", 422: "Validación de negocio", 429: "Límite de solicitudes", 500: "Error interno", 503: "Migración o servicio pendiente" } as Record<number, string>)[code], content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } }])),
      },
    };
  }
  return {
    openapi: "3.0.3", info: { title: "Facturom Integration API", version: "1.0.0", description: "API multitenant para integraciones externas y n8n. Full Access conserva un snapshot explícito de scopes y nunca supera el rol vigente. Todas las escrituras requieren Idempotency-Key." },
    servers: [{ url: apiBaseUrl() }], paths,
    "x-catalog-version": API_CATALOG_VERSION,
    "x-scope-catalog": API_SCOPES.map(s => ({ ...s, moduleLabel: API_MODULES[s.module] })),
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "Facturom API Key" }, apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" } },
      schemas: {
        Success: { type: "object", required: ["ok", "data", "meta"], properties: { ok: { type: "boolean", enum: [true] }, data: {}, meta: { type: "object", additionalProperties: true } } },
        Error: { type: "object", required: ["ok", "error"], properties: { ok: { type: "boolean", enum: [false] }, error: { type: "object", required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } } } },
      },
    },
  };
}
