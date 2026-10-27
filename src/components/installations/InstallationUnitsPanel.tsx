import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, BarChart3, ClipboardList, FileInput, PenLine, Plus, RefreshCw, Search, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import InstallationDialog from "./InstallationDialog";
import InstallationGoalsDialog from "./InstallationGoalsDialog";
import { useAuth } from "../../context/AuthContext";
import { getCuadrillas, getObras, getProductionOrders } from "../../lib/firestore";
import { actOnInstallationUnit, createInstallationUnits, loadInstallationGoals, loadInstallationUnits, saveInstallationGoals, type InstallationGoals } from "../../lib/installationRepository";
import { isDemoSession } from "../../lib/storage";
import { problemReasons, reportInstallationProblem } from "../../lib/installationProblems";
import { sanitizeStorageFileName, uploadFile } from "../../lib/storageUpload";
import type { Cuadrilla, Obra, ProductionOrder } from "../../types";
import { fieldText, importDifferences, buildManualUnits, buildProductionUnits, canComplete, installationTypes, paraguayDay, periodBounds, stageKeys, stageTemplate, summarizeUnits, type InstallationDraft, type InstallationUnit, type StageKey, type UnitAction, type AdminUnitEdit, type AttachmentAction } from "../../utils/installationUnits";

const fmt = (v: number) => v.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-next-blue px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200 disabled:opacity-50";
const secondaryButton = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100 disabled:opacity-50";
const evidencePath = (unit: InstallationUnit, file: File) => `installation-evidence/${unit.id}/${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`;
const statusLabels = { pendiente: "Sin iniciar", en_proceso: "En proceso", declarado: "Por revisar", validado: "Terminado" };
const freshDraft = (): InstallationDraft => ({ jobId: crypto.randomUUID(), obraId: "", obraNombre: "", code: "", description: "", type: "abertura", quantity: 1, width: 0, height: 0, length: 0, dimensionUnit: "m", measure: "m2", criterion: "", teamId: "", teamName: "", approvalRequired: false });

