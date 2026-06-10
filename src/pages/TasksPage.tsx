import { CheckCircle2, Clock3, Eye, MapPin, Plus, Search, X } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import DataCard from "../components/ui/DataCard";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  createFieldTask,
  getFieldTasks,
  getFieldWorkdays,
  getObras,
  updateFieldTask
} from "../lib/firestore";
import { canCreateTasks, canValidateTaskProgress, canViewAllTasks } from "../lib/roles";
import type { FieldTask, FieldTaskStatus, FieldWorkday, Obra, TaskPhoto } from "../types";
import { formatDateShort } from "../utils/formatters";
import { formatUnitLabel, normalizeUnit } from "../utils/units";

const taskStatuses: FieldTaskStatus[] = ["pendiente", "asignada", "en_proceso", "reportada", "completada", "observada", "cancelada"];

const statusLabels: Record<FieldTaskStatus, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  en_proceso: "En proceso",
  reportada: "Reportada",
  completada: "Completada",
  observada: "Observada",
  cancelada: "Cancelada"
};

type TaskForm = {
  obraId: string;
  titulo: string;
  descripcion: string;
  rubroNombre: string;
  cantidadPrevista: string;
  unidad: "" | "m2" | "unidad";
  fechaAsignada: string;
  fechaLimite: string;
  asignadoAType: FieldTask["asignadoAType"];
  asignadoAId: string;
  asignadoANombre: string;
  fiscalizadorNombre: string;
  requiereFotos: boolean;
  requiereValidacion: boolean;
  observacionInterna: string;
};

const emptyForm: TaskForm = {
  obraId: "",
  titulo: "",
  descripcion: "",
  rubroNombre: "",
  cantidadPrevista: "",
  unidad: "",
  fechaAsignada: new Date().toISOString().slice(0, 10),
  fechaLimite: "",
  asignadoAType: "equipo_campo",
  asignadoAId: "",
  asignadoANombre: "Equipo Campo 01",
  fiscalizadorNombre: "",
  requiereFotos: true,
  requiereValidacion: true,
  observacionInterna: ""
};

