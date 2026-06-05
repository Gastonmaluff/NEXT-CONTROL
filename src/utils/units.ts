export type OperationalUnit = "m2" | "unidad";

export function normalizeUnit(value: string | undefined | null): OperationalUnit | "" {
  const normalized = (value ?? "")
    .trim()
    .toLocaleLowerCase("es-PY")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "");

  if (["m2", "m²", "mt2", "mts2", "metro2", "metros2", "metrocuadrado", "metroscuadrados"].includes(normalized)) {
    return "m2";
  }

  if (["unidad", "unidades", "unit", "units"].includes(normalized)) {
    return "unidad";
  }

  return "";
}

export function formatUnitLabel(unit: string | undefined | null, quantity: number): string {
  const normalized = normalizeUnit(unit);

  if (normalized === "m2") {
    return "m²";
  }

  if (normalized === "unidad") {
    return Math.abs(quantity) === 1 ? "unidad" : "unidades";
  }

  return unit?.trim() || "";
}