export default function InstallationUnitsPanel({ field = false }: { field?: boolean }) {
  const { profile } = useAuth(); const admin = profile?.role === "admin" && !field;
  const [units, setUnits] = useState<InstallationUnit[]>([]); const [works, setWorks] = useState<Obra[]>([]);
  const [teams, setTeams] = useState<Cuadrilla[]>([]); const [orders, setOrders] = useState<ProductionOrder[]>([]);
  const [error, setError] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const lock = useRef(false); const retryOperations = useRef(new Map<string, string>());
  const [loaded, setLoaded] = useState(false); const [showCreate, setShowCreate] = useState(false);
  const [createMode, setCreateMode] = useState<"manual" | "production" | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [goalDraft, setGoalDraft] = useState<InstallationGoals>({ weeklyByTeam: {}, monthly: 600 });
  const [draft, setDraft] = useState(freshDraft); const [manualArea, setManualArea] = useState(false);
  const [totalArea, setTotalArea] = useState(""); const [distribution, setDistribution] = useState("");
  const [required, setRequired] = useState<Record<StageKey, boolean>>({ s0: true, s1: true, s2: true, s3: true });
  const [mergeReason,setMergeReason]=useState(""); const [mergeArea,setMergeArea]=useState(false); const [mergeChoices,setMergeChoices]=useState<Record<string,"keep"|"apply">>({}); const [batchProgress,setBatchProgress]=useState("");
  const [preview, setPreview] = useState<InstallationUnit[]>([]); const [orderId, setOrderId] = useState("");
  const [search, setSearch] = useState(""); const [workFilter, setWorkFilter] = useState(""); const [teamFilter, setTeamFilter] = useState("");
  const [stateFilter, setStateFilter] = useState(""); const [originFilter, setOriginFilter] = useState(""); const [typeFilter, setTypeFilter] = useState("");
  const [base, setBase] = useState<"declarado" | "validado">("declarado");
  const [period, setPeriod] = useState<"hoy" | "semana" | "anterior" | "mes" | "rango">("semana");
  const [rangeStart, setRangeStart] = useState(paraguayDay(new Date())); const [rangeEnd, setRangeEnd] = useState(paraguayDay(new Date()));
  const [goals, setGoals] = useState<InstallationGoals>({ weeklyByTeam: {}, monthly: 600 }); const [showGoals, setShowGoals] = useState(false);
  const [detail, setDetail] = useState("");
  const [editing, setEditing] = useState<{ unit: InstallationUnit; edit: AdminUnitEdit } | null>(null);
  const [problemUnit, setProblemUnit] = useState<InstallationUnit | null>(null);
  const [problemReason, setProblemReason] = useState(problemReasons[0]); const [problemComment, setProblemComment] = useState("");
  const problemId = useRef(crypto.randomUUID()); const [problemPhoto, setProblemPhoto] = useState<File | null>(null);

  async function load() {
    if (!profile) return;
    try {
      const [nextUnits, nextWorks, nextTeams, nextGoals, nextOrders] = await Promise.all([loadInstallationUnits(profile), getObras(), getCuadrillas(), loadInstallationGoals(), admin ? getProductionOrders() : Promise.resolve([])]);
      setUnits(nextUnits); setWorks(nextWorks); setTeams(nextTeams); setGoals(nextGoals); setOrders(nextOrders); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el seguimiento por unidades."); }
  }
  useEffect(() => { void load(); }, [profile?.uid, admin]);
  async function perform(action: () => Promise<void>) {
    if (lock.current) return false; lock.current = true; setBusy(true); setError(""); setMessage("");
    try { await action(); await load(); return true; } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar."); return false; }
    finally { lock.current = false; setBusy(false); }
  }
  async function act(unit: InstallationUnit, action: UnitAction | AdminUnitEdit | AttachmentAction) {
    if (!profile) return false;
    const key = JSON.stringify([unit.id, action]);
    const operationId = retryOperations.current.get(key) ?? crypto.randomUUID(); retryOperations.current.set(key, operationId);
    return perform(async () => { await actOnInstallationUnit(unit.id, action, profile, operationId); retryOperations.current.delete(key); setMessage("Cambio guardado con historial."); });
  }
  const filtered = useMemo(() => units.filter(u => (!field || profile?.role === "admin" || profile?.assignedTeamIds?.includes(u.teamId)) && (!workFilter || u.obraId === workFilter) && (!teamFilter || u.teamId === teamFilter || u.creditedTeamId === teamFilter)
    && (!stateFilter || u.status === stateFilter) && (!originFilter || u.origin === originFilter) && (!typeFilter || u.type === typeFilter)
    && `${u.code} ${u.description} ${u.obraNombre}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(["declarado", "validado"].includes(a.status)) - Number(["declarado", "validado"].includes(b.status)) || a.code.localeCompare(b.code) || a.ordinal - b.ordinal), [units, workFilter, teamFilter, stateFilter, originFilter, typeFilter, search, field, profile]);
  const bounds = period === "rango" ? { start: rangeStart, end: rangeEnd } : periodBounds(period, new Date(), goals.weekStartsOn ?? 1);
  const report = summarizeUnits(filtered, base, bounds.start, bounds.end);
  const activePending = summarizeUnits(filtered.filter(u => works.some(w => w.id === u.obraId && w.estado !== "Finalizada")), base);
  const weekly = periodBounds("semana", new Date(), goals.weekStartsOn ?? 1);
  const previousWeek = periodBounds("anterior", new Date(), goals.weekStartsOn ?? 1);
  const currentWeekArea = summarizeUnits(filtered, base, weekly.start, weekly.end).finishedM2;
  const previousWeekArea = summarizeUnits(filtered, base, previousWeek.start, previousWeek.end).finishedM2;
  const daily = [...new Set(filtered.map(u => u.completedAt ? paraguayDay(u.completedAt) : "").filter(day => day && day >= bounds.start && day <= bounds.end))].sort()
    .map(day => ({ day, area: summarizeUnits(filtered, base, day, day).finishedM2 }));
  const dailyMax = Math.max(1, ...daily.map(d => d.area));
  const selectedOrder = orders.find(o => o.id === orderId);
  const template = stageTemplate(draft.type);
  const currentDraft = { ...draft, required, ...(manualArea ? { manualTotal: Number(totalArea), ...(distribution.trim() ? { distribution: distribution.split(/[;,\s]+/).map(Number) } : {}) } : {}) };
  let calculation = "";
  try { const calculated = buildManualUnits(currentDraft, profile?.uid ?? ""); calculation = `${fmt(calculated.reduce((s, u) => s + u.value, 0))} ${draft.measure === "m2" ? "m²" : draft.measure}`; } catch { /* Validation is shown on preview. */ }
  const differences = importDifferences(preview,units);
  const sourceChanges = differences.filter(d=>d.kind === "changed" || d.kind === "missing");
  const activeFilterLabels = [
    search && "Búsqueda: " + search,
    workFilter && "Obra: " + (works.find(work => work.id === workFilter)?.nombre ?? workFilter),
    teamFilter && "Cuadrilla: " + (teams.find(team => team.id === teamFilter)?.nombre ?? teamFilter),
    stateFilter && "Estado: " + statusLabels[stateFilter as keyof typeof statusLabels],
    originFilter && "Origen: " + (originFilter === "manual" ? "Manual" : "Producción"),
    typeFilter && "Tipo: " + typeFilter
  ].filter(Boolean);
  function previewManual() {
    try { setError(""); setPreview(buildManualUnits(currentDraft, profile!.uid)); } catch (e) { setError((e as Error).message); }
  }
  function previewProduction() {
    try {
      setError(""); if (!selectedOrder || !draft.obraId) throw new Error("Selecciona obra y orden de Producción.");
      if (selectedOrder.obraId && selectedOrder.obraId !== draft.obraId) throw new Error("La orden corresponde a otra obra.");
      setPreview(buildProductionUnits(selectedOrder, draft, profile!.uid)); setMergeChoices({}); setMergeReason(""); setMergeArea(false);
    } catch (e) { setError((e as Error).message); }
  }

  function openCreate(mode: "manual" | "production" | null = null) {
    if (preview.length && batchProgress) { setError(""); setShowCreate(true); return; }
    setError(""); setMessage(""); setCreateMode(mode); setDraft(freshDraft());
    setPreview([]); setOrderId(""); setManualArea(false); setTotalArea(""); setDistribution("");
    setRequired({ s0: true, s1: true, s2: true, s3: true });
    setMergeChoices({}); setMergeReason(""); setMergeArea(false); setBatchProgress(""); setShowCreate(true);
  }
  async function saveWork() {
    if (!profile) return;
    const saved = await perform(async () => {
      const inserted = await createInstallationUnits(preview, profile, sourceChanges.length ? {
        decisions: mergeChoices, revisions: Object.fromEntries(differences.filter(d => d.existing).map(d => [d.id, d.revision])),
        reason: mergeReason, confirmArea: mergeArea
      } : undefined, (done, total) => setBatchProgress(done + " / " + total + " unidades guardadas"));
      setMessage(inserted ? "Trabajo guardado: " + inserted + " unidades listas para seguir su instalación." : "Trabajo actualizado. Se conservaron las unidades y sus avances.");
    });
    if (saved) { setPreview([]); setShowCreate(false); setCreateMode(null); setDraft(freshDraft()); }
  }

  async function saveGoals() {
    if (!profile) return;
    const saved = await perform(async () => {
      await saveInstallationGoals(goalDraft, profile);
      setMessage("Metas y revisión guardadas.");
    });
    if (saved) { setShowGoals(false); setShowResults(true); }
  }

  function exportReport() {
    const cell = (value: string | number) => `"${String(value).replace(/^[=+@-]/, "'$&").replace(/"/g, '""')}"`;
    const rows = [["Obra", "Código", "Unidad", "Origen", "Tipo", "Medición", "Valor", "Estado", "Cuadrilla acreditada", "Fecha Paraguay", "Base", "Desde", "Hasta", "m2 acreditados en período"],
      ...filtered.map(u => [u.obraNombre, u.code, u.ordinal, u.origin, u.type, u.measure, u.value, statusLabels[u.status], u.creditedTeamName, u.completedAt ? paraguayDay(u.completedAt) : "", base, bounds.start, bounds.end, summarizeUnits([u], base, bounds.start, bounds.end).finishedM2])];
    const url = URL.createObjectURL(new Blob(["\uFEFF" + rows.map(r => r.map(cell).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = `instalaciones-${bounds.start}-${bounds.end}.csv`; link.click(); URL.revokeObjectURL(url);
  }
  if (!profile) return null;
  return <section className="min-w-0 space-y-5" aria-label="Seguimiento de instalaciones por unidad">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div><h2 className="text-xl font-bold text-slate-900">{field ? "Mi trabajo de instalación" : "Trabajos de instalación"}</h2><p className="mt-1 text-sm leading-6 text-next-muted">{field ? "Marcá las etapas de cada unidad y confirmá su finalización con una foto." : "Cargá o traé un trabajo de Producción, asigná la cuadrilla y seguí el avance."}</p></div>
      <div className="flex w-full shrink-0 flex-wrap gap-2 sm:w-auto">
        <button type="button" className={secondaryButton + " !px-3"} aria-label="Actualizar trabajos" title="Actualizar trabajos" disabled={busy} onClick={() => void load()}><RefreshCw className="h-4 w-4" aria-hidden="true" /></button>
        {!field && <button type="button" className={secondaryButton + " flex-1 sm:flex-none"} onClick={() => { setError(""); setShowResults(true); }}><BarChart3 className="h-4 w-4" aria-hidden="true" />Ver resultados</button>}
        {admin && <button type="button" className={button + " order-first w-full sm:order-none sm:w-auto"} disabled={busy} onClick={() => openCreate()}><Plus className="h-4 w-4" aria-hidden="true" />Agregar trabajo</button>}
      </div>
    </div>
    {preview.length > 0 && batchProgress && !showCreate && <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm text-amber-900">Hay una carga pendiente de completar. Podés continuar sin duplicar las unidades guardadas.</p><button type="button" className={secondaryButton} onClick={() => openCreate()}>Continuar carga</button></div>}
    {isDemoSession() && <p className="rounded-lg bg-amber-50 p-3 text-sm">Modo demo local: los cambios de este panel no escriben en Firebase.</p>}
    {editing && admin && <InstallationDialog title={"Editar unidad · " + editing.unit.code} onClose={() => { setEditing(null); setError(""); }} busy={busy} error={error}><div className="space-y-4">{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<p className="text-sm">Cambiar el nombre o la obligatoriedad de una etapa reinicia esa etapa. Las dimensiones recalculan el área cuando el criterio es dimensional. La superficie manual se corrige por separado.</p>
      <div className="grid gap-3 sm:grid-cols-2">{([['description', 'Descripción'], ['code', 'Código'], ['typeName', 'Tipo extensible'], ['details', 'Instrucciones / detalles'], ['reason', 'Justificación obligatoria']] as const).map(([key,label]) => <label key={key}>{label}<input className="field" value={editing.edit[key]} onChange={e => setEditing({ ...editing, edit: { ...editing.edit, [key]: e.target.value } })} /></label>)}
      {(['width', 'height'] as const).map(key => <label key={key}>{key === 'width' ? 'Ancho' : 'Alto'} (m)<input className="field" type="number" min={0} step="any" value={editing.edit[key]} onChange={e => setEditing({ ...editing, edit: { ...editing.edit, [key]: Number(e.target.value) } })} /></label>)}</div>
      <label className="flex gap-2"><input type="checkbox" checked={editing.edit.approvalRequired} onChange={e => setEditing({ ...editing, edit: { ...editing.edit, approvalRequired: e.target.checked } })} />Requiere validación</label>
      {stageKeys.map(k => <div key={k} className="flex items-center gap-3"><input className="field" aria-label={`Nombre etapa ${k}`} value={editing.edit.labels[k]} onChange={e => setEditing({ ...editing, edit: { ...editing.edit, labels: { ...editing.edit.labels, [k]: e.target.value } } })} /><label className="flex gap-2"><input type="checkbox" checked={editing.edit.required[k]} onChange={e => setEditing({ ...editing, edit: { ...editing.edit, required: { ...editing.edit.required, [k]: e.target.checked } } })} />Obligatoria</label></div>)}
      <div className="flex gap-3"><button className={button} disabled={busy} onClick={() => { if (window.confirm("¿Guardar la corrección de ficha, etapas y medidas con historial?")) void act(editing.unit, editing.edit).then(success => { if (success) setEditing(null); }); }}>Guardar corrección</button><button className={button} disabled={busy} onClick={() => setEditing(null)}>Cancelar</button></div></div></InstallationDialog>}
    {problemUnit && <InstallationDialog title={"Reportar problema · " + problemUnit.code} description={"Unidad " + problemUnit.ordinal + " · " + problemUnit.obraNombre} onClose={() => { setProblemUnit(null); setError(""); }} busy={busy} error={error} size="md"><div className="space-y-4">{error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      <label className="block">Problema<select className="field" value={problemReason} onChange={e => setProblemReason(e.target.value)}>{problemReasons.map(r => <option key={r}>{r}</option>)}</select></label>
      <label className="block">Comentario opcional<input className="field" maxLength={2000} value={problemComment} onChange={e => setProblemComment(e.target.value)} /></label>
      <label className="block">Foto opcional<input className="block" type="file" accept="image/jpeg,image/png,image/webp" onChange={e => setProblemPhoto(e.target.files?.[0] ?? null)} /></label>
      <div className="flex gap-3"><button className={button} disabled={busy} onClick={() => void perform(async () => {
        let url = ""; if (problemPhoto) {
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(problemPhoto.type) || problemPhoto.size > 8 * 1024 * 1024) throw new Error("Foto: JPG, PNG o WebP hasta 8 MB.");
          if (isDemoSession()) url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(problemPhoto); });
          else url = await uploadFile(evidencePath(problemUnit, problemPhoto), problemPhoto);
        }
        await reportInstallationProblem(problemUnit, problemReason, problemComment, url, profile, problemId.current); setProblemUnit(null); setMessage("Problema registrado; los avances se conservan. Los faltantes aparecen en Logística.");
      })}>Guardar problema</button><button className={button} disabled={busy} onClick={() => setProblemUnit(null)}>Cancelar</button></div></div></InstallationDialog>}
    {error && !showCreate && !showGoals && !editing && !problemUnit && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}{message && <p role="status" className="rounded-lg bg-green-50 p-3 text-sm text-green-700">{message}</p>}
    {!loaded && !error && <p>Cargando unidades…</p>}

    {field && <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-bold text-next-blue">Avance de mi cuadrilla · esta semana</p>
      <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-white p-3"><p className="text-xs text-next-muted">m² terminados esta semana</p><p className="text-xl font-black">{fmt(report.finishedM2)}</p></div><div className="rounded-xl bg-white p-3"><p className="text-xs text-next-muted">m² por terminar · acumulado</p><p className="text-xl font-black">{fmt(activePending.pendingM2)}</p></div></div>
      <p className="text-xs text-next-muted">Cada unidad suma al completar sus etapas, cargar la foto y confirmar su finalización.</p>
      {teams.filter(team => profile.assignedTeamIds?.includes(team.id)).map(team => {
        const amount = summarizeUnits(units.filter(unit => unit.creditedTeamId === team.id), "declarado", weekly.start, weekly.end).finishedM2;
        const goal = goals.weeklyByTeam[team.id];
        return <div key={team.id} className="rounded-xl bg-white p-3"><p className="text-sm font-bold">{team.nombre}</p><p className="mt-1 text-sm">{fmt(amount)} / {goal === undefined ? "Meta sin configurar" : fmt(goal) + " m²"}</p>{goal > 0 && <progress className="mt-2 w-full accent-next-blue" value={Math.min(100, amount / goal * 100)} max={100} aria-label={"Meta semanal de " + team.nombre} />}</div>;
      })}
    </div>}
    {!field && units.length > 0 && <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[
      ["Sin iniciar", filtered.filter(u => u.status === "pendiente").length],
      ["En proceso", filtered.filter(u => u.status === "en_proceso").length],
      ["Por revisar", filtered.filter(u => u.status === "declarado").length],
      ["Terminadas", filtered.filter(u => u.status === "validado").length]
    ].map(([label, value]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4"><p className="text-xs font-semibold text-next-muted">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{value}</p></div>)}</div>}
    {showResults && !field && <InstallationDialog title="Resultados de instalaciones" description="Revisá los metros cuadrados terminados, el avance por obra y las metas de tus cuadrillas." onClose={() => setShowResults(false)} size="xl" footer={<><button type="button" className={secondaryButton} onClick={exportReport}>Descargar detalle CSV</button><button type="button" className={button} onClick={() => setShowResults(false)}>Volver a trabajos</button></>}>
      <div className="space-y-5">
        <div className="space-y-2 rounded-xl bg-blue-50 p-3 text-sm text-slate-700"><p>{activeFilterLabels.length ? "Mostrando los resultados con estos filtros:" : "Mostrando todas las obras y cuadrillas de la lista."} Fechas en horario de Paraguay.</p>{activeFilterLabels.length > 0 && <><div className="flex flex-wrap gap-2">{activeFilterLabels.map(label => <span key={String(label)} className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs">{label}</span>)}</div><button type="button" className="min-h-10 font-bold text-next-blue underline" onClick={() => { setSearch(""); setWorkFilter(""); setTeamFilter(""); setStateFilter(""); setOriginFilter(""); setTypeFilter(""); }}>Mostrar todos los trabajos</button></>}</div>
    {field ? <p className="text-sm font-bold text-next-blue">Resumen semanal de mi cuadrilla · avance operativo · Paraguay</p> : <div className="grid gap-3 sm:grid-cols-3"><label>Qué trabajos contar<select className="field" value={base} onChange={e => setBase(e.target.value as typeof base)}><option value="declarado">Terminados por la cuadrilla</option><option value="validado">Con validación completada</option></select></label>
      <label>Período del resultado<select className="field" value={period} onChange={e => setPeriod(e.target.value as typeof period)}>{[["hoy", "Hoy"], ["semana", "Esta semana"], ["anterior", "Semana anterior"], ["mes", "Este mes"], ["rango", "Rango"]].map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      {admin && <div className="flex items-end"><button type="button" className={secondaryButton} onClick={() => { setGoalDraft(structuredClone(goals)); setError(""); setShowResults(false); setShowGoals(true); }}><Settings2 className="h-4 w-4" aria-hidden="true" />Editar metas</button></div>}</div>}
    {period === "rango" && <div className="grid gap-3 sm:grid-cols-2"><label>Desde<input className="field" type="date" value={rangeStart} onChange={e => setRangeStart(e.target.value)} /></label><label>Hasta<input className="field" type="date" min={rangeStart} value={rangeEnd} onChange={e => setRangeEnd(e.target.value)} /></label></div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[["Finalizados en el período", `${fmt(report.finishedM2)} m²`], ["Por terminar · acumulado", `${fmt(activePending.pendingM2)} m²`], ["Unidades en proceso", activePending.inProgress], ["Unidades sin iniciar", activePending.notStarted]].map(([label, value]) => <div key={label} className="rounded-lg bg-white p-3"><p className="text-xs font-bold text-next-muted">{label}</p><p className="text-xl font-black">{value}</p></div>)}</div>
    <p className="text-sm">{report.completed} unidades cerradas en el período · {report.awaitingApproval} esperan aprobación · {fmt(report.finishedMl)} ml · {fmt(report.finishedUn)} un. Las etapas parciales acreditan 0 m².{!field && ` Referencia mensual: ${fmt(goals.monthly)} m².`}</p>
    {admin && <div className="space-y-3 rounded-lg bg-white p-4"><h3 className="font-black">Instalaciones terminadas por día</h3>{!daily.length && <p className="text-sm">Sin cierres en el período.</p>}{daily.map(d => <div key={d.day} className="grid grid-cols-[6rem_1fr_5rem] items-center gap-2 text-sm"><span>{d.day}</span><progress className="w-full accent-next-blue" max={dailyMax} value={d.area} aria-label={`${d.day}: ${fmt(d.area)} metros cuadrados`} /><span>{fmt(d.area)} m²</span></div>)}<p className="text-sm">Esta semana: {fmt(currentWeekArea)} m² · anterior: {fmt(previousWeekArea)} m² · diferencia: {fmt(currentWeekArea - previousWeekArea)} m².</p></div>}
    <div className="space-y-1 pt-2"><h3 className="font-bold text-slate-900">Metas de esta semana</h3><p className="text-sm text-next-muted">Todas las obras de cada cuadrilla. Estas barras siempre corresponden a la semana actual.</p></div><div className="grid gap-3 sm:grid-cols-2">{teams.filter(t => !field || profile.assignedTeamIds?.includes(t.id)).map(team => {
      const amount = summarizeUnits(units.filter(u => u.creditedTeamId === team.id), base, weekly.start, weekly.end).finishedM2;
      const goal = goals.weeklyByTeam[team.id]; const percentage = goal > 0 ? amount / goal * 100 : 0;
      return <div key={team.id} className="rounded-lg bg-white p-3"><p className="font-bold">{team.nombre}</p><p className="text-sm">Semana: {fmt(amount)} / {goal === undefined ? "Sin configurar" : fmt(goal)} m² · {fmt(percentage)}%{goal > 0 ? ` · faltan ${fmt(Math.max(0,goal-amount))} m²` : ''}</p><progress className="w-full accent-next-blue" max={100} value={Math.min(100, percentage)} /></div>;
    })}</div>

        <p className="text-xs leading-5 text-next-muted">{base === "declarado" ? "Se cuentan todos los cierres de la cuadrilla, incluidos los que esperan revisión." : "Se cuentan los cierres validados por el administrador y los automáticos de trabajos que no requieren revisión."} Las finalizaciones corresponden al período elegido; los pendientes y el avance por obra son acumulados.</p>
    {admin && <><div className="overflow-x-auto rounded-lg bg-white p-3"><table className="min-w-[560px] w-full text-left text-sm"><caption className="mb-2 text-left font-bold">Avance acumulado por obra</caption><thead><tr><th>Obra</th><th>Total m²</th><th>Finalizado</th><th>Pendiente</th><th>Avance</th></tr></thead><tbody>{[...new Set(filtered.map(u => u.obraId))].map(id => { const r = summarizeUnits(filtered.filter(u => u.obraId === id), base); return <tr key={id} className="border-t"><td className="py-3">{filtered.find(u => u.obraId === id)?.obraNombre}</td><td>{fmt(r.totalM2)}</td><td>{fmt(r.finishedM2)}</td><td>{fmt(r.pendingM2)}</td><td>{fmt(r.totalM2 ? r.finishedM2 / r.totalM2 * 100 : 0)}%</td></tr>; })}</tbody></table></div></>}

      </div>
    </InstallationDialog>}
    {showGoals && admin && <InstallationGoalsDialog goals={goalDraft} teams={teams} works={works} busy={busy} error={error} onChange={setGoalDraft} onClose={() => { setShowGoals(false); setShowResults(true); setError(""); }} onSave={() => void saveGoals()} />}

    {showCreate && admin && <InstallationDialog
      title={preview.length ? "Revisar y crear trabajo" : createMode === "manual" ? "Cargar trabajo manual" : createMode === "production" ? "Traer trabajo de Producción" : "Agregar trabajo"}
      description={preview.length ? "Este es el trabajo que recibirá la cuadrilla. Confirmá los datos antes de guardarlo." : createMode ? "Elegí la obra, asigná la cuadrilla y completá los datos del trabajo." : "Elegí de dónde vienen los trabajos que querés instalar."}
      onClose={() => { setShowCreate(false); setError(""); }} busy={busy} error={error} size={createMode ? "lg" : "md"}
      footer={<>
        <button type="button" className={secondaryButton} disabled={busy} onClick={() => { if (preview.length && batchProgress) { setShowCreate(false); } else if (preview.length) { setPreview([]); setError(""); } else if (createMode) { setCreateMode(null); setError(""); } else setShowCreate(false); }}><ArrowLeft className="h-4 w-4" aria-hidden="true" />{batchProgress && preview.length ? "Continuar después" : createMode ? "Volver" : "Cancelar"}</button>
        {createMode && <button type="button" className={button} disabled={busy} onClick={() => { if (preview.length) void saveWork(); else if (createMode === "manual") previewManual(); else previewProduction(); }}>{busy ? "Guardando…" : preview.length ? "Confirmar trabajo" : "Revisar trabajo"}{!busy && <ArrowRight className="h-4 w-4" aria-hidden="true" />}</button>}
      </>}>
      <div className="space-y-5">
        <ol className="flex flex-wrap gap-x-5 gap-y-2 text-xs font-bold" aria-label="Pasos para agregar trabajo">{["Elegir origen", "Completar datos", "Revisar"].map((step, index) => { const current = preview.length ? 2 : createMode ? 1 : 0; return <li key={step} aria-current={current === index ? "step" : undefined} className={current === index ? "text-next-blue" : "text-slate-400"}>{index + 1}. {step}</li>; })}</ol>
        {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!createMode ? <div className="grid gap-3">
          <button type="button" className="flex min-h-28 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-next-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100" onClick={() => setCreateMode("manual")}><span className="rounded-xl bg-blue-50 p-3 text-next-blue"><PenLine className="h-6 w-6" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-base font-bold text-slate-900">Cargar manualmente</span><span className="mt-1 block text-sm leading-6 text-next-muted">Para parasoles, barandas u otros trabajos. Indicá las medidas y las etapas que debe completar la cuadrilla.</span></span><ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /></button>
          <button type="button" className="flex min-h-28 items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-next-blue hover:bg-blue-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-100" onClick={() => setCreateMode("production")}><span className="rounded-xl bg-blue-50 p-3 text-next-blue"><FileInput className="h-6 w-6" aria-hidden="true" /></span><span className="min-w-0 flex-1"><span className="block text-base font-bold text-slate-900">Desde una orden de Producción</span><span className="mt-1 block text-sm leading-6 text-next-muted">Elegí una orden ya cargada y aprovechá sus ventanas, medidas, PDF y referencias.</span></span><ArrowRight className="mt-2 h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" /></button>
        </div> : !preview.length ? <fieldset disabled={busy} className="min-w-0 space-y-5">
      <div className="grid gap-3 sm:grid-cols-2"><label>Obra<select className="field" value={draft.obraId} onChange={e => { const work = works.find(w => w.id === e.target.value); setDraft({ ...draft, obraId: work?.id ?? "", obraNombre: work?.nombre ?? "", approvalRequired: goals.approvalByWork?.[work?.id ?? ''] ?? false }); setOrderId(""); setPreview([]); }}><option value="">Seleccionar obra</option>{works.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}</select></label>
        <label>Cuadrilla<select className="field" value={draft.teamId} onChange={e => { const t = teams.find(t => t.id === e.target.value); setDraft({ ...draft, teamId: t?.id ?? "", teamName: t?.nombre ?? "" }); setPreview([]); }}><option value="">Pendiente de asignación</option>{teams.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label></div>
      <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold text-slate-600">Revisión administrativa · {draft.approvalRequired ? "activada" : "opcional"}</summary><label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" checked={draft.approvalRequired} onChange={e => { setDraft({ ...draft, approvalRequired: e.target.checked }); setPreview([]); }} />El administrador revisará la finalización antes de validarla</label></details>

          {!works.length && <p className="rounded-xl bg-amber-50 p-3 text-sm">Primero necesitás una obra. <Link className="font-bold text-next-blue underline" to="/obras">Ir a Obras</Link></p>}
          {!teams.length && <p className="rounded-xl bg-amber-50 p-3 text-sm">Podés guardar el trabajo sin cuadrilla y asignarla después. Para finalizarlo, debe tener una cuadrilla asignada.</p>}
          {createMode === "production" ? <div className="space-y-3 rounded-2xl border border-slate-200 p-4"><label className="block text-sm font-bold">Orden de Producción<select className="field" disabled={!draft.obraId} value={orderId} onChange={e => { setOrderId(e.target.value); setPreview([]); }}><option value="">{draft.obraId ? "Seleccionar una orden" : "Elegí primero la obra"}</option>{orders.filter(o => !o.obraId || o.obraId === draft.obraId).map(o => <option key={o.id} value={o.id}>{o.numero ?? o.id} · {o.obraNombre}</option>)}</select></label><p className="text-sm leading-6 text-next-muted">Se crearán unidades de instalación usando las cantidades y medidas de la orden. Podrás revisar las etapas antes de confirmar.</p>{draft.obraId && !orders.some(o => !o.obraId || o.obraId === draft.obraId) && <p className="text-sm">Esta obra todavía no tiene órdenes disponibles. <Link className="font-bold text-next-blue underline" to="/produccion">Cargar una orden en Producción</Link></p>}</div> : <>
      <h4 className="font-bold text-slate-900">Qué hay que instalar</h4><div className="grid gap-3 sm:grid-cols-2">
        <label>Tipo de trabajo<input className="field" list="installation-type-options" value={draft.type} onChange={e => { const type = e.target.value; const labels = stageTemplate(type); setDraft({ ...draft, type }); setRequired(Object.fromEntries(stageKeys.map(k => [k, Boolean(labels[k])])) as Record<StageKey, boolean>); setPreview([]); }} /><datalist id="installation-type-options">{installationTypes.map(t => <option key={t} value={t} />)}</datalist></label>
        <label>Código opcional<input className="field" value={draft.code} onChange={e => { setDraft({ ...draft, code: e.target.value }); setPreview([]); }} /></label>
        <label className="sm:col-span-2">Descripción del trabajo<input className="field" value={draft.description} onChange={e => { setDraft({ ...draft, description: e.target.value }); setPreview([]); }} /></label>
        <label>Cantidad de unidades o sectores<input className="field" type="number" min={1} max={10000} step={1} value={draft.quantity} onChange={e => { setDraft({ ...draft, quantity: Number(e.target.value) }); setPreview([]); }} /></label>
        <label>Medición<select className="field" value={draft.measure} onChange={e => { setDraft({ ...draft, measure: e.target.value as InstallationDraft["measure"] }); setManualArea(false); setPreview([]); }}><option value="m2">m²</option><option value="ml">ml</option><option value="un">un</option></select></label>
        <label>Medidas expresadas en<select className="field" value={draft.dimensionUnit} onChange={e => { setDraft({ ...draft, dimensionUnit: e.target.value as InstallationDraft["dimensionUnit"] }); setPreview([]); }}><option>mm</option><option>cm</option><option>m</option></select></label>
        {draft.measure !== "un" && (draft.measure === "ml" ? ["length"] : ["width", "height"]).map(key => <label key={key}>{key === "width" ? "Ancho" : key === "height" ? "Alto" : "Largo"}<input className="field" type="number" min={0} step="any" value={draft[key as "width" | "height" | "length"]} onChange={e => { setDraft({ ...draft, [key]: Number(e.target.value) }); setPreview([]); }} /></label>)}
      </div>
      {draft.measure === "m2" && <label className="flex gap-2"><input type="checkbox" checked={manualArea} onChange={e => { setManualArea(e.target.checked); setPreview([]); }} />Ingresar una superficie total manual (trabajo irregular)</label>}
      {manualArea && <div className="grid gap-3 sm:grid-cols-2"><label>Superficie total m²<input className="field" type="number" step="any" value={totalArea} onChange={e => { setTotalArea(e.target.value); setPreview([]); }} /></label><label>Distribución por unidad / sector (separar con ;)<input className="field" placeholder="15;12;18" value={distribution} onChange={e => { setDistribution(e.target.value); setPreview([]); }} /></label><p className="text-sm sm:col-span-2">Si dejas distribución vacía se propondrá un reparto igual; revisa y confirma cada valor en la vista previa.</p></div>}
      <label className="block">Criterio de medición / instrucciones<input className="field" placeholder={draft.type === "parasol" ? "Área frontal, no superficie de tubos" : "Criterio de medición"} value={draft.criterion} onChange={e => { setDraft({ ...draft, criterion: e.target.value }); setPreview([]); }} /></label>
      <div><p className="font-bold">Etapas obligatorias · desmarcar = No aplica</p>{stageKeys.filter(k => template[k]).map(k => <label key={k} className="mr-4 inline-flex min-h-11 items-center gap-2"><input type="checkbox" checked={required[k]} onChange={e => { setRequired({ ...required, [k]: e.target.checked }); setPreview([]); }} />{template[k]}</label>)}
        {/sin contramarco/i.test(draft.description) && <p className="text-sm text-amber-700">La descripción indica SIN CONTRAMARCO. Confirma desmarcando Contramarco si corresponde.</p>}</div>
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-next-blue">Total previsto</p><p className="mt-1 text-xl font-black text-next-blue">{calculation || "Completá los datos para calcular"}</p><p className="mt-1 text-xs text-next-muted">Podrás revisar cada unidad antes de guardar.</p></div>

          </>}
        </fieldset> : <fieldset disabled={busy || Boolean(batchProgress)} className="min-w-0 space-y-4">
      <dl className="grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold text-next-muted">Obra</dt><dd className="mt-1 font-bold">{preview[0].obraNombre}</dd></div><div><dt className="text-xs font-semibold text-next-muted">Cuadrilla asignada</dt><dd className="mt-1 font-bold">{preview[0].teamName || "Pendiente de asignación"}</dd></div><div><dt className="text-xs font-semibold text-next-muted">Origen</dt><dd className="mt-1">{preview[0].origin === "manual" ? "Carga manual" : "Orden de Producción"}</dd></div><div><dt className="text-xs font-semibold text-next-muted">Revisión al finalizar</dt><dd className="mt-1">{preview[0].approvalRequired ? "Requiere revisión administrativa" : "Se valida con el cierre de la cuadrilla"}</dd></div></dl>
      {batchProgress && <p role="status" className="rounded-lg bg-blue-50 p-3">{batchProgress}. Si hubo una interrupción, tocá Confirmar trabajo para continuar la misma carga. Las unidades guardadas se conservan sin duplicarse.</p>}
      {preview.length > 0 && sourceChanges.length > 0 && <div className="space-y-3 rounded-lg border border-amber-300 bg-white p-4"><h3 className="font-black">Revisión de diferencias</h3><label>Decisión para todas las diferencias<select className="field" defaultValue="" onChange={e=>{ const choice=e.target.value as "keep"|"apply"; if(choice) setMergeChoices(Object.fromEntries(sourceChanges.filter(d=>d.incoming).map(d=>[d.id,choice]))); }}><option value="">Elegir individualmente</option><option value="keep">Conservar todas las fichas actuales</option><option value="apply">Aplicar todos los datos de origen revisados</option></select></label><p>Los avances, fotos, etapas, cuadrilla acreditada e historial se conservan. Las unidades omitidas no se borran. Aplicar superficie recalcula el crédito existente.</p>{sourceChanges.map(d=><div key={d.id} className="rounded-lg border p-3"><p className="break-all font-bold">{d.existing?.code} · unidad {d.existing?.ordinal}: {d.kind === 'missing' ? 'Omitida: conservar y señalar' : 'Datos de origen cambiados'}</p>{d.incoming && <><p>{d.existing?.description} → {d.incoming.description}; área {fmt(d.existing?.value ?? 0)} → {fmt(d.incoming.value)}; cantidad {d.existing?.quantity} → {d.incoming.quantity}</p><label>Decisión<select className="field" value={mergeChoices[d.id] ?? ''} onChange={e=>setMergeChoices({...mergeChoices,[d.id]:e.target.value as 'keep'|'apply'})}><option value="">Elegir</option><option value="keep">Conservar ficha y superficie actuales</option><option value="apply">Aplicar datos de origen revisados</option></select></label></>}</div>)}<label>Justificación obligatoria<input className="field" value={mergeReason} onChange={e=>setMergeReason(e.target.value)} /></label><label className="flex gap-2"><input type="checkbox" checked={mergeArea} onChange={e=>setMergeArea(e.target.checked)} />Confirmo las correcciones de superficie seleccionadas y su efecto en productividad.</label></div>}
      {preview.length > 0 && <div className="space-y-3 border-t pt-3"><h4 className="font-bold">Vista previa: {preview.length} unidades · {fmt(preview.reduce((s, u) => s + u.value, 0))} {preview[0].measure === 'm2' ? 'm²' : preview[0].measure}</h4>
        <p className="text-sm">{preview.length > 50 ? "Se muestran las primeras 50 unidades; el total incluye todas." : "Revisá las medidas y las etapas antes de confirmar."}</p><div className="max-h-64 overflow-auto rounded-xl border border-slate-200 px-3">{preview.slice(0,50).map(u => <p key={u.id} className="break-words border-b py-2 text-sm">{u.code} · unidad {u.ordinal}/{u.quantity} · {u.description} · {fmt(u.value)} {u.measure === 'm2' ? 'm²' : u.measure} · {u.areaMode === 'manual' ? 'Medición manual' : u.areaMode === 'count' ? 'Por unidades' : 'Por dimensiones'} · {u.criterion}</p>)}</div>
        {[...new Set(preview.map(u => u.jobId))].map(jobId => { const u = preview.find(u => u.jobId === jobId)!; return <div key={jobId} className="rounded-lg border p-3"><p className="break-words font-bold">Etapas de {u.code} · tipo {u.type} · revisar antes de confirmar</p>{stageKeys.map(k => <div key={k} className="my-2 grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center"><input className="field" aria-label={`Nombre de etapa ${k} para ${u.code}`} value={u.labels[k]} onChange={e => setPreview(preview.map(item => item.jobId === jobId ? { ...item, labels: { ...item.labels, [k]:e.target.value }, required: { ...item.required,[k]:e.target.value.trim() ? item.required[k] : false } } : item))} /><label className="inline-flex min-h-11 items-center gap-2"><input type="checkbox" disabled={!u.labels[k].trim()} checked={u.required[k]} onChange={e => setPreview(preview.map(item => item.jobId === jobId ? { ...item, required: { ...item.required, [k]: e.target.checked } } : item))} />Obligatoria</label></div>)}{/sin contramarco/i.test(`${u.description} ${u.details}`) && <p className="text-sm text-amber-700">SIN CONTRAMARCO detectado: confirma No aplica desmarcando la etapa Contramarco.</p>}</div>; })}
        {preview[0].origin === "produccion" && <p className="text-sm">Las posiciones coincidentes no se duplican. Los cambios de origen requieren decisiones en la revisión de diferencias. Las referencias omitidas se señalan sin borrar unidades ni avances.</p>}
</div>}

        </fieldset>}
      </div>
    </InstallationDialog>}

    {units.length > 0 && <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-bold text-slate-900">{field ? "Mis unidades de instalación" : "Unidades de instalación"}</h3><span className="text-xs font-semibold text-next-muted">{filtered.length} {filtered.length === 1 ? "unidad" : "unidades"} · pendientes primero</span></div>
      <div className="grid gap-3 md:grid-cols-3"><label className="block text-xs font-bold text-slate-600">Buscar trabajo<div className="relative mt-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-slate-400" aria-hidden="true" /><input className="field !mt-0 !pl-9" placeholder="Código, descripción u obra" value={search} onChange={e => setSearch(e.target.value)} /></div></label>
        <label className="block text-xs font-bold text-slate-600">Obra<select className="field" value={workFilter} onChange={e => setWorkFilter(e.target.value)}><option value="">Todas mis obras</option>{works.map(w => <option key={w.id} value={w.id}>{w.nombre}</option>)}</select></label>
        <label className="block text-xs font-bold text-slate-600">Cuadrilla<select className="field" value={teamFilter} onChange={e => setTeamFilter(e.target.value)}><option value="">Todas</option>{teams.filter(t => profile.role === "admin" || profile.assignedTeamIds?.includes(t.id)).map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
      </div>
      <div className="flex flex-wrap gap-2" aria-label="Filtrar por estado">{[["", "Todos"], ...Object.entries(statusLabels)].map(([key, label]) => <button key={key} type="button" aria-pressed={stateFilter === key} className={"min-h-10 rounded-full px-4 text-xs font-bold transition " + (stateFilter === key ? "bg-blue-50 text-next-blue ring-1 ring-blue-200" : "bg-slate-50 text-slate-600 hover:bg-slate-100")} onClick={() => setStateFilter(key)}>{label}</button>)}</div>
      {admin && <details className="text-sm"><summary className="w-fit cursor-pointer font-semibold text-next-muted">Más filtros</summary><div className="mt-3 grid gap-3 sm:grid-cols-2"><label>Origen<select className="field" value={originFilter} onChange={e => setOriginFilter(e.target.value)}><option value="">Todos los orígenes</option><option value="manual">Carga manual</option><option value="produccion">Producción / PDF</option></select></label><label>Tipo de trabajo<select className="field" value={typeFilter} onChange={e => setTypeFilter(e.target.value)}><option value="">Todos los tipos</option>{installationTypes.map(t => <option key={t}>{t}</option>)}</select></label></div></details>}
    </div>}
    {!filtered.length && loaded && <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-10 text-center"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-next-blue"><ClipboardList className="h-7 w-7" aria-hidden="true" /></span><h3 className="mt-4 text-lg font-bold text-slate-900">{units.length ? "No hay trabajos con estos filtros" : "Todo listo para tu primer trabajo"}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-next-muted">{units.length ? "Probá otra obra, cuadrilla o estado para encontrar lo que buscás." : admin ? "Empezá cargando un trabajo manual o trayendo una orden de Producción. Después podrás asignar la cuadrilla y seguir cada unidad." : "Los trabajos asignados a tu obra y cuadrilla aparecerán aquí."}</p>{admin && !units.length && <button type="button" className={button + " mt-5"} onClick={() => openCreate()}><Plus className="h-4 w-4" aria-hidden="true" />Agregar primer trabajo</button>}{units.length > 0 && <button type="button" className={secondaryButton + " mt-5"} onClick={() => { setSearch(""); setWorkFilter(""); setTeamFilter(""); setStateFilter(""); setOriginFilter(""); setTypeFilter(""); }}>Limpiar filtros</button>}</div>}
    <div className="space-y-3">{filtered.map(unit => {
      const closed = ["declarado", "validado"].includes(unit.status);
      const mayEdit = profile.role === "admin" || (profile.assignedWorkIds.includes(unit.obraId) && profile.assignedTeamIds?.includes(unit.teamId));
      return <article key={unit.id} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap justify-between gap-2"><div className="min-w-0 break-words"><p className="text-xs font-bold text-next-blue">{unit.obraNombre} · {unit.origin === "manual" ? "Manual" : "Producción / PDF"}</p><h3 className="break-all font-black">{unit.code} · Unidad / sector {unit.ordinal}/{unit.quantity}</h3><p>{admin ? unit.description : fieldText(unit.description)}</p></div><span className={`h-fit rounded-lg px-3 py-2 text-xs font-bold ${closed ? "bg-green-50 text-green-700" : "bg-blue-50 text-next-blue"}`}>{statusLabels[unit.status]}</span></div>
        <p className="text-sm">{fmt(unit.value)} {unit.measure === "m2" ? "m²" : unit.measure} · {unit.areaMode === "manual" ? "Superficie manual" : admin ? unit.criterion : fieldText(unit.criterion)} · {unit.teamName || "Pendiente de asignación"}</p>
        {unit.width > 0 && unit.height > 0 && <p className="text-sm text-next-muted">Dimensiones: {unit.width * 1000} × {unit.height * 1000} mm</p>}
        {unit.sourceMissing && <p className="rounded-lg bg-amber-50 p-3 text-sm">Referencia omitida en la última importación; unidad y avances conservados para revisión administrativa.</p>}
        {!admin && (unit.pdfUrl || unit.drawingUrl || unit.attachments?.length) && !unit.fieldReferencesApproved && <p className="text-sm text-next-muted">Referencias pendientes de revisión administrativa para campo.</p>}
        {unit.details && <p className="text-sm text-next-muted">{admin ? unit.details : fieldText(unit.details)}</p>}
        <div className="flex flex-wrap gap-3">{unit.pdfUrl && (admin || unit.fieldReferencesApproved) && <a className="font-bold text-next-blue underline" href={unit.pdfUrl} target="_blank" rel="noreferrer">PDF original</a>}{unit.drawingUrl && (admin || unit.fieldReferencesApproved) && <a className="font-bold text-next-blue underline" href={unit.drawingUrl} target="_blank" rel="noreferrer">Dibujo / referencia</a>}{unit.photoUrl && <a className="font-bold text-next-blue underline" href={unit.photoUrl} target="_blank" rel="noreferrer">Foto final</a>}</div>
        {(admin || unit.fieldReferencesApproved) && unit.attachments?.map(a => <a key={a.id} className="mr-3 inline-block font-bold text-next-blue underline" href={a.url} target="_blank" rel="noreferrer">{admin ? a.name : fieldText(a.name) || "Referencia"}</a>)}
        <div className="grid gap-2 sm:grid-cols-2">{stageKeys.filter(k => unit.labels[k]).map(k => <button key={k} className={`min-h-12 rounded-lg border p-3 text-left text-sm font-bold ${unit.stages[k] ? "border-green-300 bg-green-50" : "border-slate-200"}`} disabled={busy || closed || !unit.required[k] || !mayEdit} onClick={() => void act(unit, { type: "stage", key: k, value: !unit.stages[k] })}>{unit.required[k] ? unit.stages[k] ? "✓ " : "○ " : "No aplica · "}{admin ? unit.labels[k] : fieldText(unit.labels[k]) || "Etapa obligatoria"}</button>)}</div>
        {!closed && mayEdit && <div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-bold">Foto final obligatoria<input className="mt-2 block w-full" type="file" accept="image/jpeg,image/png,image/webp" capture="environment" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ""; if (!file) return;
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024) { setError("Usa una foto JPG, PNG o WebP de hasta 8 MB."); return; }
          void perform(async () => { let url: string; if (isDemoSession()) { url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); }); } else url = await uploadFile(evidencePath(unit, file), file);
            await actOnInstallationUnit(unit.id, { type: "photo", url }, profile, crypto.randomUUID()); setMessage("Foto final guardada."); });
        }} /></label><button className={button} disabled={busy || !canComplete(unit)} onClick={() => { if (window.confirm(`¿Confirmar unidad ${unit.ordinal} completamente terminada? Se acreditarán ${fmt(unit.value)} ${unit.measure} una sola vez.`)) void act(unit, { type: "complete" }); }}>Confirmar finalización</button></div>}
        {mayEdit && <button className="min-h-11 rounded-lg border border-amber-300 bg-amber-50 px-4 text-sm font-bold" disabled={busy} onClick={() => { setProblemUnit(unit); setProblemReason(problemReasons[0]); setProblemComment(""); setProblemPhoto(null); problemId.current = crypto.randomUUID(); }}>Reportar problema</button>}
        {closed && <p className="text-sm">Finalizó {unit.completedBy} · {new Date(unit.completedAt).toLocaleString("es-PY", { timeZone: "America/Asuncion" })} · crédito: {unit.creditedTeamName}</p>}
        {admin && <details className="rounded-xl border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-bold text-next-blue">Administrar unidad y referencias</summary><div className="mt-4 flex flex-wrap items-end gap-3"><button className={secondaryButton} disabled={busy} onClick={() => { if(window.confirm("Confirma que revisaste TODOS los PDFs, dibujos y adjuntos de esta unidad y que no contienen precios, importes ni datos económicos. La aprobación del original se aplica a toda su orden.")) void act(unit,{type:"references",approved:!unit.fieldReferencesApproved,reason:unit.fieldReferencesApproved ? "Retirar aprobación de referencias" : "Referencias revisadas sin datos económicos"}); }}>{unit.fieldReferencesApproved ? "Retirar referencias de campo" : "Autorizar referencias para campo"}</button>{unit.status === "declarado" && <button className={button} disabled={busy} onClick={() => void act(unit, { type: "validate" })}>Validar finalización</button>}
          {!closed && <button className={button} disabled={busy} onClick={() => setEditing({ unit, edit: { type: 'edit', description: unit.description, code: unit.code, typeName: unit.type, details: unit.details, width: unit.width, height: unit.height, labels: { ...unit.labels }, required: { ...unit.required }, approvalRequired: unit.approvalRequired, reason: '' } })}>Editar ficha y etapas</button>}
          <label className="text-sm font-bold">Agregar referencia (PDF / imagen)<input className="block max-w-full" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" disabled={busy} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; if (!file) return; void perform(async () => { if (!['application/pdf','image/jpeg','image/png','image/webp'].includes(file.type) || file.size > 15*1024*1024) throw new Error('Referencia: PDF / imagen de hasta 15 MB.'); const path = `installation-support/${unit.id}/${crypto.randomUUID()}-${sanitizeStorageFileName(file.name)}`; let url: string; if (isDemoSession()) url = await new Promise<string>((resolve,reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = reject; r.readAsDataURL(file); }); else url = await uploadFile(path,file); await actOnInstallationUnit(unit.id, { type:'attach', attachment: { id:crypto.randomUUID(),url,path,name:file.name,createdAt:new Date().toISOString(),createdBy:profile.uid },reason:'Referencia administrativa' },profile,crypto.randomUUID()); setMessage('Referencia agregada con historial.'); }); }} /></label>
          {closed && <button className={button} disabled={busy} onClick={() => { const reason = window.prompt("Motivo de reapertura (retira el crédito actual y conserva historial)"); if (reason) void act(unit, { type: "reopen", reason }); }}>Reabrir</button>}
          <label className="text-sm">Reasignar cuadrilla<select className="field" disabled={busy} value={unit.teamId} onChange={e => { const team = teams.find(t => t.id === e.target.value); const reason = window.prompt("Motivo de reasignación. El crédito anterior no cambia si ya finalizó."); if (reason) void act(unit, { type: "assign", teamId: team?.id ?? "", teamName: team?.nombre ?? "", reason }); }}><option value="">Sin asignar</option>{teams.map(t => <option key={t.id} value={t.id}>{t.nombre}</option>)}</select></label>
          {unit.measure === "m2" && <button className={button} disabled={busy} onClick={() => { const value = window.prompt("Nueva superficie de esta unidad en m²", String(unit.value)); if (value === null) return; const reason = window.prompt("Justificación obligatoria. Se recalcularán los reportes, incluso si ya finalizó."); if (reason && window.confirm("¿Confirmar corrección de superficie y recalcular productividad con historial?")) void act(unit, { type: "area", value: Number(value.replace(",", ".")), reason }); }}>Corregir superficie</button>}
          <button className={button} onClick={() => setDetail(detail === unit.id ? "" : unit.id)}>Historial</button></div></details>}
        {detail === unit.id && admin && <ol className="space-y-2 text-xs">{unit.history.map(entry => <li key={entry.id} className="break-words">{entry.at} · {entry.by} · {entry.action} · {entry.reason}{entry.before && <details><summary>Valores antes / después</summary><p>{entry.before}</p><p>{entry.after}</p></details>}</li>)}</ol>}
      </article>;
    })}</div>
  </section>;
}
