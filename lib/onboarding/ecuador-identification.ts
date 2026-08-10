export type TaxIdentificationType = "ruc" | "cedula" | "none";

export function normalizeEcuadorIdentification(value: string) {
  return value.replace(/\D/g, "");
}

export function isValidEcuadorCedula(value: string) {
  const digits = normalizeEcuadorIdentification(value);
  if (!/^\d{10}$/.test(digits)) return false;

  const province = Number(digits.slice(0, 2));
  const thirdDigit = Number(digits[2]);
  if (province < 1 || province > 24 || thirdDigit > 5) return false;

  const checksum = digits
    .slice(0, 9)
    .split("")
    .reduce((sum, digit, index) => {
      const product = Number(digit) * (index % 2 === 0 ? 2 : 1);
      return sum + (product > 9 ? product - 9 : product);
    }, 0);

  const verifier = checksum % 10 === 0 ? 0 : 10 - (checksum % 10);
  return verifier === Number(digits[9]);
}

export function isValidEcuadorRuc(value: string) {
  return /^\d{13}$/.test(normalizeEcuadorIdentification(value));
}
