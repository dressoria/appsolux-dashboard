/** Preserve leading zeroes and case; empty references are stored as NULL. */
export function normalizeCustomerInternalCode(value: string | undefined) {
  const code = value?.trim() || null;
  if (code && code.length > 100) throw new Error("El código interno admite hasta 100 caracteres.");
  return code;
}

export function isCustomerInternalCodeConflict(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error) || error.code !== "P2002") return false;
  if (!("meta" in error) || !error.meta || typeof error.meta !== "object" || !("target" in error.meta)) return false;
  const target = error.meta.target;
  return Array.isArray(target)
    ? target.includes("internalCode")
    : typeof target === "string" && target.includes("internalCode");
}
