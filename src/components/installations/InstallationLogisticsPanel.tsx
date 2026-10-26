import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { loadInstallationProblems, updateInstallationProblem, type InstallationProblem } from "../../lib/installationProblems";
import { paraguayDay } from "../../utils/installationUnits";

export default function InstallationLogisticsPanel() {
  const { profile } = useAuth(); const [problems, setProblems] = useState<InstallationProblem[]>([]); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [onlyOpen, setOnlyOpen] = useState(true); const [work, setWork] = useState("");
  const admin = profile?.role === "admin"; const mayManage = admin || profile?.role === "encargado";
  async function load() { if (!profile) return; try { setProblems(await loadInstallationProblems(profile)); setError(""); } catch (e) { setError((e as Error).message); } }
  useEffect(() => { void load(); }, [profile?.uid]);
  async function update(problem: InstallationProblem, change: Partial<Pick<InstallationProblem, "status" | "delivery" | "neededOn">>) {
    if (!profile || busy) return; setBusy(true);
    try { await updateInstallationProblem(problem.id, { status: problem.status, delivery: problem.delivery, neededOn: problem.neededOn, ...change }, profile, crypto.randomUUID()); await load(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  if (!profile) return null;
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1); const tomorrowDay = paraguayDay(tomorrow);
  const visible = problems.filter(p => (!onlyOpen || p.status !== "resuelto") && (!work || work === p.obraId) && (admin || profile.role !== "encargado" || p.material));
  return <section className="space-y-3 rounded-xl border border-slate-200 bg-white p-4"><div className="flex flex-wrap justify-between gap-3"><div><h2 className="text-xl font-black text-next-blue">Problemas y logística</h2><p className="text-sm">Preparación del día anterior · mañana {tomorrowDay}. Preparar o entregar materiales acredita 0 m².</p></div><button className="min-h-11 rounded-lg border px-4" onClick={() => void load()}>Actualizar</button></div>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    <div className="flex flex-wrap items-center gap-3"><label className="flex gap-2"><input type="checkbox" checked={onlyOpen} onChange={e => setOnlyOpen(e.target.checked)} />Solo pendientes / en gestión</label><label>Obra<select className="field" value={work} onChange={e => setWork(e.target.value)}><option value="">Todas las obras autorizadas</option>{[...new Set(problems.map(p => p.obraId))].map(id => <option key={id} value={id}>{problems.find(p => p.obraId === id)?.obraNombre}</option>)}</select></label></div>
    {!visible.length && <p className="text-sm text-next-muted">Sin problemas con estos filtros.</p>}
    {visible.map(p => <article key={p.id} className="space-y-2 rounded-lg border p-3"><h3 className="font-bold">{p.obraNombre} · {p.code}</h3><p className="text-sm">{p.reason} · {p.status.replace("_", " ")}{p.comment ? ` · ${p.comment}` : ""}</p><p className="text-xs text-next-muted">Reportó {p.createdBy} · {new Date(p.createdAt).toLocaleString("es-PY", { timeZone: "America/Asuncion" })}</p>{p.photoUrl && <a className="text-next-blue underline" href={p.photoUrl} target="_blank" rel="noreferrer">Foto del problema</a>}
      {mayManage && <div className="grid gap-3 sm:grid-cols-3"><label>Gestión<select className="field" disabled={busy} value={p.status} onChange={e => void update(p, { status: e.target.value as InstallationProblem["status"] })}><option value="pendiente">Pendiente</option><option value="en_gestion">En gestión</option><option value="resuelto">Resuelto</option></select></label>{p.material && <><label>Material<select className="field" disabled={busy} value={p.delivery} onChange={e => void update(p, { delivery: e.target.value as InstallationProblem["delivery"] })}><option value="pendiente">Pendiente</option><option value="preparado">Preparado</option><option value="entregado">Entregado</option><option value="no_disponible">No disponible</option></select></label><label>Necesario para<input className="field" disabled={busy} type="date" value={p.neededOn} onChange={e => void update(p, { neededOn: e.target.value })} /></label></>}</div>}
      {admin && <details><summary className="cursor-pointer text-sm font-bold">Historial de gestión</summary>{p.history.map(h => <p key={h.id} className="text-xs">{h.at} · {h.by} · {h.reason}</p>)}</details>}
    </article>)}
  </section>;
}
