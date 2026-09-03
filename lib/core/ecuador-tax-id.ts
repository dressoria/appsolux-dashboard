export type EcuadorRucType =
  | "natural_person"
  | "private_company"
  | "public_entity";

export function normalizeEcuadorIdentification(value: string) {
  return value.replace(/\D/g, "");
}

function hasValidProvince(digits: string) {
  const province = Number(digits.slice(0, 2));
  return province >= 1 && province <= 24;
}

export function isValidEcuadorCedula(value: string) {
  const raw = value.trim();
  if (!/^\d{10}$/.test(raw) || !hasValidProvince(raw)) return false;

  const thirdDigit = Number(raw[2]);
  if (thirdDigit > 5) return false;

  const checksum = raw
    .slice(0, 9)
    .split("")
    .reduce((sum, digit, index) => {
      const product = Number(digit) * (index % 2 === 0 ? 2 : 1);
      return sum + (product > 9 ? product - 9 : product);
    }, 0);

  const verifier = checksum % 10 === 0 ? 0 : 10 - (checksum % 10);
  return verifier === Number(raw[9]);
}

export function getEcuadorRucType(value: string): EcuadorRucType | null {
  const raw = value.trim();
  if (!/^\d{13}$/.test(raw) || !hasValidProvince(raw)) return null;

  const thirdDigit = Number(raw[2]);
  if (thirdDigit <= 5) return "natural_person";
  if (thirdDigit === 9) return "private_company";
  if (thirdDigit === 6) return "public_entity";
  return null;
}

export function isValidEcuadorRuc(value: string) {
  const raw = value.trim();
  const type = getEcuadorRucType(raw);
  if (!type || raw.endsWith("000")) return false;

  if (type === "natural_person") {
    return isValidEcuadorCedula(raw.slice(0, 10));
  }

  // The SRI no longer defines a checksum algorithm for RUCs assigned to
  // private/public entities (or foreign natural persons without a cedula).
  // Their first ten digits can be the current seven-digit sequence, so the
  // historical modulo-11 verifier must not be required here.
  // https://www.sri.gob.ec/facturacion-electronica
  return true;
}