export default function TasksPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [works, setWorks] = useState<Obra[]>([]);
  const [workdays, setWorkdays] = useState<FieldWorkday[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [workFilter, setWorkFilter] = useState("todos");
  const [dateFilter, setDateFilter] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedTasks, loadedWorks, loadedWorkdays] = await Promise.all([
        getFieldTasks(),
        getObras(),
        getFieldWorkdays()
      ]);
      setTasks(loadedTasks);
      setWorks(loadedWorks);
      setWorkdays(loadedWorkdays);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las tareas.");
    } finally {
      setLoading(false);
    }
  }

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      const text = `${task.obraNombre} ${task.titulo} ${task.asignadoANombre ?? ""} ${task.fiscalizadorNombre ?? ""}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesStatus = statusFilter === "todos" || task.estado === statusFilter;
      const matchesWork = workFilter === "todos" || task.obraId === workFilter;
      const matchesDate = filterByDate(task, dateFilter);
      return matchesQuery && matchesStatus && matchesWork && matchesDate;
    });
  }, [dateFilter, query, statusFilter, tasks, workFilter]);

  const today = new Date().toISOString().slice(0, 10);
  const activeWorkdays = workdays.filter((jornada) => jornada.estado === "activa");
  const stats = [
    { label: "Tareas pendientes", value: tasks.filter((task) => ["pendiente", "asignada"].includes(task.estado)).length },
    { label: "Tareas en proceso", value: tasks.filter((task) => task.estado === "en_proceso").length },
    { label: "Tareas vencidas", value: tasks.filter((task) => isOverdue(task)).length },
    { label: "Completadas hoy", value: tasks.filter((task) => task.estado === "completada" && task.updatedAt?.slice(0, 10) === today).length },
    { label: "Observadas", value: tasks.filter((task) => task.estado === "observada").length },
    { label: "Equipos trabajando hoy", value: activeWorkdays.length }
  ];

  async function handleStatus(task: FieldTask, estado: FieldTaskStatus) {
    try {
      await updateFieldTask(task.id, { estado });
      setMessage(`Tarea marcada como ${statusLabels[estado].toLowerCase()}.`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar la tarea.");
    }
  }

  if (loading) {
    return <StateCard text="Cargando tareas..." />;
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase text-next-blue">Operaciones</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">TAREAS</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Asignacion, seguimiento y validacion de tareas de obra para fiscalizadores y equipos de campo.
          </p>
        </div>
        {canCreateTasks(profile) ? (
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={() => setModalOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva tarea
          </button>
        ) : null}
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map((item) => (
          <DataCard key={item.label} title={item.label}>
            <p className="text-3xl font-black text-next-blue">{item.value}</p>
          </DataCard>
        ))}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_160px_180px_160px]">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-next-muted" aria-hidden="true" />
            <input className="field pl-9" placeholder="Buscar por obra, tarea o equipo" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="todos">Todos los estados</option>
            {taskStatuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
          </select>
          <select className="field" value={workFilter} onChange={(event) => setWorkFilter(event.target.value)}>
            <option value="todos">Todas las obras</option>
            {works.map((work) => <option key={work.id} value={work.id}>{work.nombre}</option>)}
          </select>
          <select className="field" value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
            <option value="todos">Todas las fechas</option>
            <option value="hoy">Hoy</option>
            <option value="semana">Esta semana</option>
            <option value="vencidas">Vencidas</option>
          </select>
        </div>
      </section>

      <section className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-soft">
        <div className="hidden min-w-0 overflow-x-auto lg:block">
          <table className="w-full min-w-[980px] table-fixed text-left text-xs">
            <thead className="bg-next-bg text-[11px] font-black uppercase text-next-muted">
              <tr>
                <th className="px-3 py-3">Fecha asignada</th>
                <th className="px-3 py-3">Obra</th>
                <th className="px-3 py-3">Tarea</th>
                <th className="px-3 py-3">Rubro</th>
                <th className="px-3 py-3">Asignado a</th>
                <th className="px-3 py-3">Estado</th>
                <th className="px-3 py-3 text-right">Cantidad prevista</th>
                <th className="px-3 py-3 text-center">Fotos</th>
                <th className="px-3 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleTasks.length ? visibleTasks.map((task) => (
                <tr key={task.id} className="align-top">
                  <td className="px-3 py-3 font-semibold text-next-muted">{task.fechaAsignada ? formatDateShort(task.fechaAsignada) : "-"}</td>
                  <td className="px-3 py-3 font-black text-next-text">{task.obraNombre}</td>
                  <td className="px-3 py-3">
                    <p className="font-black text-next-text">{task.titulo}</p>
                    <p className="mt-1 line-clamp-1 font-semibold text-next-muted">{task.descripcion || task.observacionCampo || "-"}</p>
                  </td>
                  <td className="px-3 py-3 font-semibold text-next-muted">{task.rubroNombre || "-"}</td>
                  <td className="px-3 py-3 font-semibold text-next-muted">{task.asignadoANombre || "-"}</td>
                  <td className="px-3 py-3"><TaskStatusBadge status={task.estado} /></td>
                  <td className="px-3 py-3 text-right font-black text-next-text">
                    {task.cantidadPrevista ? `${task.cantidadPrevista} ${formatUnitLabel(task.unidad, task.cantidadPrevista)}` : "-"}
                  </td>
                  <td className="px-3 py-3 text-center font-black text-next-blue">{task.fotos?.length ?? 0}</td>
                  <td className="px-3 py-3">
                    <TaskActions task={task} canValidate={canValidateTaskProgress(profile)} onStatus={handleStatus} />
                  </td>
                </tr>
              )) : (
                <tr><td className="px-3 py-8 text-center text-sm font-semibold text-next-muted" colSpan={9}>No hay tareas con esos filtros.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {visibleTasks.length ? visibleTasks.map((task) => (
            <article key={task.id} className="rounded-lg border border-slate-100 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-next-text">{task.titulo}</p>
                  <p className="mt-1 text-xs font-semibold text-next-muted">{task.obraNombre}</p>
                </div>
                <TaskStatusBadge status={task.estado} />
              </div>
              <div className="mt-3 grid gap-2 text-xs font-semibold text-next-muted">
                <span>Asignado a: {task.asignadoANombre || "-"}</span>
                <span>Fecha: {task.fechaAsignada ? formatDateShort(task.fechaAsignada) : "-"}</span>
                <span>Fotos: {task.fotos?.length ?? 0}</span>
              </div>
              <TaskActions task={task} canValidate={canValidateTaskProgress(profile)} onStatus={handleStatus} />
            </article>
          )) : <EmptyState text="No hay tareas con esos filtros." />}
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Equipos trabajando hoy">
          <div className="space-y-3">
            {activeWorkdays.length ? activeWorkdays.map((jornada) => (
              <div key={jornada.id} className="rounded-md border border-slate-100 p-3 text-sm font-semibold text-next-muted">
                <p className="font-black text-next-text">{jornada.equipoNombre || jornada.userName}</p>
                <p>{jornada.obraNombre} desde {jornada.horaInicio}</p>
                {jornada.ubicacionInicio ? (
                  <a className="mt-2 inline-flex items-center gap-2 text-xs font-black text-next-blue" href={`https://www.google.com/maps?q=${jornada.ubicacionInicio.lat},${jornada.ubicacionInicio.lng}`} target="_blank" rel="noreferrer">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    Abrir en Google Maps
                  </a>
                ) : <p className="mt-2 text-xs font-bold text-next-orange">Jornada sin ubicacion registrada</p>}
              </div>
            )) : <EmptyState text="No hay jornadas activas." />}
          </div>
        </DataCard>
        <DataCard title="Fotos y ubicacion de tareas">
          <div className="space-y-3">
            {visibleTasks.some((task) => (task.fotos?.length ?? 0) > 0 || getTaskWorkday(task, workdays)?.ubicacionInicio || getTaskWorkday(task, workdays)?.ubicacionFin) ? visibleTasks
              .filter((task) => (task.fotos?.length ?? 0) > 0 || getTaskWorkday(task, workdays)?.ubicacionInicio || getTaskWorkday(task, workdays)?.ubicacionFin)
              .slice(0, 6)
              .map((task) => (
                <TaskEvidenceCard key={task.id} task={task} workday={getTaskWorkday(task, workdays)} />
              )) : <EmptyState text="Todavia no hay fotos o ubicaciones asociadas a las tareas visibles." />}
          </div>
        </DataCard>
      </section>

      {modalOpen ? (
        <NewTaskModal
          works={works}
          onClose={() => setModalOpen(false)}
          onCreated={async () => {
            setModalOpen(false);
            setMessage("Tarea creada correctamente.");
            await load();
          }}
        />
      ) : null}
    </div>
  );
}

