import { Camera, CheckCircle2, Clock3, ExternalLink, MapPin, UsersRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import DataCard from "../components/ui/DataCard";
import StatusBadge from "../components/ui/StatusBadge";
import {
  getFieldTasks,
  getFieldWorkdays,
  getObras
} from "../lib/firestore";
import type { FieldTask, FieldWorkday, Obra, TaskPhoto } from "../types";
import { formatDateShort } from "../utils/formatters";

export default function AdminInstallationsPage() {
  const [workdays, setWorkdays] = useState<FieldWorkday[]>([]);
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [works, setWorks] = useState<Obra[]>([]);
  const [selected, setSelected] = useState<FieldWorkday | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedWorkdays, loadedTasks, loadedWorks] = await Promise.all([
        getFieldWorkdays(),
        getFieldTasks(),
        getObras()
      ]);
      setWorkdays(loadedWorkdays);
      setTasks(loadedTasks);
      setWorks(loadedWorks);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar instalaciones.");
    } finally {
      setLoading(false);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const todayWorkdays = workdays.filter((jornada) => jornada.fecha === today);
  const activeWorkdays = todayWorkdays.filter((jornada) => jornada.estado === "activa");
  const todayTasks = tasks.filter((task) => task.fechaAsignada === today || task.updatedAt?.slice(0, 10) === today);
  const todayPhotos = todayWorkdays.reduce((sum, jornada) =>
    sum + (jornada.fotosInicio?.length ?? 0) + (jornada.fotosAvance?.length ?? 0) + (jornada.fotosFin?.length ?? 0), 0)
    + tasks.reduce((sum, task) => sum + (task.updatedAt?.slice(0, 10) === today ? task.fotos?.length ?? 0 : 0), 0);

  const stats = [
    { label: "Cuadrillas activas hoy", value: activeWorkdays.length, icon: UsersRound },
    { label: "Jornadas iniciadas", value: todayWorkdays.length, icon: Clock3 },
    { label: "Pendientes de cierre", value: activeWorkdays.length, icon: MapPin },
    { label: "Obras con actividad", value: new Set(todayWorkdays.map((item) => item.obraId)).size, icon: ExternalLink },
    { label: "Fotos cargadas hoy", value: todayPhotos, icon: Camera },
    { label: "Tareas completadas hoy", value: todayTasks.filter((task) => task.estado === "completada").length, icon: CheckCircle2 }
  ];

  const workById = useMemo(() => new Map(works.map((obra) => [obra.id, obra])), [works]);

  if (loading) {
    return <StateCard text="Cargando instalaciones..." />;
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="min-w-0">
        <p className="text-sm font-black uppercase text-next-blue">Campo admin</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal">INSTALACIONES</h1>
        <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
          Seguimiento administrativo de cuadrillas, jornadas, ubicaciones, fotos y tareas ejecutadas en obra.
        </p>
      </div>

      {error ? <Notice text={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        {stats.map((item) => (
          <DataCard key={item.label} title={item.label}>
            <div className="flex items-center justify-between gap-3">
              <p className="text-3xl font-black text-next-text">{item.value}</p>
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-next-light text-next-blue">
                <item.icon className="h-5 w-5" aria-hidden="true" />
              </span>
            </div>
          </DataCard>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <DataCard title="Cuadrillas activas">
          <ContentList
            empty="No hay cuadrillas activas ahora."
            items={activeWorkdays.map((jornada) => `${jornada.equipoNombre || jornada.userName} - ${jornada.obraNombre} - Inicio ${jornada.horaInicio}`)}
          />
        </DataCard>
        <DataCard title="Jornadas pendientes de cierre">
          <ContentList
            empty="No hay jornadas pendientes de cierre."
            items={activeWorkdays.map((jornada) => `${jornada.equipoNombre || jornada.userName} - ${jornada.obraNombre} - sin cierre desde ${jornada.horaInicio}`)}
          />
        </DataCard>
        <DataCard title="Obras con actividad hoy">
          <ContentList
            empty="No hay obras con actividad hoy."
            items={getWorkActivity(todayWorkdays, tasks).map((item) => `${item.obraNombre} - ${item.completed} tareas completadas - ${item.photos} fotos`)}
          />
        </DataCard>
        <DataCard title="Tareas completadas hoy">
          <ContentList
            empty="No hay tareas completadas hoy."
            items={todayTasks.filter((task) => task.estado === "completada").slice(0, 5).map((task) => `${task.titulo} - ${task.obraNombre} - ${task.asignadoANombre || "Sin responsable"}`)}
          />
        </DataCard>
      </section>

      <DataCard title="Fotos cargadas hoy">
        <PhotoGrid photos={getTodayPhotos(todayWorkdays, todayTasks).slice(0, 12)} />
      </DataCard>

      <section className="grid gap-3">
        {todayWorkdays.length ? todayWorkdays.map((jornada) => {
          const jornadaTasks = tasks.filter((task) => jornada.tareasIds.includes(task.id) || task.jornadaId === jornada.id);
          const completed = jornadaTasks.filter((task) => task.estado === "completada").length;
          const photos = collectWorkdayPhotos(jornada, jornadaTasks);
          const obra = workById.get(jornada.obraId);
          return (
            <article key={jornada.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex min-w-0 flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge label={jornada.estado === "activa" ? "Jornada activa" : "Finalizada"} status={jornada.estado === "activa" ? "success" : "neutral"} />
                    <span className="text-xs font-black uppercase text-next-muted">{jornada.fecha ? formatDateShort(jornada.fecha) : "-"}</span>
                  </div>
                  <h2 className="mt-2 text-xl font-black text-next-text">{jornada.obraNombre}</h2>
                  <p className="mt-1 text-sm font-semibold text-next-muted">{obra?.direccion ?? obra?.ubicacion ?? "Sin direccion cargada"}</p>
                </div>
                <button className="h-10 rounded-md bg-next-blue px-4 text-xs font-black text-white" type="button" onClick={() => setSelected(jornada)}>
                  Ver detalle
                </button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-5">
                <Mini label="Equipo" value={jornada.equipoNombre ?? jornada.userName} />
                <Mini label="Inicio" value={jornada.horaInicio} />
                <Mini label="Ubicacion" value={jornada.ubicacionInicio ? "Registrada" : "Sin GPS"} />
                <Mini label="Tareas" value={`${completed}/${jornadaTasks.length}`} />
                <Mini label="Fotos" value={`${photos.length}`} />
              </div>
            </article>
          );
        }) : <EmptyState text="Todavia no hay jornadas cargadas hoy." />}
      </section>

      {selected ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
          <section className="mx-auto max-w-4xl rounded-lg bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase text-next-blue">Detalle de jornada</p>
                <h2 className="mt-1 text-2xl font-black text-next-text">{selected.obraNombre}</h2>
              </div>
              <button className="icon-button" type="button" onClick={() => setSelected(null)}>×</button>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <Mini label="Equipo / cuadrilla" value={selected.equipoNombre ?? selected.userName} />
              <Mini label="Hora inicio" value={selected.horaInicio} />
              <Mini label="Hora cierre" value={selected.horaFin ?? "Pendiente"} />
              <Mini label="Estado" value={selected.estado} />
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <DataCard title="Ubicaciones">
                <div className="space-y-2 text-sm font-semibold text-next-muted">
                  <LocationLink label="Inicio" location={selected.ubicacionInicio} />
                  <LocationLink label="Cierre" location={selected.ubicacionFin} />
                </div>
              </DataCard>
              <DataCard title="Tareas asociadas">
                <div className="space-y-2">
                  {tasks.filter((task) => selected.tareasIds.includes(task.id) || task.jornadaId === selected.id).map((task) => (
                    <div key={task.id} className="rounded-md bg-next-bg px-3 py-2">
                      <p className="text-sm font-black text-next-text">{task.titulo}</p>
                      <p className="text-xs font-semibold text-next-muted">{task.estado}</p>
                    </div>
                  ))}
                </div>
              </DataCard>
            </div>
            <DataCard title="Fotos de jornada" className="mt-4">
              <PhotoGrid photos={collectWorkdayPhotos(selected, tasks.filter((task) => selected.tareasIds.includes(task.id) || task.jornadaId === selected.id))} />
            </DataCard>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ContentList({ empty, items }: { empty: string; items: string[] }) {
  if (!items.length) return <EmptyState text={empty} />;
  return (
    <div className="space-y-2">
      {items.slice(0, 6).map((item) => (
        <p key={item} className="rounded-md bg-next-bg px-3 py-2 text-sm font-semibold text-next-text">{item}</p>
      ))}
    </div>
  );
}

function getWorkActivity(workdays: FieldWorkday[], tasks: FieldTask[]) {
  return workdays.map((jornada) => {
    const relatedTasks = tasks.filter((task) => jornada.tareasIds.includes(task.id) || task.jornadaId === jornada.id || task.obraId === jornada.obraId);
    const photos = collectWorkdayPhotos(jornada, relatedTasks);
    return {
      obraNombre: jornada.obraNombre,
      completed: relatedTasks.filter((task) => task.estado === "completada").length,
      photos: photos.length
    };
  });
}

function getTodayPhotos(workdays: FieldWorkday[], tasks: FieldTask[]) {
  return [
    ...workdays.flatMap((jornada) => collectWorkdayPhotos(jornada, tasks.filter((task) => jornada.tareasIds.includes(task.id) || task.jornadaId === jornada.id))),
    ...tasks.flatMap((task) => task.fotos ?? [])
  ].filter((photo, index, all) => all.findIndex((item) => item.id === photo.id) === index);
}

function collectWorkdayPhotos(jornada: FieldWorkday, tasks: FieldTask[]): TaskPhoto[] {
  return [
    ...(jornada.fotoLlegada ? [jornada.fotoLlegada] : []),
    ...(jornada.fotosInicio ?? []),
    ...tasks.flatMap((task) => task.fotos ?? []),
    ...(jornada.fotosAvance ?? []),
    ...(jornada.fotoCierre ? [jornada.fotoCierre] : []),
    ...(jornada.fotosFin ?? [])
  ].filter((photo, index, all) => all.findIndex((item) => item.id === photo.id) === index);
}

function LocationLink({ label, location }: { label: string; location?: FieldWorkday["ubicacionInicio"] }) {
  if (!location) {
    return <p>{label}: sin ubicacion registrada</p>;
  }
  return (
    <a className="inline-flex items-center gap-2 text-next-blue" href={`https://www.google.com/maps?q=${location.lat},${location.lng}`} target="_blank" rel="noreferrer">
      {label}: abrir en Google Maps
      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
    </a>
  );
}

function PhotoGrid({ photos }: { photos: TaskPhoto[] }) {
  if (!photos.length) return <EmptyState text="Todavia no hay fotos cargadas para esta jornada." />;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {photos.map((photo) => (
        <img key={photo.id} className="aspect-square rounded-md object-cover ring-1 ring-slate-200" src={photo.url} alt={photo.fileName ?? "Foto de jornada"} />
      ))}
    </div>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-next-bg px-3 py-2">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 truncate text-sm font-black text-next-text" title={value}>{value}</p>
    </div>
  );
}

function StateCard({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm font-bold text-next-muted shadow-soft">{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}

function Notice({ text }: { text: string }) {
  return <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-next-red">{text}</div>;
}
