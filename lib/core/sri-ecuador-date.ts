export const SRI_ECUADOR_TIME_ZONE = "America/Guayaquil";

const formatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: SRI_ECUADOR_TIME_ZONE,
  calendar: "gregory",
  numberingSystem: "latn",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

export function getEcuadorSriDateParts(date: Date): {
  day: string;
  month: string;
  year: string;
} {
  if (Number.isNaN(date.getTime())) throw new Error("Fecha SRI inválida.");
  const parts = Object.fromEntries(
    formatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  if (!parts.day || !parts.month || !parts.year) {
    throw new Error(
      `No se pudo convertir la fecha SRI a ${SRI_ECUADOR_TIME_ZONE}.`,
    );
  }
  return { day: parts.day, month: parts.month, year: parts.year };
}

export function formatEcuadorSriDate(date: Date): string {
  const { day, month, year } = getEcuadorSriDateParts(date);
  return `${day}/${month}/${year}`;
}

export function formatEcuadorSriDateCompact(date: Date): string {
  const { day, month, year } = getEcuadorSriDateParts(date);
  return `${day}${month}${year}`;
}