function NewTaskModal({ onClose, onCreated, works }: { works: Obra[]; onClose: () => void; onCreated: () => Promise<void>; }) {
  const { profile } = useAuth();
  const [form, setForm] = useState<TaskForm>(emptyForm);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const selectedWork = works.find((work) => work.id === form.obraId);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!selectedWork) {
      setError("Selecciona una obra.");
      return;
    }
    if (!form.titulo.trim()) {
      setError("Carga el titulo de la tarea.");
      return;
    }
    if (form.cantidadPrevista && (!form.unidad || !normalizeUnit(form.unidad))) {
      setError("Selecciona una unidad valida para la cantidad prevista.");
      return;
    }

    setSaving(true);
    try {
      await createFieldTask({
        obraId: selectedWork.id,
        obraNombre: selectedWork.nombre,
        titulo: form.titulo.trim(),
        descripcion: form.descripcion || form.observacionInterna || undefined,
        rubroNombre: form.rubroNombre || undefined,
        cantidadPrevista: form.cantidadPrevista ? Number(form.cantidadPrevista) : undefined,
        unidad: form.unidad || undefined,
        fechaAsignada: form.fechaAsignada || undefined,
        fechaLimite: form.fechaLimite || undefined,
        asignadoAType: form.asignadoAType,
        asignadoAId: form.asignadoAId || undefined,
        asignadoANombre: form.asignadoANombre || undefined,
        fiscalizadorId: profile?.uid,
        fiscalizadorNombre: form.fiscalizadorNombre || profile?.nombre || undefined,
        estado: form.asignadoANombre ? "asignada" : "pendiente",
        requiereFotos: form.requiereFotos,
        requiereValidacion: form.requiereValidacion,
        observacionFiscalizador: form.observacionInterna || undefined,
        createdBy: profile?.uid
      });
      await onCreated();
    } catch (saveError) {
      console.error("No se pudo crear la tarea.", saveError);
      setError("No se pudo crear la tarea. Revisa los datos e intenta nuevamente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-3xl rounded-lg bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Nueva tarea</p>
            <h2 className="mt-1 text-xl font-black text-next-text">Asignar tarea de campo</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} title="Cerrar">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {error ? <Notice tone="error" text={error} /> : null}

        <form className="mt-4 grid gap-3 sm:grid-cols-2" onSubmit={handleSubmit}>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Obra</span>
            <select className="field mt-1" required value={form.obraId} onChange={(event) => setForm({ ...form, obraId: event.target.value })}>
              <option value="">Seleccionar obra</option>
              {works.map((work) => <option key={work.id} value={work.id}>{work.nombre}</option>)}
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Titulo de tarea</span>
            <input className="field mt-1" required value={form.titulo} onChange={(event) => setForm({ ...form, titulo: event.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-black uppercase text-next-muted">Descripcion</span>
            <textarea className="field mt-1 min-h-20" value={form.descripcion} onChange={(event) => setForm({ ...form, descripcion: event.target.value })} />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Rubro relacionado</span>
            <input className="field mt-1" placeholder="Opcional" value={form.rubroNombre} onChange={(event) => setForm({ ...form, rubroNombre: event.target.value })} />
          </label>
          <div className="grid gap-2 sm:grid-cols-2">
            <label>
              <span className="text-xs font-black uppercase text-next-muted">Cantidad prevista</span>
              <input className="field mt-1" min={0} type="number" value={form.cantidadPrevista} onChange={(event) => setForm({ ...form, cantidadPrevista: event.target.value })} />
            </label>
            <label>
              <span className="text-xs font-black uppercase text-next-muted">Unidad</span>
              <select className="field mt-1" value={form.unidad} onChange={(event) => setForm({ ...form, unidad: normalizeUnit(event.target.value) })}>
                <option value="">Seleccionar unidad</option>
                <option value="m2">m²</option>
                <option value="unidad">unidad</option>
              </select>
            </label>
          </div>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Fecha asignada</span>
            <input className="field mt-1" type="date" value={form.fechaAsignada} onChange={(event) => setForm({ ...form, fechaAsignada: event.target.value })} />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Fecha limite</span>
            <input className="field mt-1" type="date" value={form.fechaLimite} onChange={(event) => setForm({ ...form, fechaLimite: event.target.value })} />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Asignar a</span>
            <select className="field mt-1" value={form.asignadoAType} onChange={(event) => setForm({ ...form, asignadoAType: event.target.value as FieldTask["asignadoAType"] })}>
              <option value="equipo_campo">Equipo de campo / Cuadrilla</option>
              <option value="fiscalizador">Fiscalizador</option>
              <option value="usuario">Usuario especifico</option>
            </select>
          </label>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Asignado a</span>
            <input className="field mt-1" placeholder="Equipo Campo 01" value={form.asignadoANombre} onChange={(event) => setForm({ ...form, asignadoANombre: event.target.value })} />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Fiscalizador</span>
            <input className="field mt-1" placeholder={profile?.nombre ?? "Fiscalizador"} value={form.fiscalizadorNombre} onChange={(event) => setForm({ ...form, fiscalizadorNombre: event.target.value })} />
          </label>
          <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-next-muted">
            <input checked={form.requiereFotos} className="accent-next-blue" type="checkbox" onChange={(event) => setForm({ ...form, requiereFotos: event.target.checked })} />
            Requiere fotos
          </label>
          <label className="flex h-11 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-next-muted">
            <input checked={form.requiereValidacion} className="accent-next-blue" type="checkbox" onChange={(event) => setForm({ ...form, requiereValidacion: event.target.checked })} />
            Requiere validacion
          </label>
          <label className="sm:col-span-2">
            <span className="text-xs font-black uppercase text-next-muted">Observacion interna</span>
            <input className="field mt-1" value={form.observacionInterna} onChange={(event) => setForm({ ...form, observacionInterna: event.target.value })} />
          </label>
          <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60 sm:col-span-2" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Crear tarea"}
          </button>
        </form>
      </section>
    </div>
  );
}

function TaskEvidenceCard({ task, workday }: { task: FieldTask; workday?: FieldWorkday }) {
  const photos = task.fotos ?? [];
  const location = workday?.ubicacionFin ?? workday?.ubicacionInicio;
  const locationTime = workday?.ubicacionFin ? workday.horaFin : workday?.horaInicio;
  return (
    <div className="rounded-md border border-slate-100 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-next-text">{task.titulo}</p>
          <p className="mt-1 text-xs font-semibold text-next-muted">{task.obraNombre} | {task.asignadoANombre || "Sin asignar"}</p>
        </div>
        <span className="rounded-md bg-next-light px-2 py-1 text-xs font-black text-next-blue">{photos.length} foto(s)</span>
      </div>
      {photos.length ? <PhotoStrip photos={photos} /> : null}
      <div className="mt-3 rounded-md bg-next-bg px-3 py-2">
        <p className="text-xs font-black uppercase text-next-muted">Ubicacion</p>
        {location ? (
          <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs font-semibold text-next-muted">
            <span>Registrada {locationTime ?? ""} | {location.lat.toFixed(5)}, {location.lng.toFixed(5)}</span>
            <a className="inline-flex items-center gap-1 font-black text-next-blue" href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} target="_blank" rel="noreferrer">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              Google Maps
            </a>
          </div>
        ) : <p className="mt-1 text-xs font-semibold text-next-muted">Sin ubicacion vinculada.</p>}
      </div>
    </div>
  );
}

