import { Camera, X } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { currentUser } from "../../lib/roles";
import type {
  Cuadrilla,
  Obra,
  ProgressMaterialReport,
  ProgressReport,
  ProgressReportEntry,
  SystemUser,
  WorkProgressRubric
} from "../../types";
import {
  calculateRubricProgress,
  calculateTotalExecuted,
  clampProgress
} from "../../utils/progress";
import { formatUnitLabel } from "../../utils/units";

type ReportDraft = Omit<ProgressReport, "id" | "createdAt" | "updatedAt">;

type ProgressReportModalProps = {
  obra: Obra;
  rubrics: WorkProgressRubric[];
  reports: ProgressReport[];
  cuadrillas: Cuadrilla[];
  user?: Pick<SystemUser, "uid" | "nombre" | "role">;
  onClose: () => void;
  onSubmit: (report: ReportDraft) => Promise<void>;
};

export default function ProgressReportModal({
  obra,
  rubrics,
  reports,
  cuadrillas,
  user,
  onClose,
  onSubmit
}: ProgressReportModalProps) {
  const actor = user ?? { uid: currentUser.id, nombre: currentUser.name, role: currentUser.role };
  const now = new Date();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [general, setGeneral] = useState({
    fecha: now.toISOString().slice(0, 10),
    hora: now.toTimeString().slice(0, 5),
    cuadrillaId: cuadrillas.find((crew) => crew.obraId === obra.id)?.id ?? "",
    seTrabajoHoy: true,
    observacionGeneral: "",
    incidentes: "",
    proximoTrabajo: "",
    photosText: ""
  });
  const [entries, setEntries] = useState<Record<string, { cantidad: string; porcentaje: string; justificacion: string; observacion: string }>>(
    () =>
      Object.fromEntries(
        rubrics.map((rubro) => [
          rubro.id,
          {
            cantidad: "",
            porcentaje: String(calculateRubricProgress(rubro, reports)),
            justificacion: "",
            observacion: ""
          }
        ])
      )
  );
  const [material, setMaterial] = useState({
    material: "",
    cantidad: "",
    unidad: "",
    observacion: "",
    urgencia: "Media" as "Baja" | "Media" | "Alta"
  });

  const selectedCrew = cuadrillas.find((crew) => crew.id === general.cuadrillaId);

  const preview = useMemo(() => {
    return rubrics.map((rubro) => {
      const current = calculateRubricProgress(rubro, reports);
      const executed = calculateTotalExecuted(rubro.id, reports);
      const draft = entries[rubro.id];
      const today = Number(draft?.cantidad ?? 0);
      const nextQuantity = rubro.modoCalculo === "cantidad" ? executed + (Number.isFinite(today) ? today : 0) : executed;
      const nextPercent = rubro.modoCalculo === "cantidad"
        ? rubro.cantidadTotalPrevista > 0
          ? clampProgress((nextQuantity / rubro.cantidadTotalPrevista) * 100)
          : current
        : clampProgress(Number(draft?.porcentaje ?? current));
      return { rubro, current, executed, today, nextQuantity, nextPercent };
    });
  }, [entries, reports, rubrics]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    const reportEntries: ProgressReportEntry[] = [];

    for (const item of preview) {
      const draft = entries[item.rubro.id];
      if (item.rubro.modoCalculo === "cantidad") {
        if (!item.today) continue;
        if (item.nextQuantity > item.rubro.cantidadTotalPrevista) {
          const ok = window.confirm(`${item.rubro.nombre} supera el total previsto. Guardar igualmente limitado al 100%?`);
          if (!ok) return;
        }
        reportEntries.push({
          id: `entry-${item.rubro.id}-${Date.now()}`,
          rubroId: item.rubro.id,
          rubroNombre: item.rubro.nombre,
          cantidadAnterior: item.executed,
          cantidadEjecutadaHoy: item.today,
          cantidadAcumuladaNueva: Math.min(item.nextQuantity, item.rubro.cantidadTotalPrevista),
          porcentajeAnterior: item.current,
          porcentajeNuevo: item.nextPercent,
          modo: "cantidad",
          observacion: draft?.observacion || undefined
        });
      } else {
        if (item.nextPercent === item.current && !draft?.observacion) continue;
        if (!draft?.justificacion.trim()) {
          setError(`Carga una justificacion para ajustar ${item.rubro.nombre}.`);
          return;
        }
        reportEntries.push({
          id: `entry-${item.rubro.id}-${Date.now()}`,
          rubroId: item.rubro.id,
          rubroNombre: item.rubro.nombre,
          porcentajeAnterior: item.current,
          porcentajeNuevo: item.nextPercent,
          modo: "manual",
          justificacionManual: draft.justificacion,
          observacion: draft.observacion || undefined
        });
      }
    }

    const materialsReported: ProgressMaterialReport[] = material.material.trim()
      ? [
          {
            id: `mat-${Date.now()}`,
            obraId: obra.id,
            material: material.material,
            cantidad: Number(material.cantidad),
            unidad: material.unidad,
            observacion: material.observacion || undefined,
            estado: "Pendiente",
            reportadoPor: actor.nombre,
            fechaReporte: general.fecha,
            urgencia: material.urgencia
          }
        ]
      : [];

    if (!reportEntries.length && !materialsReported.length && !general.observacionGeneral.trim()) {
      setError("Carga al menos un avance, material u observacion.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit({
        obraId: obra.id,
        fecha: general.fecha,
        hora: general.hora,
        userId: actor.uid,
        userName: actor.nombre,
        userRole: actor.role,
        cuadrillaId: selectedCrew?.id,
        cuadrillaNombre: selectedCrew?.nombre,
        seTrabajoHoy: general.seTrabajoHoy,
        observacionGeneral: general.observacionGeneral || undefined,
        incidentes: general.incidentes || undefined,
        proximoTrabajo: general.proximoTrabajo || undefined,
        photos: general.photosText
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean),
        entries: reportEntries,
        materialsReported: materialsReported.map((item) => ({ ...item, reportadoPor: actor.nombre }))
      });
      onClose();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "No se pudo guardar el avance.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-3xl rounded-lg bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Parte de avance</p>
            <h2 className="mt-1 text-xl font-black text-next-text">{obra.nombre}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Cerrar">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error ? <div className="mb-4 rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-next-red">{error}</div> : null}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="field" type="date" value={general.fecha} onChange={(event) => setGeneral({ ...general, fecha: event.target.value })} />
            <input className="field" type="time" value={general.hora} onChange={(event) => setGeneral({ ...general, hora: event.target.value })} />
            <select className="field" value={general.cuadrillaId} onChange={(event) => setGeneral({ ...general, cuadrillaId: event.target.value })}>
              <option value="">Sin cuadrilla asignada</option>
              {cuadrillas.map((crew) => (
                <option key={crew.id} value={crew.id}>{crew.nombre}</option>
              ))}
            </select>
            <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-next-muted">
              <input
                checked={general.seTrabajoHoy}
                className="accent-next-blue"
                type="checkbox"
                onChange={(event) => setGeneral({ ...general, seTrabajoHoy: event.target.checked })}
              />
              Se trabajo hoy
            </label>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-black text-next-text">Rubros trabajados</h3>
            {preview.map((item) => (
              <div key={item.rubro.id} className="rounded-lg border border-slate-200 p-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-black text-next-text">{item.rubro.nombre}</p>
                    <p className="mt-1 text-xs font-semibold text-next-muted">
                      Actual {item.current}% · Ejecutado {item.executed} {formatUnitLabel(item.rubro.unidad, item.executed)} / {item.rubro.cantidadTotalPrevista} {formatUnitLabel(item.rubro.unidad, item.rubro.cantidadTotalPrevista)}
                    </p>
                  </div>
                  <p className="text-lg font-black text-next-blue">{Math.round(item.nextPercent)}%</p>
                </div>
                {item.rubro.modoCalculo === "cantidad" ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr]">
                    <input
                      className="field"
                      min={0}
                      placeholder={`Ejecutado hoy (${formatUnitLabel(item.rubro.unidad, 2)})`}
                      type="number"
                      value={entries[item.rubro.id]?.cantidad ?? ""}
                      onChange={(event) => setEntries({
                        ...entries,
                        [item.rubro.id]: { ...entries[item.rubro.id], cantidad: event.target.value }
                      })}
                    />
                    <input
                      className="field"
                      placeholder="Observacion del rubro"
                      value={entries[item.rubro.id]?.observacion ?? ""}
                      onChange={(event) => setEntries({
                        ...entries,
                        [item.rubro.id]: { ...entries[item.rubro.id], observacion: event.target.value }
                      })}
                    />
                  </div>
                ) : (
                  <div className="mt-3 grid gap-2 sm:grid-cols-[120px_1fr]">
                    <input
                      className="field"
                      max={100}
                      min={0}
                      placeholder="% nuevo"
                      type="number"
                      value={entries[item.rubro.id]?.porcentaje ?? ""}
                      onChange={(event) => setEntries({
                        ...entries,
                        [item.rubro.id]: { ...entries[item.rubro.id], porcentaje: event.target.value }
                      })}
                    />
                    <input
                      className="field"
                      placeholder="Justificacion obligatoria"
                      value={entries[item.rubro.id]?.justificacion ?? ""}
                      onChange={(event) => setEntries({
                        ...entries,
                        [item.rubro.id]: { ...entries[item.rubro.id], justificacion: event.target.value }
                      })}
                    />
                    <input
                      className="field sm:col-span-2"
                      placeholder="Observacion"
                      value={entries[item.rubro.id]?.observacion ?? ""}
                      onChange={(event) => setEntries({
                        ...entries,
                        [item.rubro.id]: { ...entries[item.rubro.id], observacion: event.target.value }
                      })}
                    />
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <textarea className="field min-h-24 sm:col-span-2" placeholder="Observacion general" value={general.observacionGeneral} onChange={(event) => setGeneral({ ...general, observacionGeneral: event.target.value })} />
            <input className="field" placeholder="Incidentes opcionales" value={general.incidentes} onChange={(event) => setGeneral({ ...general, incidentes: event.target.value })} />
            <input className="field" placeholder="Proximo trabajo previsto" value={general.proximoTrabajo} onChange={(event) => setGeneral({ ...general, proximoTrabajo: event.target.value })} />
            <label className="text-xs font-black uppercase text-next-muted sm:col-span-2">
              Fotos de avance (URLs, una por linea)
              <textarea className="field mt-1 min-h-20" placeholder="Fallback visual hasta conectar subida real" value={general.photosText} onChange={(event) => setGeneral({ ...general, photosText: event.target.value })} />
            </label>
          </div>

          <div className="rounded-lg bg-next-bg p-3">
            <div className="mb-3 flex items-center gap-2 text-sm font-black text-next-text">
              <Camera className="h-4 w-4 text-next-blue" aria-hidden="true" />
              Reportar material pendiente
            </div>
            <div className="grid gap-2 sm:grid-cols-[1fr_90px_110px_120px]">
              <input className="field" placeholder="Material" value={material.material} onChange={(event) => setMaterial({ ...material, material: event.target.value })} />
              <input className="field" placeholder="Cant." type="number" value={material.cantidad} onChange={(event) => setMaterial({ ...material, cantidad: event.target.value })} />
              <input className="field" placeholder="Unidad" value={material.unidad} onChange={(event) => setMaterial({ ...material, unidad: event.target.value })} />
              <select className="field" value={material.urgencia} onChange={(event) => setMaterial({ ...material, urgencia: event.target.value as "Baja" | "Media" | "Alta" })}>
                <option>Baja</option>
                <option>Media</option>
                <option>Alta</option>
              </select>
              <input className="field sm:col-span-4" placeholder="Observacion del material" value={material.observacion} onChange={(event) => setMaterial({ ...material, observacion: event.target.value })} />
            </div>
          </div>

          <button className="h-12 w-full rounded-md bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar parte de avance"}
          </button>
        </form>
      </section>
    </div>
  );
}
