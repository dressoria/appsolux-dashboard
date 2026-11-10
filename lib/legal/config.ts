import "@/lib/security/server-only";

export function getLegalOperator(env: NodeJS.ProcessEnv = process.env) {
  return {
    legalName: env.LEGAL_OPERATOR_NAME?.trim() ?? "",
    ruc: env.LEGAL_OPERATOR_RUC?.trim() ?? "",
    tradingName: "Facturom",
    domicile: env.LEGAL_OPERATOR_DOMICILE?.trim() ?? "",
    country: env.LEGAL_OPERATOR_COUNTRY?.trim() ?? "",
    supportEmail: env.LEGAL_SUPPORT_EMAIL?.trim() ?? "",
    privacyEmail: env.LEGAL_PRIVACY_EMAIL?.trim() ?? "",
    legalEmail: env.LEGAL_NOTICES_EMAIL?.trim() ?? "",
    effectiveDate: env.LEGAL_EFFECTIVE_DATE?.trim() ?? "",
    dpoApplicability: env.LEGAL_DPO_APPLICABILITY?.trim() ?? "",
    dpoContact: env.LEGAL_DPO_CONTACT?.trim() ?? "",
  };
}

export function missingLegalOperatorFields(operator = getLegalOperator()) {
  const missing = Object.entries(operator).filter(([key, value]) => key !== "dpoContact" && !value).map(([key]) => key);
  if (!/^\d{13}$/.test(operator.ruc)) missing.push("ruc (13 dígitos; verificar titularidad)");
  for (const key of ["supportEmail", "privacyEmail", "legalEmail"] as const) {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(operator[key])) missing.push(`${key} (correo válido)`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(operator.effectiveDate) || !Number.isFinite(Date.parse(operator.effectiveDate))) missing.push("effectiveDate (ISO)");
  if (!["required", "not-required-reviewed"].includes(operator.dpoApplicability)) missing.push("dpoApplicability (evaluación jurídica)");
  if (operator.dpoApplicability === "required" && !operator.dpoContact) missing.push("dpoContact");
  return [...new Set(missing)];
}
