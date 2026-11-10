export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const notFound = () => new ApiError(404, "NOT_FOUND", "Recurso no encontrado en esta empresa.");
export function required<T>(value: T | null | undefined): T {
  if (value == null) throw notFound();
  return value;
}
export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new ApiError(400, "INVALID_BODY", "Se requiere un objeto JSON.");
  return value as Record<string, unknown>;
}
export function string(value: unknown, name: string, optional = false): string {
  if (optional && (value == null || value === "")) return "";
  if (typeof value !== "string" || !value.trim() || value.length > 1000) throw new ApiError(400, "INVALID_FIELD", `${name} inválido.`);
  return value.trim();
}
export function number(value: unknown, name: string, min = 0): number {
  if ((typeof value !== "number" && typeof value !== "string") || value === "" || !Number.isFinite(Number(value)) || Number(value) < min) throw new ApiError(400, "INVALID_FIELD", `${name} inválido.`);
  return Number(value);
}
export function date(value: unknown, fallback?: Date): Date {
  if (value == null && fallback) return fallback;
  const s = string(value, "Fecha");
  if (!/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2}))?$/.test(s)) throw new ApiError(400, "INVALID_DATE", "Fecha ISO inválida.");
  const d = new Date(s.length === 10 ? `${s}T00:00:00-05:00` : s);
  const calendarDay = new Date(`${s.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || Number.isNaN(calendarDay.getTime()) || calendarDay.toISOString().slice(0, 10) !== s.slice(0, 10)) throw new ApiError(400, "INVALID_DATE", "Fecha ISO inválida.");
  return d;
}
export function rows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value) || !value.length || value.length > 200) throw new ApiError(400, "INVALID_ITEMS", "Envía entre 1 y 200 elementos.");
  return value.map(object);
}
export function pagination(params: URLSearchParams) {
  const page = Number(params.get("page") ?? 1), pageSize = Number(params.get("pageSize") ?? 50);
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || !Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 100) throw new ApiError(400, "INVALID_PAGINATION", "page debe ser positivo y pageSize debe estar entre 1 y 100.");
  return { page, pageSize, skip: (page - 1) * pageSize, take: pageSize };
}
// Reject rather than silently accept attempted changes to authorization context.
export function rejectAuthority(value: unknown): void {
  if (Array.isArray(value)) { value.forEach(rejectAuthority); return; }
  if (!value || typeof value !== "object") return;
  for (const [key, entry] of Object.entries(value)) {
    if (["tenantid", "tenant_id", "companyid", "company_id", "userid", "user_id", "createdbyuserid", "createdby", "requestedbyuserid", "keyhash", "fullaccess", "scopes"].includes(key.toLowerCase())) throw new ApiError(400, "AUTHORITY_OVERRIDE", "El contexto de autorización se obtiene exclusivamente de la clave.");
    rejectAuthority(entry);
  }
}
