import { useState } from "react";
import { CalendarDays, ChevronDown, ClipboardCheck, Target, UsersRound } from "lucide-react";
import type { InstallationGoals } from "../../lib/installationRepository";
import type { Cuadrilla, Obra } from "../../types";
import InstallationDialog from "./InstallationDialog";

type Props = {
  goals: InstallationGoals;
  teams: Cuadrilla[];
  works: Obra[];
  busy: boolean;
  error?: string;
  onChange: (goals: InstallationGoals) => void;
  onSave: () => void;
  onClose: () => void;
};

const days = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const inputClass = "mt-2 min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-next-text outline-none transition focus:border-next-blue focus:ring-2 focus:ring-blue-100 disabled:bg-slate-50";

export default function InstallationGoalsDialog({ goals, teams, works, busy, error, onChange, onSave, onClose }: Props) {
  const workDays = goals.workDays ?? [1, 2, 3, 4, 5];
  const [holidayText, setHolidayText] = useState(() => (goals.holidays ?? []).join(", "));

  function changeTeamGoal(teamId: string, value: string) {
    const weeklyByTeam = { ...goals.weeklyByTeam };
    if (value === "") delete weeklyByTeam[teamId];
    else weeklyByTeam[teamId] = Number(value);
    onChange({ ...goals, weeklyByTeam });
  }

  return (
    <InstallationDialog
      title="Metas de instalaciones"
      description="Definí los objetivos de las cuadrillas y cómo se revisan los trabajos terminados."
      onClose={onClose}
      busy={busy}
      error={error}
      size="lg"
      footer={
        <div className="flex w-full flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-next-muted">Los cambios se aplican al guardar.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={onClose} className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-next-muted transition hover:bg-slate-100 disabled:opacity-50 sm:flex-none">Cancelar</button>
            <button type="button" disabled={busy} onClick={onSave} className="min-h-11 flex-1 rounded-xl bg-next-blue px-5 text-sm font-bold text-white transition hover:bg-blue-700 disabled:cursor-wait disabled:opacity-50 sm:flex-none">{busy ? "Guardando…" : "Guardar cambios"}</button>
          </div>
        </div>
      }
    >
      <fieldset disabled={busy} className="min-w-0 space-y-5">
        <legend className="sr-only">Configuración de metas y revisión de instalaciones</legend>
        {error ? <p role="alert" tabIndex={-1} className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-700 outline-none">{error}</p> : null}

        <section className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-next-blue"><UsersRound className="h-5 w-5" aria-hidden="true" /></span>
            <div><h3 className="font-black">Meta semanal por cuadrilla</h3><p className="mt-1 text-sm leading-6 text-next-muted">Cuántos m² se propone terminar cada equipo durante una semana. Dejá el campo vacío si todavía no tiene una meta.</p></div>
          </div>
          {teams.length ? <div className="grid gap-3 sm:grid-cols-2">
            {teams.map(team => (
              <label key={team.id} className="min-w-0 rounded-2xl border border-slate-200 p-4">
                <span className="block break-words text-sm font-bold">{team.nombre}</span>
                <span className="sr-only">Meta semanal en metros cuadrados</span>
                <div className="relative">
                  <input type="number" min={0} step="any" inputMode="decimal" placeholder="Sin configurar" value={goals.weeklyByTeam[team.id] ?? ""} onChange={event => changeTeamGoal(team.id, event.target.value)} className={inputClass + " pr-12"} />
                  <span className="pointer-events-none absolute right-3 top-5 text-sm font-semibold text-next-muted" aria-hidden="true">m²</span>
                </div>
              </label>
            ))}
          </div> : <p className="rounded-xl bg-slate-50 p-4 text-sm leading-6 text-next-muted">Todavía no hay cuadrillas disponibles para configurar metas.</p>}
        </section>

        <section className="rounded-2xl bg-slate-50 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <Target className="mt-0.5 h-5 w-5 shrink-0 text-next-blue" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <label className="block text-sm font-black">Referencia total del mes (m²)<input type="number" min={0} step="any" inputMode="decimal" value={goals.monthly} onChange={event => onChange({ ...goals, monthly: Number(event.target.value) })} className={inputClass + " max-w-xs"} /></label>
              <p className="mt-2 text-sm leading-6 text-next-muted">Es una referencia mensual independiente. No se calcula sumando las metas semanales.</p>
            </div>
          </div>
        </section>

        <details className="group rounded-2xl border border-slate-200">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
            <CalendarDays className="h-5 w-5 shrink-0 text-next-blue" aria-hidden="true" /><span className="flex-1">Calendario de trabajo</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-4 border-t border-slate-100 p-4">
            <label className="block text-sm font-bold">La semana empieza el<select value={goals.weekStartsOn ?? 1} onChange={event => onChange({ ...goals, weekStartsOn: Number(event.target.value) })} className={inputClass}>{days.map((day, index) => <option key={day} value={index}>{day}</option>)}</select></label>
            <div><p className="text-sm font-bold">Días laborales habituales</p><div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">{days.map((day, index) => <label key={day} className="flex min-h-11 cursor-pointer items-center gap-2 rounded-xl bg-slate-50 px-3 text-sm"><input type="checkbox" className="h-4 w-4 accent-next-blue" checked={workDays.includes(index)} onChange={event => onChange({ ...goals, workDays: event.target.checked ? [...workDays, index] : workDays.filter(value => value !== index) })} />{day}</label>)}</div></div>
            <label className="block text-sm font-bold">Feriados<input value={holidayText} placeholder="2026-12-25, 2027-01-01" onChange={event => { setHolidayText(event.target.value); onChange({ ...goals, holidays: event.target.value.split(",").map(value => value.trim()).filter(Boolean) }); }} className={inputClass} /><span className="mt-2 block text-xs font-normal leading-5 text-next-muted">Usá el formato año-mes-día y separá las fechas con una coma.</span></label>
            <p className="rounded-xl bg-blue-50 px-3 py-3 text-xs leading-5 text-blue-800">El calendario sirve de referencia para ajustar las metas. Los trabajos realmente terminados cuentan también en días no laborales.</p>
          </div>
        </details>

        <details className="group rounded-2xl border border-slate-200">
          <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 text-sm font-bold [&::-webkit-details-marker]:hidden">
            <ClipboardCheck className="h-5 w-5 shrink-0 text-next-blue" aria-hidden="true" /><span className="flex-1">Revisión de trabajos terminados</span><ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
          </summary>
          <div className="space-y-3 border-t border-slate-100 p-4">
            <p className="text-sm leading-6 text-next-muted">Elegí las obras cuyos trabajos nuevos necesitan aprobación del administrador después de que la cuadrilla los termine.</p>
            {works.length ? works.map(work => <label key={work.id} className="flex min-h-12 cursor-pointer items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm"><input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-next-blue" checked={goals.approvalByWork?.[work.id] ?? false} onChange={event => onChange({ ...goals, approvalByWork: { ...goals.approvalByWork, [work.id]: event.target.checked } })} /><span className="min-w-0 break-words font-semibold">{work.nombre}<span className="mt-1 block text-xs font-normal text-next-muted">{goals.approvalByWork?.[work.id] ? "Requiere revisión administrativa" : "Validación automática al finalizar"}</span></span></label>) : <p className="text-sm text-next-muted">Todavía no hay obras disponibles.</p>}
            <p className="text-xs leading-5 text-next-muted">Esta preferencia se aplica a las unidades que se creen después. Los cierres anteriores conservan su configuración.</p>
          </div>
        </details>
      </fieldset>
    </InstallationDialog>
  );
}
