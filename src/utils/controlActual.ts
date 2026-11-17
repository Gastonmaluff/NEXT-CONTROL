import type { Cheque, FinancialMovement, Obra } from "../types";

export type CashLine = { id: string; direction: "ingreso" | "egreso"; date: string; amount: number; obraId: string; description: string; method: string; source: "movimiento" | "cheque" };
export type ForecastLine = { id: string; direction: "ingreso" | "egreso"; date: string; amount: number; obraId: string; description: string; source: "cheque" | "prevision" };
export type CashForecast = { id: string; direction: "ingreso" | "egreso"; date: string; amount: number; description: string; obraId: string; state: "pendiente" | "retirada"; createdAt: string; createdBy: string };
export type ControlIssue = { id: string; description: string };
const finiteAmount = (v: number) => Number.isFinite(v) && v > 0;
export function validDay(day: string | undefined): boolean {
  if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day;
}
export function businessDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  return ["year", "month", "day"].map(key => parts.find(p => p.type === key)?.value).join("-");
}
export function shiftDay(day: string, days: number): string {
  if (!validDay(day)) return "";
  const date = new Date(`${day}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10);
}
function ambiguousCheques(cheques: readonly Cheque[]): Set<string> {
  const groups = new Map<string, string[]>();
  for (const cheque of cheques) {
    if (cheque.estado === "anulado" || !cheque.numeroCheque?.trim()) continue;
    const key = `${cheque.tipo}:${cheque.numeroCheque.trim().toLowerCase()}:${(cheque.bancoCheque ?? "").trim().toLowerCase()}`;
    groups.set(key, [...(groups.get(key) ?? []), cheque.id]);
  }
  return new Set([...groups.values()].filter(ids => ids.length > 1).flat());
}
export function getCashLines(movements: readonly FinancialMovement[], cheques: readonly Cheque[], today: string) {
  const lines: CashLine[] = [], issues: ControlIssue[] = [];
  const duplicates = ambiguousCheques(cheques);
  const movementById = new Map(movements.map(m => [m.id, m]));
  for (const movement of movements) {
    if (!["ingreso", "compra", "egreso"].includes(movement.tipo) || !finiteAmount(movement.monto) || !validDay(movement.fecha)) { issues.push({id:`movement:${movement.id}`,description:`Movimiento ${movement.concepto || movement.id} sin importe o fecha válida.`}); continue; }
    if (movement.metodoPago === "Cheque") {
      if (!cheques.some(c => c.movimientoId === movement.id && c.estado !== "anulado")) issues.push({id:`movement:${movement.id}`,description:`Cheque de ${movement.concepto || movement.id} sin registro activo vinculado.`});
      continue;
    }
    if (movement.metodoPago !== "Efectivo" && movement.metodoPago !== "Transferencia") { issues.push({id:`movement:${movement.id}`,description:`${movement.concepto || movement.id}: medio de pago sin confirmación de cobro o pago.`}); continue; }
    if (movement.fecha > today) continue;
    lines.push({id:`movement:${movement.id}`,direction:movement.tipo === "ingreso" ? "ingreso" : "egreso", date:movement.fecha,amount:movement.monto,obraId:movement.obraId,description:movement.concepto || movement.categoria || "Movimiento",method:movement.metodoPago,source:"movimiento"});
  }
  for (const cheque of cheques) {
    if ((cheque.tipo === "recibido" && cheque.estado !== "cobrado") || (cheque.tipo === "emitido" && cheque.estado !== "debitado")) continue;
    const date = cheque.tipo === "recibido" ? cheque.fechaRealCobro : cheque.fechaRealPago;
    const linked = cheque.movimientoId ? movementById.get(cheque.movimientoId) : undefined;
    const inconsistent = Boolean(cheque.movimientoId) && (!linked || linked.metodoPago !== "Cheque" || linked.obraId !== cheque.obraId || linked.monto !== cheque.monto || (linked.tipo === "ingreso") !== (cheque.tipo === "recibido"));
    const possibleDuplicate = !cheque.movimientoId && Boolean(cheque.obraId) && movements.some(m => m.obraId === cheque.obraId && m.monto === cheque.monto && (m.tipo === "ingreso") === (cheque.tipo === "recibido"));
    if (duplicates.has(cheque.id) || inconsistent || possibleDuplicate || !finiteAmount(cheque.monto) || !validDay(date)) {
      issues.push({id:`cheque:${cheque.id}`,description:`Cheque ${cheque.numeroCheque || cheque.id}: revisá duplicados, vínculo y fecha real.`}); continue;
    }
    if (date! > today) { issues.push({id:`cheque:${cheque.id}`,description:`Cheque ${cheque.numeroCheque || cheque.id}: la fecha real está en el futuro.`}); continue; }
    lines.push({id:`cheque:${cheque.id}`,direction:cheque.tipo === "recibido" ? "ingreso" : "egreso",date:date!,amount:cheque.monto,obraId:cheque.obraId,description:`Cheque ${cheque.numeroCheque || "sin número"}`,method:"Cheque",source:"cheque"});
  }
  return {lines,issues};
}
export function getForecastLines(cheques: readonly Cheque[], plans: readonly CashForecast[], today: string, movements: readonly FinancialMovement[] = []) {
  const lines: ForecastLine[] = [], overdue: ForecastLine[] = [], later: ForecastLine[] = [], issues: ControlIssue[] = [];
  const end = shiftDay(today, 30), duplicates = ambiguousCheques(cheques);
  const movementById = new Map(movements.map(m => [m.id, m]));
  for (const c of cheques) {
    const pending = c.tipo === "recibido" ? ["recibido", "depositado"].includes(c.estado) : ["emitido", "entregado"].includes(c.estado);
    if (!pending) continue;
    const date = c.fechaCobroCheque || c.fechaVencimientoCheque || "";
    const linked = c.movimientoId ? movementById.get(c.movimientoId) : undefined;
    const inconsistent = Boolean(c.movimientoId) && (!linked || linked.metodoPago !== "Cheque" || linked.obraId !== c.obraId || linked.monto !== c.monto || (linked.tipo === "ingreso") !== (c.tipo === "recibido"));
    if (duplicates.has(c.id) || inconsistent || !finiteAmount(c.monto) || !validDay(date)) { issues.push({id:`cheque:${c.id}`,description:`Cheque ${c.numeroCheque || c.id}: revisá fecha, importe, vínculo o duplicados.`}); continue; }
    const line: ForecastLine = {id:`cheque:${c.id}`,direction:c.tipo === "recibido" ? "ingreso" : "egreso",date,amount:c.monto,obraId:c.obraId,description:`Cheque ${c.numeroCheque || "sin número"}`,source:"cheque"};
    if (date < today) { overdue.push(line); continue; }
    if (date <= end) lines.push(line);
  }
  for (const p of plans) {
    if (p.state !== "pendiente") continue;
    if (!validDay(p.date) || !finiteAmount(p.amount)) { issues.push({id:`plan:${p.id}`,description:`Previsión ${p.description || p.id} con fecha o importe inválido.`}); continue; }
    const possibleDuplicate = cheques.some(c => (c.tipo === "recibido" ? ["recibido", "depositado"].includes(c.estado) : ["emitido", "entregado"].includes(c.estado)) && (c.tipo === "recibido" ? "ingreso" : "egreso") === p.direction && c.obraId === p.obraId && c.monto === p.amount && (c.fechaCobroCheque || c.fechaVencimientoCheque) === p.date);
    if (possibleDuplicate) { issues.push({id:`plan:${p.id}`,description:`Previsión ${p.description || p.id}: coincide con un cheque pendiente y no se sumó; revisá si está duplicada.`}); continue; }
    const line: ForecastLine = {id:`plan:${p.id}`,direction:p.direction,date:p.date,amount:p.amount,obraId:p.obraId,description:p.description,source:"prevision"};
    if (p.date < today) { overdue.push(line); continue; }
    if (p.date <= end) lines.push(line); else later.push(line);
  }
  return {lines:lines.sort((a,b)=>a.date.localeCompare(b.date)),overdue:overdue.sort((a,b)=>a.date.localeCompare(b.date)),later:later.sort((a,b)=>a.date.localeCompare(b.date)),issues,end};
}
export function getWorkResults(works: readonly Obra[], movements: readonly FinancialMovement[]) {
  const excluded = new Set(["Prospecto", "Presupuesto enviado", "Seguimiento"]);
  return works.filter(w => !excluded.has(w.estado)).map(work => {
    const costs = movements.filter(m => m.obraId === work.id && (m.tipo === "compra" || m.tipo === "egreso") && finiteAmount(m.monto));
    const contract = work.totalContratado ?? work.valorFinalContratado ?? ((work.presupuestoAprobado ?? work.montoAprobado) + (work.adicionalesAprobados ?? 0) - (work.descuentos ?? 0));
    const totalCosts = costs.reduce((sum,m)=>sum+m.monto,0);
    return {work, contract, costs, totalCosts, result:contract-totalCosts, available:costs.length>0 && Number.isFinite(contract)};
  });
}
