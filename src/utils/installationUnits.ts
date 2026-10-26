import type { ProductionOrder } from "../types";

export const installationTypes = ["abertura", "paño fijo", "puerta", "parasol", "baranda", "box", "deck WPC", "pérgola", "revestimiento", "cielorraso", "otro"];
export type Measure = "m2" | "ml" | "un";
export type StageKey = "s0" | "s1" | "s2" | "s3";
export const stageKeys: StageKey[] = ["s0", "s1", "s2", "s3"];
export type UnitAudit = { id: string; action: string; by: string; at: string; reason: string; before?: string; after?: string };
export type InstallationUnit = {
  id: string; jobId: string; obraId: string; obraNombre: string; code: string; description: string;
  type: string; origin: "manual" | "produccion"; reference: string; sourceOrderId: string;
  sourcePositionId: string; sourcePositionNumber: string; sourceSignature: string;
  pdfUrl: string; drawingUrl: string; details: string; width: number; height: number;
  measure: Measure; value: number; areaMode: "dimensions" | "manual" | "count"; criterion: string;
  ordinal: number; quantity: number; teamId: string; teamName: string;
  labels: Record<StageKey, string>; required: Record<StageKey, boolean>; stages: Record<StageKey, boolean>;
  approvalRequired: boolean; status: "pendiente" | "en_proceso" | "declarado" | "validado";
  photoUrl: string; completedAt: string; completedBy: string; creditedTeamId: string; creditedTeamName: string;
  validatedAt: string; validatedBy: string; createdAt: string; createdBy: string;
  updatedAt: string; updatedBy: string; history: UnitAudit[];
  sourceMissing?: boolean; fieldReferencesApproved?: boolean;
  attachments?: { id: string; url: string; path: string; name: string; createdAt: string; createdBy: string }[];
};
export type InstallationDraft = {
  jobId: string; obraId: string; obraNombre: string; code: string; description: string; type: string;
  quantity: number; width: number; height: number; length: number; dimensionUnit: "mm" | "cm" | "m";
  measure: Measure; manualTotal?: number; distribution?: number[]; criterion: string;
  teamId: string; teamName: string; approvalRequired: boolean; required?: Record<StageKey, boolean>;
};
export function stageTemplate(type: string): Record<StageKey, string> {
  const key = type.toLowerCase();
  const labels = key.includes("parasol") ? ["Estructura", "Tubos / paneles", "Fijaciones y ajustes", "Terminaciones"]
    : key.includes("baranda") ? ["Soportes y perfiles", "Vidrio", "Ajustes y terminaciones", ""]
    : key.includes("deck") ? ["Estructura", "Tablas", "Terminaciones", ""]
    : key.includes("box") ? ["Herrajes y perfiles", "Vidrio", "Regulación y sellado", ""]
    : ["abertura", "puerta", "paño fijo"].includes(key) ? ["Carpintería", "Vidrio", "Siliconado", "Contramarco"]
    : ["Instalación", "Terminaciones", "", ""];
  return Object.fromEntries(stageKeys.map((k, i) => [k, labels[i]])) as Record<StageKey, string>;
}
const blankStages = (): Record<StageKey, boolean> => ({ s0: false, s1: false, s2: false, s3: false });
function positive(value: number, label: string) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label}: ingresa un valor positivo.`);
  return value;
}
export function buildManualUnits(draft: InstallationDraft, actor: string, now = new Date().toISOString()): InstallationUnit[] {
  if (!draft.obraId || !draft.description.trim() || !draft.jobId || !draft.type.trim()) throw new Error("Obra, descripción y tipo son obligatorios.");
  if (!Number.isInteger(draft.quantity) || draft.quantity < 1 || draft.quantity > 10000) throw new Error("Cantidad: entre 1 y 10000 unidades enteras; se guardan por lotes.");
  const scale = draft.dimensionUnit === "mm" ? 0.001 : draft.dimensionUnit === "cm" ? 0.01 : 1;
  const labels = stageTemplate(draft.type);
  const required = draft.required ?? Object.fromEntries(stageKeys.map(k => [k, Boolean(labels[k])])) as Record<StageKey, boolean>;
  if (!stageKeys.some(k => required[k] && labels[k])) throw new Error("Debe existir una etapa obligatoria.");
  if (stageKeys.some(k => required[k] && !labels[k])) throw new Error("Una etapa sin nombre no puede ser obligatoria.");
  const value = draft.measure === "un" ? 1 : draft.measure === "ml" ? positive(draft.length * scale, "Largo")
    : draft.manualTotal !== undefined ? positive(draft.manualTotal, "Superficie total") / draft.quantity
    : positive(draft.width * scale, "Ancho") * positive(draft.height * scale, "Alto");
  const distribution = draft.distribution ?? Array.from({ length: draft.quantity }, () => value);
  if (distribution.length !== draft.quantity || distribution.some(v => !Number.isFinite(v) || v <= 0)) throw new Error("Distribuye un valor positivo por unidad / sector.");
  const expected = draft.manualTotal ?? value * draft.quantity;
  if (Math.abs(distribution.reduce((sum, v) => sum + v, 0) - expected) > 1e-8 * Math.max(1, expected)) throw new Error("Los sectores deben sumar exactamente el total.");
  if (draft.manualTotal !== undefined && !draft.criterion.trim()) throw new Error("Indica el criterio de superficie manual.");
  return distribution.map((unitValue, i) => ({
    id: `${draft.jobId}--${i + 1}`, jobId: draft.jobId, obraId: draft.obraId, obraNombre: draft.obraNombre,
    code: draft.code.trim() || `INST-${draft.jobId}`, description: draft.description.trim(), type: draft.type,
    origin: "manual", reference: draft.jobId, sourceOrderId: "", sourcePositionId: "", sourcePositionNumber: "", sourceSignature: "",
    pdfUrl: "", drawingUrl: "", details: "", width: draft.width * scale, height: draft.height * scale,
    measure: draft.measure, value: unitValue, areaMode: draft.manualTotal !== undefined ? "manual" : draft.measure === "un" ? "count" : "dimensions",
    criterion: draft.criterion || (draft.type === "parasol" ? "Área frontal" : "Dimensiones"), ordinal: i + 1, quantity: draft.quantity,
    teamId: draft.teamId, teamName: draft.teamName, labels, required, stages: blankStages(), approvalRequired: draft.approvalRequired,
    status: "pendiente", photoUrl: "", completedAt: "", completedBy: "", creditedTeamId: "", creditedTeamName: "",
    validatedAt: "", validatedBy: "", createdAt: now, createdBy: actor, updatedAt: now, updatedBy: actor,
    history: [{ id: `create-${draft.jobId}-${i + 1}`, action: "crear", by: actor, at: now, reason: "Carga manual" }]
  }));
}
// The external position number/code remains stable when PDF parsing regenerates internal IDs.
export function buildProductionUnits(order: ProductionOrder, draft: Pick<InstallationDraft, "obraId" | "obraNombre" | "teamId" | "teamName" | "approvalRequired">, actor: string): InstallationUnit[] {
  const references = new Set<string>();
  return order.posiciones.flatMap(position => {
    if (!position.numero.trim()) throw new Error("Posición sin referencia: revisa Producción antes de importar.");
    const reference = JSON.stringify([order.id, position.numero.trim()]);
    if (references.has(reference)) throw new Error("Referencias de posición repetidas: revisa el PDF.");
    references.add(reference);
    const type = installationTypes.find(t => `${position.tipo ?? ""} ${position.descripcion}`.toLowerCase().includes(t)) ?? position.tipo?.trim() ?? "otro";
    const area = position.areaM2Manual ?? (Number(position.ancho) * Number(position.alto) / 1_000_000);
    positive(area, `Área de posición ${position.numero}`);
    const sourceSignature = JSON.stringify([position.codigo ?? "", position.cantidadTotal, position.ancho ?? null, position.alto ?? null, position.areaM2Manual ?? null, fieldText(position.descripcion), fieldText(position.tipo ?? ""), fieldText(position.linea ?? ""), fieldText(position.color ?? ""), fieldText(position.detalles ?? "")]);
    const jobId = `prod-${encodeURIComponent(reference)}`;
    const units = buildManualUnits({ ...draft, jobId, code: position.codigo ?? position.numero, description: fieldText(position.descripcion) || "Instalación", type,
      quantity: position.cantidadTotal, width: position.ancho ?? 0, height: position.alto ?? 0, length: 0, dimensionUnit: "mm", measure: "m2",
      ...(position.areaM2Manual !== undefined ? { manualTotal: area * position.cantidadTotal } : {}), criterion: position.areaM2Manual !== undefined ? "Superficie manual revisada en Producción" : "Dimensiones PDF en mm" }, actor);
    return units.map(u => ({ ...u, origin: "produccion" as const, reference, sourceOrderId: order.id, sourcePositionId: position.id,
      sourcePositionNumber: position.numero, sourceSignature, pdfUrl: order.pdfUrl ?? "", drawingUrl: position.imagenUrl ?? "",
      details: fieldText([position.linea, position.color, position.vidrio, position.detalles, position.observaciones].filter(Boolean).join(" · ")),
      history: [{ ...u.history[0], reason: `Importación de Producción ${order.numero ?? order.id}, posición ${position.numero}` }] }));
  });
}
export function canComplete(unit: InstallationUnit) {
  return stageKeys.every(k => !unit.required[k] || unit.stages[k]) && Boolean(unit.photoUrl) && Boolean(unit.teamId);
}
export type UnitAction = { type: "stage"; key: StageKey; value: boolean } | { type: "photo"; url: string }
  | { type: "complete" } | { type: "validate" } | { type: "reopen"; reason: string }
  | { type: "assign"; teamId: string; teamName: string; reason: string }
  | { type: "area"; value: number; reason: string }
  | { type: "references"; approved: boolean; reason: string };
export type AdminUnitEdit = { type: "edit"; description: string; code: string; typeName: string; details: string; width: number; height: number; labels: Record<StageKey, string>; required: Record<StageKey, boolean>; approvalRequired: boolean; reason: string };
export type AttachmentAction = { type: "attach"; attachment: NonNullable<InstallationUnit["attachments"]>[number]; reason: string };
export function transitionUnit(unit: InstallationUnit, action: UnitAction | AdminUnitEdit | AttachmentAction, actor: string, admin: boolean, operationId: string, now = new Date().toISOString()): InstallationUnit {
  if (unit.history.some(e => e.id === operationId)) return unit;
  const closed = ["declarado", "validado"].includes(unit.status);
  if (["validate", "reopen", "assign", "area", "edit", "attach", "references"].includes(action.type) && !admin) throw new Error("Esta acción requiere administrador.");
  if ((action.type === "stage" || action.type === "photo") && closed) throw new Error("Reabre la unidad antes de cambiar etapas o foto.");
  let next = { ...unit };
  let reason = "";
  switch (action.type) {
    case "stage": if (!unit.required[action.key]) throw new Error("La etapa está marcada No aplica."); next.stages = { ...unit.stages, [action.key]: action.value }; next.status = stageKeys.some(k => next.stages[k]) ? "en_proceso" : "pendiente"; break;
    case "photo": if (!action.url) throw new Error("Falta fotografía."); next.photoUrl = action.url; break;
    case "complete":
      if (closed) return unit;
      if (!canComplete(unit)) throw new Error("Completa las etapas obligatorias, agrega foto final y asigna cuadrilla.");
      next = { ...next, status: unit.approvalRequired ? "declarado" : "validado", completedAt: now, completedBy: actor,
        creditedTeamId: unit.teamId, creditedTeamName: unit.teamName, validatedAt: unit.approvalRequired ? "" : now, validatedBy: unit.approvalRequired ? "" : actor }; break;
    case "validate": if (unit.status !== "declarado") throw new Error("La unidad no está pendiente de validación."); next.status = "validado"; next.validatedAt = now; next.validatedBy = actor; break;
    case "reopen":
      reason = action.reason.trim(); if (!reason) throw new Error("Justifica la reapertura.");
      next = { ...next, status: "en_proceso", completedAt: "", completedBy: "", creditedTeamId: "", creditedTeamName: "", validatedAt: "", validatedBy: "" }; break;
    case "assign": reason = action.reason.trim(); if (!reason) throw new Error("Justifica la asignación."); next.teamId = action.teamId; next.teamName = action.teamName; break;
    case "area": reason = action.reason.trim(); if (!reason) throw new Error("Justifica la corrección de superficie."); next.value = positive(action.value, "Superficie"); next.areaMode = "manual"; next.criterion = reason; break;
    case "edit":
      reason = action.reason.trim(); if (!reason) throw new Error("Justifica la edición.");
      if (closed) throw new Error("Reabre la unidad antes de modificar ficha o etapas.");
      if (!action.description.trim() || !action.code.trim() || !action.typeName.trim()) throw new Error("Descripción, código y tipo son obligatorios.");
      if (!stageKeys.some(k => action.required[k] && action.labels[k].trim())) throw new Error("Al menos una etapa debe ser obligatoria.");
      if (stageKeys.some(k => action.required[k] && !action.labels[k].trim())) throw new Error("Da nombre a las etapas obligatorias.");
      next = { ...next, description: action.description.trim(), code: action.code.trim(), type: action.typeName.trim(), details: action.details.trim(), labels: action.labels, required: action.required, approvalRequired: action.approvalRequired,
        stages: Object.fromEntries(stageKeys.map(k => [k, unit.labels[k] === action.labels[k] && unit.required[k] === action.required[k] ? unit.stages[k] : false])) as Record<StageKey, boolean> };
      if (!Number.isFinite(action.width) || !Number.isFinite(action.height) || action.width < 0 || action.height < 0) throw new Error("Dimensiones inválidas.");
      next.width = action.width; next.height = action.height;
      if (unit.areaMode === "dimensions" && unit.measure === "m2") next.value = positive(action.width, "Ancho") * positive(action.height, "Alto");
      next.status = stageKeys.some(k => next.stages[k]) ? "en_proceso" : "pendiente"; break;
    case "references": reason = action.reason.trim(); if (!reason) throw new Error("Justifica la revisión de referencias."); next.fieldReferencesApproved = action.approved; break;
    case "attach": reason = action.reason.trim(); if (!reason || !action.attachment.url) throw new Error("Archivo y motivo son obligatorios."); next.attachments = [...(unit.attachments ?? []), action.attachment]; next.fieldReferencesApproved = false; break;
  }
  const snapshot = (u: InstallationUnit) => JSON.stringify({ value: u.value, teamId: u.teamId, teamName: u.teamName, status: u.status, stages: u.stages, photoUrl: u.photoUrl, completedAt: u.completedAt, creditedTeamId: u.creditedTeamId, fieldReferencesApproved:u.fieldReferencesApproved ?? false, description: u.description, code: u.code, type: u.type, details: u.details, labels: u.labels, required: u.required, approvalRequired: u.approvalRequired, attachments: u.attachments });
  return { ...next, updatedAt: now, updatedBy: actor, history: [...unit.history, { id: operationId, action: action.type, by: actor, at: now, reason, before: snapshot(unit), after: snapshot(next) }] };
}
export function paraguayDay(date: string | Date): string {
  const value = new Date(date); if (!Number.isFinite(value.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Asuncion", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(value);
  return ["year", "month", "day"].map(k => parts.find(p => p.type === k)?.value).join("-");
}
export function periodBounds(period: "hoy" | "semana" | "anterior" | "mes", now = new Date(), weekStartsOn = 1) {
  const today = paraguayDay(now); const date = new Date(`${today}T12:00:00Z`);
  if (period === "hoy") return { start: today, end: today };
  if (period === "mes") return { start: `${today.slice(0, 7)}-01`, end: today };
  if (!Number.isInteger(weekStartsOn) || weekStartsOn < 0 || weekStartsOn > 6) throw new Error("Inicio de semana inválido.");
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() - weekStartsOn + 7) % 7);
  if (period === "anterior") date.setUTCDate(date.getUTCDate() - 7);
  const start = date.toISOString().slice(0, 10); date.setUTCDate(date.getUTCDate() + 6);
  return { start, end: date.toISOString().slice(0, 10) };
}
export function summarizeUnits(units: InstallationUnit[], base: "declarado" | "validado", start = "", end = "9999") {
  const closed = (u: InstallationUnit) => stageKeys.some(k => u.required[k]) && stageKeys.every(k => !u.required[k] || u.stages[k]) && Boolean(u.photoUrl && u.completedAt && u.completedBy && u.creditedTeamId)
    && ((u.status === "validado" && Boolean(u.validatedAt && u.validatedBy)) || (base === "declarado" && u.status === "declarado"));
  const completed = units.filter(u => closed(u) && u.completedAt && paraguayDay(u.completedAt) >= start && paraguayDay(u.completedAt) <= end);
  return {
    totalM2: units.filter(u => u.measure === "m2").reduce((s, u) => s + u.value, 0),
    finishedM2: completed.filter(u => u.measure === "m2").reduce((s, u) => s + u.value, 0),
    pendingM2: units.filter(u => u.measure === "m2" && !closed(u)).reduce((s, u) => s + u.value, 0),
    completed: completed.length, inProgress: units.filter(u => u.status === "en_proceso").length,
    notStarted: units.filter(u => u.status === "pendiente").length,
    awaitingApproval: units.filter(u => u.status === "declarado").length,
    finishedMl: completed.filter(u => u.measure === "ml").reduce((s, u) => s + u.value, 0),
    finishedUn: completed.filter(u => u.measure === "un").reduce((s, u) => s + u.value, 0)
  };
}


// Financial clauses and unlabelled currency-style decimal amounts are not field instructions.
// Dimensions (mm/cm/m), integer accessory codes and technical notes remain intact.
export function fieldText(text: string): string {
  return text.split(/[\n;|·]/).map(part => part
    .replace(/(?:\b(?:precio|importe|subtotal|total|iva|costo|monto|descuento|guaran[ií]es|usd)\b|\bgs\.?\s|u\$s|[$₲€]).*/gi, "")
    .replace(/\b\d[\d.]*[,.]\d{2}(?!\d)(?!\s*(?:mm|cm|m(?:2|²)?|ml|x|×)\b)(?=\s|$)/gi, "")
    .trim()).filter(Boolean).join(" · ").replace(/\s+/g, " ").trim();
}
export type ImportDifference = { id: string; kind: "new" | "changed" | "missing" | "unchanged"; existing?: InstallationUnit; incoming?: InstallationUnit; revision: string };
export type ImportReview = { decisions: Record<string, "keep" | "apply">; revisions: Record<string, string>; reason: string; confirmArea: boolean };
export function sourceRevision(u: InstallationUnit): string {
  return JSON.stringify([u.sourceSignature,u.value,u.width,u.height,u.code,u.description,u.type,u.details,u.quantity,u.areaMode,u.criterion,u.pdfUrl,u.drawingUrl]);
}
export function importDifferences(incoming: InstallationUnit[], existing: InstallationUnit[]): ImportDifference[] {
  const ids = new Set(incoming.map(u => u.id));
  const orders = new Set(incoming.filter(u => u.origin === "produccion").map(u => u.sourceOrderId));
  const current = new Map(existing.map(u => [u.id,u]));
  return [...incoming.map(u => { const old = current.get(u.id); return {id:u.id,kind:!old ? "new" : old.sourceSignature !== u.sourceSignature || old.pdfUrl !== u.pdfUrl || old.drawingUrl !== u.drawingUrl || old.sourceMissing || old.obraId !== u.obraId ? "changed" : "unchanged",existing:old,incoming:u,revision:old ? sourceRevision(old) : ""} as ImportDifference; }),
    ...existing.filter(u => orders.has(u.sourceOrderId) && !ids.has(u.id)).map(u => ({id:u.id,kind:"missing" as const,existing:u,revision:sourceRevision(u)}))];
}
export function mergeImportedUnit(existing: InstallationUnit, incoming: InstallationUnit | undefined, review: ImportReview | undefined, actor: string, operationId: string, now = new Date().toISOString()): InstallationUnit {
  if (existing.history.some(h => h.id === operationId)) return existing;
  if (!incoming) {
    if (existing.sourceMissing) return existing;
    if (!review?.reason.trim()) throw new Error("Revisa las unidades omitidas; se conservarán con historial.");
    return {...existing,sourceMissing:true,updatedAt:now,updatedBy:actor,history:[...existing.history,{id:operationId,action:"reimportar-omitida",by:actor,at:now,reason:review.reason,before:sourceRevision(existing),after:"Referencia omitida; unidad y productividad conservadas"}]};
  }
  if (existing.id !== incoming.id || existing.obraId !== incoming.obraId || existing.sourceOrderId !== incoming.sourceOrderId) throw new Error("No se puede cambiar la identidad u obra al fusionar.");
  const changed = existing.sourceSignature !== incoming.sourceSignature || existing.pdfUrl !== incoming.pdfUrl || existing.drawingUrl !== incoming.drawingUrl;
  if (!changed && !existing.sourceMissing) return existing;
  if (!review?.reason.trim()) throw new Error("Reimportación con diferencias: revisa y justifica antes de fusionar.");
  if (review.revisions[existing.id] !== sourceRevision(existing)) throw new Error("La ficha cambió desde la revisión. Actualiza la vista previa; no se perdió avance.");
  const decision = review.decisions[existing.id];
  if (changed && !decision) throw new Error("Elige conservar o aplicar cada diferencia.");
  if (changed && decision === "apply" && existing.value !== incoming.value && !review.confirmArea) throw new Error("Confirma la corrección de superficie: recalcula la productividad acreditada.");
  const next = changed && decision === "apply" ? {...existing,code:incoming.code,description:incoming.description,type:incoming.type,details:incoming.details,width:incoming.width,height:incoming.height,value:incoming.value,areaMode:incoming.areaMode,criterion:incoming.criterion,quantity:incoming.quantity,sourceSignature:incoming.sourceSignature,sourcePositionId:incoming.sourcePositionId,
    // A replacement reference requires a new review before field access.
    pdfUrl:incoming.pdfUrl,drawingUrl:incoming.drawingUrl,fieldReferencesApproved:existing.pdfUrl === incoming.pdfUrl && existing.drawingUrl === incoming.drawingUrl ? existing.fieldReferencesApproved ?? false : false} : {...existing};
  next.sourceMissing = false;
  next.updatedAt=now;next.updatedBy=actor;
  next.history=[...existing.history,{id:operationId,action:decision === "keep" ? "reimportar-conservar" : "reimportar-fusionar",by:actor,at:now,reason:review.reason,before:sourceRevision(existing),after:sourceRevision(next)}];
  return next;
}
