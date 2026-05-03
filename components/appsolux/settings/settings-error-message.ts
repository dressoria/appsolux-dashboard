export function cleanSettingsErrorMessage(message: string) {
  const withoutHtml = message
    .replace(/<strong[^>]*>/gi, "\"")
    .replace(/<\/strong>/gi, "\"")
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
  const warehouseExistsMatch = withoutHtml.match(
    /Almac\S*n\s+"?([^"]+)"?\s+ya existe/i
  );

  if (warehouseExistsMatch?.[1]) {
    return `La bodega "${warehouseExistsMatch[1].trim()}" ya existe.`;
  }

  return withoutHtml;
}
