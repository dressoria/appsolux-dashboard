export const ALLOWED_PER_PAGE = [10, 20, 50, 100] as const;

export function sanitizePerPage(value: unknown): number {
  const n = Number(value);
  if (ALLOWED_PER_PAGE.includes(n as (typeof ALLOWED_PER_PAGE)[number]))
    return n;
  return 20;
}

export function sanitizePage(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}
