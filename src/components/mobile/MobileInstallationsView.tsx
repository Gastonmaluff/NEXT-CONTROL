import { Camera, CheckCircle2, Clock3, MapPin, UploadCloud } from "lucide-react";
import { FormEvent, useEffect, useState } from "react";
import {
  createActividad,
  getActividadesByObra,
  getCuadrillas,
  getObras,
  getTareasByObra,
  updateCuadrilla,
  updateTareaInstalacion
} from "../../lib/firestore";
import type { Actividad, Cuadrilla, Obra, TareaInstalacion } from "../../types";
import { formatDateTime } from "../../utils/formatters";
import StatusBadge from "../ui/StatusBadge";

export default function MobileInstallationsView() {
  const [obra, setObra] = useState<Obra | null>(null);
  const [cuadrilla, setCuadrilla] = useState<Cuadrilla | null>(null);
  const [tareas, setTareas] = useState<TareaInstalacion[]>([]);
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [observacion, setObservacion] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [obras, cuadrillas] = await Promise.all([getObras(), getCuadrillas()]);
    const selectedCrew = cuadrillas[0] ?? null;
    const selectedObra = obras.find((item) => item.id === selectedCrew?.obraId) ?? obras[0] ?? null;
    setCuadrilla(selectedCrew);
    setObra(selectedObra);

    if (selectedObra) {
      setTareas(await getTareasByObra(selectedObra.id));
      setActividades(await getActividadesByObra(selectedObra.id));
    }

    setLoading(false);
  }

  async function registerActivity(description: string) {
    if (!obra) return;
    await createActividad({
      obraId: obra.id,
      tipo: "instalacion",
      descripcion: description,
      usuario: cuadrilla?.nombre ?? "Cuadrilla",
      fecha: new Date().toISOString()
    });
    setActividades(await getActividadesByObra(obra.id));
  }

  async function handleStartDay() {
    if (!cuadrilla) return;
    const time = new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
    const updated = await updateCuadrilla(cuadrilla.id, {
      horaInicio: time,
      horaFin: "",
      estado: "En obra"
    });
    setCuadrilla(updated);
    setMessage("Jornada iniciada.");
    await registerActivity("Cuadrilla inicio jornada.");
  }

  async function handleFinishDay() {
    if (!cuadrilla) return;
    const time = new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
    const updated = await updateCuadrilla(cuadrilla.id, {
      horaFin: time,
      estado: "Jornada finalizada"
    });
    setCuadrilla(updated);
    setMessage("Jornada finalizada.");
    await registerActivity("Cuadrilla finalizo jornada.");
  }

  async function handleCompleteTask(task: TareaInstalacion) {
    const updated = await updateTareaInstalacion(task.id, {
      estado: task.estado === "Completada" ? "Pendiente" : "Completada",
      completedAt: task.estado === "Completada" ? "" : new Date().toISOString()
    });
    setTareas((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    await registerActivity(`${updated.titulo} ${updated.estado === "Completada" ? "completada" : "reabierta"}.`);
  }

  async function handleObservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!observacion.trim()) return;
    await registerActivity(observacion);
    setObservacion("");
    setMessage("Observacion registrada.");
  }

  async function handlePhotoPlaceholder() {
    setMessage("Fotos preparadas para subir cuando Firebase Storage este conectado.");
    await registerActivity("Se simulo la carga de fotos de avance.");
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-next-navy px-4 text-white">
        Cargando instalacion...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-next-navy px-4 py-6 text-next-text">
      <div className="mx-auto max-w-[430px] overflow-hidden rounded-[28px] bg-next-bg shadow-2xl">
        <header className="bg-next-navy px-5 pb-7 pt-6 text-white">
          <p className="text-sm font-black tracking-wide">NEXT GLASS</p>
          <h1 className="mt-5 text-3xl font-black tracking-normal">NEXT CONTROL</h1>
          <p className="mt-1 text-sm font-semibold text-white/72">
            {cuadrilla?.nombre ?? "Cuadrilla"} en obra
          </p>
        </header>

        <div className="-mt-4 space-y-4 px-4 pb-5">
          {message ? (
            <div className="rounded-lg border border-green-100 bg-green-50 px-4 py-3 text-sm font-semibold text-next-green">
              {message}
            </div>
          ) : null}

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-next-muted">Obra</p>
                <h2 className="mt-1 text-xl font-black">{obra?.nombre ?? "Sin obra"}</h2>
              </div>
              <StatusBadge label={obra?.estado ?? "Demo"} status="info" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-next-muted">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <span>{obra?.ubicacion || "Ubicacion pendiente"}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs font-bold text-next-muted">
              <span>Inicio: {cuadrilla?.horaInicio || "--:--"}</span>
              <span>Fin: {cuadrilla?.horaFin || "--:--"}</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="h-11 rounded-md bg-next-blue px-3 text-sm font-black text-white shadow-sm"
                type="button"
                onClick={handleStartDay}
              >
                Inicie jornada
              </button>
              <button
                className="h-11 rounded-md border border-next-blue bg-white px-3 text-sm font-black text-next-blue"
                type="button"
                onClick={handleFinishDay}
              >
                Finalizar jornada
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-base font-black">Tareas de hoy</h2>
            <ul className="mt-4 space-y-3">
              {tareas.map((task) => (
                <li key={task.id}>
                  <button
                    className="flex w-full gap-3 text-left text-sm font-semibold"
                    type="button"
                    onClick={() => handleCompleteTask(task)}
                  >
                    <CheckCircle2
                      className={`mt-0.5 h-5 w-5 shrink-0 ${
                        task.estado === "Completada" ? "text-next-green" : "text-next-blue"
                      }`}
                      aria-hidden="true"
                    />
                    <span className={task.estado === "Completada" ? "line-through text-next-muted" : ""}>
                      {task.titulo}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-black">Fotos de avance</h2>
              <Camera className="h-5 w-5 text-next-blue" aria-hidden="true" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="aspect-square rounded-md bg-gradient-to-br from-next-light via-white to-slate-200 ring-1 ring-slate-200"
                />
              ))}
            </div>
            <button
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white"
              type="button"
              onClick={handlePhotoPlaceholder}
            >
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
              Subir fotos
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-base font-black">Observacion</h2>
            <form className="mt-3 space-y-3" onSubmit={handleObservation}>
              <textarea
                className="min-h-24 w-full rounded-md border border-slate-200 bg-next-bg px-3 py-2 text-sm font-semibold outline-none focus:border-next-blue focus:bg-white"
                value={observacion}
                onChange={(event) => setObservacion(event.target.value)}
                placeholder="Agregar observacion de obra"
              />
              <button className="h-10 w-full rounded-md bg-next-blue px-3 text-sm font-black text-white" type="submit">
                Guardar observacion
              </button>
            </form>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-base font-black">Linea de tiempo</h2>
            <ol className="mt-4 space-y-4">
              {actividades.slice(0, 6).map((item) => (
                <li key={item.id} className="flex gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-next-blue" />
                  <div>
                    <p className="text-xs font-black text-next-blue">{formatDateTime(item.fecha)}</p>
                    <p className="text-sm font-semibold text-next-text">{item.descripcion}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
