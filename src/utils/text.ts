export function toTitleCase(value: string): string {
  const acronymMap: Record<string, string> = {
    "sa": "SA",
    "s.a": "S.A.",
    "s.a.": "S.A.",
    "srl": "SRL",
    "s.r.l": "S.R.L.",
    "s.r.l.": "S.R.L.",
    "s.a.e": "S.A.E.",
    "s.a.e.": "S.A.E.",
    "ltda": "LTDA"
  };

  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      const clean = word.toLocaleLowerCase("es-PY").replace(/,+$/g, "");
      const trailing = word.match(/,+$/)?.[0] ?? "";
      if (acronymMap[clean]) {
        return `${acronymMap[clean]}${trailing}`;
      }
      const normalized = word.toLocaleLowerCase("es-PY");
      return normalized.charAt(0).toLocaleUpperCase("es-PY") + normalized.slice(1);
    })
    .join(" ");
}
