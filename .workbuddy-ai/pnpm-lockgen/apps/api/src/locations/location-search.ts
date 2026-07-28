export function normalizeLocationAreaSearchTerms(value: string | null | undefined) {
  const trimmed = typeof value === "string" ? value.trim() : "";
  if (!trimmed) {
    return [];
  }

  const terms = new Set<string>();
  const displayLabelMatch = trimmed.match(/^(.*?)\s*\((\d{4,10})\)\s*$/);

  if (displayLabelMatch) {
    const name = displayLabelMatch[1]?.trim();
    const postalCode = displayLabelMatch[2]?.trim();
    if (name) {
      terms.add(name);
    }
    if (postalCode) {
      terms.add(postalCode);
    }
  } else {
    terms.add(trimmed);
  }

  return Array.from(terms);
}
