export type ParsedProductLine = {
  lineNumber: number;
  quantity: number;
  searchTerm: string;
  raw: string;
};

const LINE_PATTERN = /^(\d+)\s*[xX]?\s+(.+)$/;

export function parseProductLines(text: string): ParsedProductLine[] {
  return text
    .split("\n")
    .map((line, i) => ({ raw: line.trim(), lineNumber: i + 1 }))
    .filter(({ raw }) => raw.length > 0)
    .map(({ raw, lineNumber }) => {
      const match = raw.match(LINE_PATTERN);
      if (match) {
        const qty = parseInt(match[1], 10);
        return {
          lineNumber,
          quantity: qty > 0 ? qty : 1,
          searchTerm: match[2].trim(),
          raw,
        };
      }
      return { lineNumber, quantity: 1, searchTerm: raw, raw };
    });
}
