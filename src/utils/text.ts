export function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      const normalized = word.toLocaleLowerCase("es-PY");
      return normalized.charAt(0).toLocaleUpperCase("es-PY") + normalized.slice(1);
    })
    .join(" ");
}
