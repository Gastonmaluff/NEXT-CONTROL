import type { FinancialMovement, FinancialStatus, Obra } from "../types";

export function calculateTotalIngresos(movimientos: FinancialMovement[]): number {
  return movimientos
    .filter((movement) => movement.tipo === "ingreso")
    .reduce((sum, movement) => sum + movement.monto, 0);
}

export function calculateTotalEgresos(movimientos: FinancialMovement[]): number {
  return movimientos
    .filter((movement) => movement.tipo === "compra" || movement.tipo === "egreso")
    .reduce((sum, movement) => sum + movement.monto, 0);
}

export function getTotalContratado(obra: Obra): number {
  return (
    obra.totalContratado ??
    obra.valorFinalContratado ??
    (obra.presupuestoAprobado ?? obra.montoAprobado) +
      (obra.adicionalesAprobados ?? 0) -
      (obra.descuentos ?? 0)
  );
}

export function calculateResultadoActual(
  _obra: Obra,
  movimientos: FinancialMovement[]
): number {
  return calculateTotalIngresos(movimientos) - calculateTotalEgresos(movimientos);
}

export function calculateSaldoPendiente(
  obra: Obra,
  movimientos: FinancialMovement[]
): number {
  return Math.max(0, getTotalContratado(obra) - calculateTotalIngresos(movimientos));
}

export function calculateMargenActual(
  obra: Obra,
  movimientos: FinancialMovement[]
): number {
  const totalContratado = getTotalContratado(obra);
  if (!totalContratado) {
    return 0;
  }

  return Math.round(((totalContratado - calculateTotalEgresos(movimientos)) / totalContratado) * 100);
}

export function calculateFinancialStatus(
  obra: Obra,
  movimientos: FinancialMovement[]
): FinancialStatus {
  const margin = calculateMargenActual(obra, movimientos);
  const saldoPendiente = calculateSaldoPendiente(obra, movimientos);

  if (saldoPendiente > 0 && isCommitmentSoon(obra.fechaComprometida ?? obra.fechaEntrega)) {
    return "Pendiente de cobro";
  }

  if (margin >= 25) {
    return "Saludable";
  }

  if (margin >= 15) {
    return "Atencion";
  }

  return "Margen bajo";
}

export function groupEgresosByCategoria(
  movimientos: FinancialMovement[]
): Record<string, number> {
  return groupByCategory(movimientos.filter((movement) => movement.tipo !== "ingreso"));
}

export function groupIngresosByCategoria(
  movimientos: FinancialMovement[]
): Record<string, number> {
  return groupByCategory(movimientos.filter((movement) => movement.tipo === "ingreso"));
}

function groupByCategory(movimientos: FinancialMovement[]): Record<string, number> {
  return movimientos.reduce<Record<string, number>>((acc, movement) => {
    acc[movement.categoria] = (acc[movement.categoria] ?? 0) + movement.monto;
    return acc;
  }, {});
}

function isCommitmentSoon(value?: string): boolean {
  if (!value) {
    return false;
  }

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const diff = date.getTime() - Date.now();
  return diff <= 1000 * 60 * 60 * 24 * 30;
}