function PhotoStrip({ photos }: { photos: TaskPhoto[] }) {
  return (
    <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
      {photos.slice(0, 6).map((photo) => (
        <img key={photo.id} className="h-16 w-16 shrink-0 rounded-md object-cover ring-1 ring-slate-200" src={photo.url} alt={photo.fileName ?? "Foto de tarea"} />
      ))}
    </div>
  );
}

function getTaskWorkday(task: FieldTask, workdays: FieldWorkday[]) {
  return workdays.find((workday) => workday.id === task.jornadaId || workday.tareasIds.includes(task.id));
}

function TaskActions({
  canValidate,
  onStatus,
  task
}: {
  canValidate: boolean;
  onStatus: (task: FieldTask, status: FieldTaskStatus) => Promise<void>;
  task: FieldTask;
}) {
  return (
    <div className="mt-3 flex flex-wrap gap-2 lg:mt-0">
      {task.estado === "reportada" && canValidate ? (
        <>
          <button className="inline-flex h-8 items-center gap-1 rounded-md bg-next-blue px-2 text-[11px] font-black text-white" type="button" onClick={() => void onStatus(task, "completada")}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Validar
          </button>
          <button className="h-8 rounded-md border border-next-orange px-2 text-[11px] font-black text-next-orange" type="button" onClick={() => void onStatus(task, "observada")}>
            Observar
          </button>
        </>
      ) : null}
      <a className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 px-2 text-[11px] font-black text-next-muted" href={`/NEXT-CONTROL/avance-obras/${task.obraId}`}>
        <Eye className="h-3.5 w-3.5" />
        Obra
      </a>
    </div>
  );
}

function TaskStatusBadge({ status }: { status: FieldTaskStatus }) {
  const badge = status === "completada"
    ? "success"
    : status === "observada" || status === "cancelada"
      ? "critical"
      : status === "reportada"
        ? "warning"
        : "info";
  return <StatusBadge label={statusLabels[status]} status={badge} />;
}

function filterByDate(task: FieldTask, filter: string) {
  if (filter === "todos") return true;
  if (filter === "vencidas") return isOverdue(task);
  const today = new Date();
  const date = task.fechaAsignada || task.fechaLimite;
  if (!date) return false;
  if (filter === "hoy") return date === today.toISOString().slice(0, 10);
  if (filter === "semana") {
    const current = new Date(date);
    const diff = current.getTime() - startOfDay(today).getTime();
    return diff >= 0 && diff <= 6 * 24 * 60 * 60 * 1000;
  }
  return true;
}

function isOverdue(task: FieldTask) {
  if (!task.fechaLimite || ["completada", "cancelada"].includes(task.estado)) return false;
  return task.fechaLimite < new Date().toISOString().slice(0, 10);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}

function StateCard({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-4 py-8 text-sm font-bold text-next-muted shadow-soft">{text}</div>;
}
