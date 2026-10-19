import type { Cobro, Obra } from "../types";

const businessMonthFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Asuncion",
  year: "numeric",
  month: "2-digit"
});

export function isDashboardMonth(value: string): boolean {
  return /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function getCurrentDashboardMonth(now = new Date()): string {
  if (Number.isNaN(now.getTime())) return "";
  const parts = businessMonthFormatter.formatToParts(now);
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}`;
}

function getRecordMonth(value: string | undefined): string {
  if (!value) return "";
  // Date inputs represent a business day, not midnight UTC. Validate instead of
  // letting JavaScript roll an invalid day into the following month.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const date = new Date(`${value}T12:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
      ? value.slice(0, 7)
      : "";
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value)) return "";
  return getCurrentDashboardMonth(new Date(value));
}

export function calculateMonthlyDashboardTotals(
  obras: readonly Pick<Obra, "fechaInicio" | "createdAt" | "montoAprobado">[],
  cobros: readonly Pick<Cobro, "fecha" | "monto">[],
  month: string
): { ventas: number; cobrado: number } {
  if (!isDashboardMonth(month)) return { ventas: 0, cobrado: 0 };
  return {
    // There is no separate sale/approval date in Obra. Use its explicit start
    // date; creation time is a fallback only for legacy records without it.
    ventas: obras.reduce((total, obra) =>
      getRecordMonth(obra.fechaInicio || obra.createdAt) === month && Number.isFinite(obra.montoAprobado)
        ? total + obra.montoAprobado
        : total, 0),
    // Collections on older works still belong to the month they were received.
    cobrado: cobros.reduce((total, cobro) =>
      getRecordMonth(cobro.fecha) === month && Number.isFinite(cobro.monto)
        ? total + cobro.monto
        : total, 0)
  };
}
