import type { ProductionAreaMovement, ProductionOrder, ProductionOrderPosition } from "../types";
import { getProductionPositionCounts } from "./productionOrders";

const PARAGUAY_TIME_ZONE = "America/Asuncion";
const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: PARAGUAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
});

export function getProductionUnitAreaM2(position: ProductionOrderPosition): number | null {
  const manual = Number(position.areaM2Manual);
  if (position.areaM2Manual !== undefined && Number.isFinite(manual) && manual > 0) return roundArea(manual);
  const width = Number(position.ancho);
  const height = Number(position.alto);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
  return roundArea(width * height / 1_000_000);
}

export function getProductionOrderArea(order: ProductionOrder) {
  return order.posiciones.reduce((total, position) => {
    const counts = getProductionPositionCounts(position);
    const area = getProductionUnitAreaM2(position);
    total.units += counts.total;
    if (area === null) {
      total.unitsWithoutArea += counts.total;
    } else {
      total.plannedM2 += area * counts.total;
      total.finishedM2 += area * counts.finished;
    }
    return total;
  }, { units: 0, unitsWithoutArea: 0, plannedM2: 0, finishedM2: 0 });
}

export function getParaguayDayKey(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const parts = dateFormatter.formatToParts(date);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

export function getProductionPeriodKeys(now: Date) {
  const today = getParaguayDayKey(now);
  const [year, month, day] = today.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const weekday = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - weekday);
  return {
    today,
    weekStart: date.toISOString().slice(0, 10),
    monthStart: `${today.slice(0, 7)}-01`
  };
}

export function getActiveProductionCompletions(orders: ProductionOrder[]) {
  return orders.flatMap((order) => {
    const movements = order.movimientosM2 ?? [];
    const reversed = new Set(movements.filter((item) => item.type === "correction").map((item) => item.revertsMovementId));
    return movements
      .filter((item) => item.type === "finished" && !reversed.has(item.id))
      .map((item) => ({ ...item, orderId: order.id, orderNumber: order.numero, orderName: order.obraNombre }));
  });
}

export function getProductionAreaReport(orders: ProductionOrder[], now = new Date(), workerUid?: string) {
  const keys = getProductionPeriodKeys(now);
  const daily = new Map<string, number>();
  const completions = getActiveProductionCompletions(orders).filter((item) => !workerUid || item.createdBy === workerUid);
  for (const completion of completions) {
    const day = getParaguayDayKey(completion.createdAt);
    if (day) daily.set(day, (daily.get(day) ?? 0) + completion.areaM2);
  }
  let plannedM2 = 0;
  let finishedM2 = 0;
  let unitsWithoutArea = 0;
  for (const order of orders) {
    const area = getProductionOrderArea(order);
    plannedM2 += area.plannedM2;
    finishedM2 += area.finishedM2;
    unitsWithoutArea += area.unitsWithoutArea;
  }
  const sumFrom = (start: string) => [...daily].reduce((sum, [day, area]) => sum + (day >= start && day <= keys.today ? area : 0), 0);
  return {
    todayM2: roundArea(daily.get(keys.today) ?? 0),
    weekM2: roundArea(sumFrom(keys.weekStart)),
    monthM2: roundArea(sumFrom(keys.monthStart)),
    plannedM2: roundArea(plannedM2),
    finishedM2: roundArea(finishedM2),
    unitsWithoutArea,
    daily,
    completions
  };
}

export type ProductionAreaPeriod = "day" | "week" | "month";

export function getProductionAreaHistory(
  completions: ReturnType<typeof getActiveProductionCompletions>,
  period: ProductionAreaPeriod
) {
  const totals = new Map<string, number>();
  for (const completion of completions) {
    const day = getParaguayDayKey(completion.createdAt);
    if (!day) continue;
    const key = period === "day" ? day
      : period === "month" ? day.slice(0, 7)
      : getProductionPeriodKeys(new Date(completion.createdAt)).weekStart;
    totals.set(key, (totals.get(key) ?? 0) + completion.areaM2);
  }
  return [...totals].sort(([left], [right]) => right.localeCompare(left))
    .map(([key, areaM2]) => ({ key, areaM2: roundArea(areaM2) }));
}

export function findLastActiveCompletion(movements: ProductionAreaMovement[], positionId: string) {
  const reversed = new Set(movements.filter((item) => item.type === "correction").map((item) => item.revertsMovementId));
  return [...movements].reverse().find((item) => item.type === "finished" && item.positionId === positionId && !reversed.has(item.id));
}

export function roundArea(value: number): number {
  return Math.round((value + Number.EPSILON) * 1_000_000) / 1_000_000;
}

export function formatAreaM2(value: number): string {
  return new Intl.NumberFormat("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 3 }).format(value);
}
