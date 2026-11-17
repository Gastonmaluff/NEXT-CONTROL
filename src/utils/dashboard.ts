import type { Cobro, Obra, ProgressReport, WorkProgressRubric } from "../types";

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

// The list and the KPI share the same inclusion rule so their totals always reconcile.
export function getMonthlySalesWorks<T extends Pick<Obra, "fechaInicio" | "createdAt" | "montoAprobado">>(obras: readonly T[], month: string): T[] {
  if (!isDashboardMonth(month)) return [];
  return obras.filter(obra => getRecordMonth(obra.fechaInicio || obra.createdAt) === month && Number.isFinite(obra.montoAprobado));
}

export function getMonthlyReceipts<T extends Pick<Cobro, "fecha" | "monto">>(cobros: readonly T[], month: string): T[] {
  if (!isDashboardMonth(month)) return [];
  return cobros.filter(cobro => getRecordMonth(cobro.fecha) === month && Number.isFinite(cobro.monto));
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
    ventas: getMonthlySalesWorks(obras, month).reduce((total, obra) => total + obra.montoAprobado, 0),
    // Collections on older works still belong to the month they were received.
    cobrado: getMonthlyReceipts(cobros, month).reduce((total, cobro) => total + cobro.monto, 0)
  };
}

export function getInstalledEntriesThisWeek(reports: readonly ProgressReport[], rubrics: readonly WorkProgressRubric[], now = new Date()) {
  const { start, end } = getCurrentWeekRange(now);
  const rubricsById = new Map(rubrics.map(rubro => [rubro.id, rubro]));
  return reports.filter(report => isDateInRange(report.fecha, start, end) && !isCancelledReport(report)).flatMap(report =>
    report.entries.filter(entry => !((entry.cantidadEjecutadaHoy ?? 0) <= 0) && isInstalledSquareMeterRubric(rubricsById.get(entry.rubroId), entry.rubroNombre))
      .map(entry => ({ reportId: report.id, entryId: entry.id, obraId: report.obraId, date: report.fecha, name: entry.rubroNombre, amount: entry.cantidadEjecutadaHoy ?? 0, user: report.userName }))
  );
}

function getCurrentWeekRange(today: Date) {
  const start = new Date(today);
  const day = start.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diffToMonday);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function isDateInRange(value: string, start: Date, end: Date) {
  if (!value) return false;
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return false;
  return date >= start && date <= end;
}

function isCancelledReport(report: ProgressReport) {
  const status = `${report.observacionGeneral ?? ""} ${report.incidentes ?? ""}`.toLowerCase();
  return status.includes("cancelado") || status.includes("eliminado");
}

function isInstalledSquareMeterRubric(rubric: WorkProgressRubric | undefined, fallbackName: string) {
  const unit = normalizeText(rubric?.unidad ?? "");
  const name = normalizeText(rubric?.nombre ?? fallbackName);
  const isSquareMeter = unit === "m2" || unit === "m²" || unit.includes("metro cuadrado");
  const looksInstalled = name.includes("instalad") || name.includes("vidrio");
  const excluded = name.includes("sellado");

  return isSquareMeter && looksInstalled && !excluded;
}

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
