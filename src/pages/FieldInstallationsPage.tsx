import { Camera, CheckCircle2, Clock3, Flag, MapPin, Play, Square, UploadCloud } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import FieldPhotoUploader from "../components/field/FieldPhotoUploader";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  appendTaskPhotos,
  createFieldWorkday,
  getFieldTasks,
  getFieldWorkdays,
  updateFieldTask,
  updateFieldWorkday
} from "../lib/firestore";
import { canStartWorkDay, canUploadTaskPhotos } from "../lib/roles";
import {
  buildTaskPhotoPath,
  buildWorkdayPhotoPath,
  uploadFile
} from "../lib/storageUpload";
import { firebaseStorage, isFirebaseConfigured } from "../lib/firebase";
import type { FieldLocation, FieldTask, FieldTaskStatus, FieldWorkday, TaskPhoto } from "../types";
import { formatDateShort } from "../utils/formatters";
import { formatUnitLabel } from "../utils/units";

const statusLabels: Record<FieldTaskStatus, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  en_proceso: "En proceso",
  reportada: "Reportada",
  completada: "Completada",
  observada: "Observada",
  cancelada: "Cancelada"
};

export default function FieldInstallationsPage() {
  const { profile } = useAuth();
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [workdays, setWorkdays] = useState<FieldWorkday[]>([]);
  const [selectedTask, setSelectedTask] = useState<FieldTask | null>(null);
  const [startFiles, setStartFiles] = useState<File[]>([]);
  const [taskFiles, setTaskFiles] = useState<File[]>([]);
  const [finishFiles, setFinishFiles] = useState<File[]>([]);
  const [reportDraft, setReportDraft] = useState({ cantidad: "", observacion: "" });
  const [message, setMessage] = useState("");
  const [warning, setWarning] = useState("");
  const [error, setError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pendingLocationAction, setPendingLocationAction] = useState<"start" | "finish" | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [loadedTasks, loadedWorkdays] = await Promise.all([getFieldTasks(), getFieldWorkdays()]);
      setTasks(loadedTasks);
      setWorkdays(loadedWorkdays);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar instalaciones.");
    } finally {
      setLoading(false);
    }
  }

  const visibleTasks = useMemo(() => {
    if (!profile) return tasks;
    if (["admin", "gerencia"].includes(profile.role)) return tasks;

    const assignedWorks = profile.assignedWorkIds ?? [];
    const assignedTeams = profile.assignedTeamIds ?? [];
    const teamNames = [profile.nombre, profile.teamName].filter(Boolean).map((value) => value!.toLowerCase());

    return tasks.filter((task) =>
      task.asignadoAId === profile.uid ||
      (task.asignadoAId && assignedTeams.includes(task.asignadoAId)) ||
      (task.asignadoANombre && teamNames.some((name) => task.asignadoANombre!.toLowerCase().includes(name))) ||
      assignedWorks.includes(task.obraId) ||
      task.fiscalizadorId === profile.uid
    );
  }, [profile, tasks]);

  const today = new Date().toISOString().slice(0, 10);
  const todaysTasks = visibleTasks.filter((task) => !task.fechaAsignada || task.fechaAsignada <= today);
  const activeWorkday = workdays.find((jornada) =>
    jornada.estado === "activa" &&
    (jornada.userId === profile?.uid || jornada.equipoNombre === profile?.teamName || jornada.equipoNombre === profile?.nombre)
  );
  const progress = visibleTasks.length
    ? Math.round((visibleTasks.filter((task) => task.estado === "completada").length / visibleTasks.length) * 100)
    : 0;

  async function requestLocation(): Promise<FieldLocation | null> {
    if (!navigator.geolocation) return null;
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy
        }),
        reject,
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  async function startWorkday(task: FieldTask, location?: FieldLocation | null, forcedWithoutLocation = false) {
    if (!profile || !canStartWorkDay(profile)) {
      setError("No tenes permisos para iniciar jornada.");
      return;
    }
    setSaving(true);
    setError("");
    setWarning("");
    try {
      const now = new Date();
      const jornada = await createFieldWorkday({
        obraId: task.obraId,
        obraNombre: task.obraNombre,
        equipoId: profile.teamName ?? profile.uid,
        equipoNombre: profile.teamName ?? profile.nombre,
        userId: profile.uid,
        userName: profile.nombre,
        fecha: now.toISOString().slice(0, 10),
        horaInicio: now.toTimeString().slice(0, 5),
        ubicacionInicio: location ?? undefined,
        ubicacionInicioDisponible: Boolean(location) || !forcedWithoutLocation,
        estado: "activa",
        tareasIds: [task.id],
        observacionInicio: forcedWithoutLocation ? "Jornada iniciada sin ubicacion por confirmacion del usuario." : undefined
      });

      const fotosInicio = await uploadWorkdayPhotos(jornada, "inicio", startFiles);
      if (fotosInicio.length) {
        await updateFieldWorkday(jornada.id, { fotosInicio });
      }
      await updateFieldTask(task.id, { estado: task.estado === "pendiente" ? "en_proceso" : task.estado, jornadaId: jornada.id });
      setStartFiles([]);
      setMessage(location ? "Jornada iniciada con ubicacion registrada." : "Jornada iniciada sin ubicacion.");
      setPendingLocationAction(null);
      await load();
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "No se pudo iniciar la jornada.");
    } finally {
      setSaving(false);
    }
  }

  async function handleStart(task: FieldTask) {
    setSelectedTask(task);
    setPendingLocationAction(null);
    setWarning("");
    setError("");
    try {
      setSaving(true);
      setMessage("Registrando ubicacion...");
      const location = await requestLocation();
      await startWorkday(task, location);
    } catch (locationError) {
      console.error("No se pudo obtener ubicacion.", locationError);
      setMessage("");
      setWarning("No se pudo registrar la ubicacion. Podes iniciar sin ubicacion si corresponde.");
      setPendingLocationAction("start");
    } finally {
      setSaving(false);
    }
  }

  async function finishWorkday(location?: FieldLocation | null, forcedWithoutLocation = false) {
    if (!activeWorkday) return;
    setSaving(true);
    setError("");
    setWarning("");
    try {
      const fotosFin = await uploadWorkdayPhotos(activeWorkday, "fin", finishFiles);
      await updateFieldWorkday(activeWorkday.id, {
        estado: "finalizada",
        horaFin: new Date().toTimeString().slice(0, 5),
        ubicacionFin: location ?? undefined,
        ubicacionFinDisponible: Boolean(location) || !forcedWithoutLocation,
        fotosFin: fotosFin.length ? fotosFin : activeWorkday.fotosFin,
        observacionFin: forcedWithoutLocation ? "Jornada finalizada sin ubicacion por confirmacion del usuario." : undefined
      });
      setFinishFiles([]);
      setMessage(location ? "Jornada finalizada con ubicacion registrada." : "Jornada finalizada sin ubicacion.");
      setPendingLocationAction(null);
      await load();
    } catch (finishError) {
      setError(finishError instanceof Error ? finishError.message : "No se pudo finalizar la jornada.");
    } finally {
      setSaving(false);
    }
  }

  async function handleFinish() {
    try {
      setSaving(true);
      setMessage("Registrando ubicacion...");
      const location = await requestLocation();
      await finishWorkday(location);
    } catch (locationError) {
      console.error("No se pudo obtener ubicacion final.", locationError);
      setMessage("");
      setWarning("No se pudo registrar la ubicacion final. Podes finalizar sin ubicacion si corresponde.");
      setPendingLocationAction("finish");
    } finally {
      setSaving(false);
    }
  }

  async function uploadWorkdayPhotos(jornada: FieldWorkday, phase: "inicio" | "fin", files: File[]): Promise<TaskPhoto[]> {
    if (!files.length) return [];
    if (!isFirebaseConfigured() || !firebaseStorage) {
      setWarning("Firebase Storage no esta disponible. La jornada se guardo sin fotos.");
      return [];
    }
    try {
      setUploadStatus("Subiendo fotos...");
      const photos = await Promise.all(files.map(async (file) => {
        const storagePath = buildWorkdayPhotoPath(jornada.obraId, jornada.id, phase, file);
        const url = await uploadFile(storagePath, file);
        return buildPhoto(url, storagePath, file.name, jornada.obraId, { jornadaId: jornada.id, phase });
      }));
      return photos;
    } catch (uploadError) {
      console.error("No se pudieron subir fotos de jornada.", uploadError);
      setWarning("La jornada se guardo, pero algunas fotos no pudieron subirse.");
      return [];
    } finally {
      setUploadStatus("");
    }
  }

  async function uploadTaskPhotos(task: FieldTask, files: File[]): Promise<TaskPhoto[]> {
    if (!files.length) return [];
    if (!isFirebaseConfigured() || !firebaseStorage) {
      setWarning("Firebase Storage no esta disponible. La tarea se guardo sin fotos.");
      return [];
    }
    try {
      setUploadStatus("Subiendo fotos...");
      return Promise.all(files.map(async (file) => {
        const storagePath = buildTaskPhotoPath(task.obraId, task.id, file);
        const url = await uploadFile(storagePath, file);
        return buildPhoto(url, storagePath, file.name, task.obraId, { taskId: task.id, phase: "avance" });
      }));
    } catch (uploadError) {
      console.error("No se pudieron subir fotos de tarea.", uploadError);
      setWarning("La tarea se actualizo, pero algunas fotos no pudieron subirse.");
      return [];
    } finally {
      setUploadStatus("");
    }
  }

  async function handleTaskStatus(task: FieldTask, estado: FieldTaskStatus) {
    try {
      await updateFieldTask(task.id, { estado });
      setMessage(`Tarea marcada como ${statusLabels[estado].toLowerCase()}.`);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo actualizar la tarea.");
    }
  }

  async function reportTask(task: FieldTask) {
    setSaving(true);
    setError("");
    setWarning("");
    try {
      const photos = await uploadTaskPhotos(task, taskFiles);
      await updateFieldTask(task.id, {
        estado: task.requiereValidacion ? "reportada" : "completada",
        cantidadReportada: reportDraft.cantidad ? Number(reportDraft.cantidad) : task.cantidadReportada,
        observacionCampo: reportDraft.observacion || task.observacionCampo,
        fotos: appendTaskPhotos(task, photos),
        jornadaId: activeWorkday?.id ?? task.jornadaId
      });
      setTaskFiles([]);
      setReportDraft({ cantidad: "", observacion: "" });
      setSelectedTask(null);
      setMessage(task.requiereValidacion ? "Tarea reportada para validacion." : "Tarea marcada como completada.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo reportar la tarea.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <main className="min-h-screen bg-next-bg px-4 py-6 text-sm font-bold text-next-muted">Cargando campo...</main>;
  }

  return (
    <main className="min-h-screen bg-next-bg px-4 py-5 text-next-text">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-lg bg-next-navy px-5 py-5 text-white shadow-soft">
          <p className="text-xs font-black uppercase text-white/65">NEXT CONTROL CAMPO</p>
          <h1 className="mt-2 text-2xl font-black">Hola, {profile?.teamName ?? profile?.nombre ?? "Equipo"}</h1>
          <p className="mt-2 text-sm font-semibold text-white/70">
            Tu ubicacion se registra al iniciar y finalizar jornada para confirmar presencia en obra.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-white/10 px-3 py-3">
              <p className="text-xs font-bold uppercase text-white/60">Rol</p>
              <p className="mt-1 font-black capitalize">{profile?.role ?? "sin rol"}</p>
            </div>
            <div className="rounded-md bg-white/10 px-3 py-3">
              <p className="text-xs font-bold uppercase text-white/60">Tareas visibles</p>
              <p className="mt-1 font-black">{visibleTasks.length}</p>
            </div>
          </div>
          <div className="mt-4">
            <div className="mb-2 flex justify-between text-xs font-black uppercase text-white/70">
              <span>Avance tareas</span>
              <span>{progress}%</span>
            </div>
            <ProgressBar value={progress} />
          </div>
        </header>

        {message ? <Notice tone="success" text={message} /> : null}
        {warning ? <Notice tone="warning" text={warning} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}

        {pendingLocationAction === "start" && selectedTask ? (
          <button className="h-11 w-full rounded-md border border-next-orange bg-orange-50 px-4 text-sm font-black text-next-orange" type="button" disabled={saving} onClick={() => void startWorkday(selectedTask, null, true)}>
            Iniciar sin ubicacion
          </button>
        ) : null}
        {pendingLocationAction === "finish" ? (
          <button className="h-11 w-full rounded-md border border-next-orange bg-orange-50 px-4 text-sm font-black text-next-orange" type="button" disabled={saving} onClick={() => void finishWorkday(null, true)}>
            Finalizar sin ubicacion
          </button>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-next-blue">Jornada activa</p>
              <h2 className="mt-1 text-lg font-black text-next-text">
                {activeWorkday ? activeWorkday.obraNombre : "Sin jornada activa"}
              </h2>
              {activeWorkday ? <p className="mt-1 text-sm font-semibold text-next-muted">Inicio {activeWorkday.horaInicio}</p> : null}
            </div>
            {activeWorkday ? <StatusBadge label="Activa" status="success" /> : <StatusBadge label="Pendiente" status="neutral" />}
          </div>
          {activeWorkday ? (
            <div className="mt-4 space-y-3">
              <FieldPhotoUploader files={finishFiles} label="Subir foto de cierre" multiple onFilesChange={setFinishFiles} status={uploadStatus} />
              <button className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-next-red px-4 text-sm font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={() => void handleFinish()}>
                <Square className="h-4 w-4" aria-hidden="true" />
                Finalizar jornada
              </button>
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          {todaysTasks.length ? todaysTasks.map((task) => (
            <TaskCard
              key={task.id}
              activeWorkday={activeWorkday}
              canUpload={canUploadTaskPhotos(profile)}
              files={selectedTask?.id === task.id ? taskFiles : []}
              onFilesChange={(files) => { setSelectedTask(task); setTaskFiles(files); }}
              onProcess={() => void handleTaskStatus(task, "en_proceso")}
              onReport={() => { setSelectedTask(task); setReportDraft({ cantidad: task.cantidadReportada ? String(task.cantidadReportada) : "", observacion: task.observacionCampo ?? "" }); }}
              onStart={() => void handleStart(task)}
              saving={saving}
              task={task}
            />
          )) : <EmptyState text="No hay tareas asignadas para hoy." />}
        </section>
      </div>

      {selectedTask && !pendingLocationAction ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
          <section className="mx-auto max-w-lg rounded-lg bg-white p-4 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs font-black uppercase text-next-blue">Reportar tarea</p>
              <h2 className="mt-1 text-xl font-black text-next-text">{selectedTask.titulo}</h2>
              <p className="mt-1 text-sm font-semibold text-next-muted">{selectedTask.obraNombre}</p>
            </div>
            <div className="space-y-3">
              {selectedTask.cantidadPrevista ? (
                <label>
                  <span className="text-xs font-black uppercase text-next-muted">Cantidad ejecutada</span>
                  <input className="field mt-1" min={0} type="number" value={reportDraft.cantidad} onChange={(event) => setReportDraft({ ...reportDraft, cantidad: event.target.value })} />
                </label>
              ) : null}
              <label>
                <span className="text-xs font-black uppercase text-next-muted">Observacion</span>
                <textarea className="field mt-1 min-h-24" value={reportDraft.observacion} onChange={(event) => setReportDraft({ ...reportDraft, observacion: event.target.value })} />
              </label>
              <FieldPhotoUploader files={taskFiles} label="Subir fotos de avance" multiple onFilesChange={setTaskFiles} status={uploadStatus} warning={warning} />
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="h-11 rounded-md border border-slate-200 px-4 text-sm font-black text-next-muted" type="button" onClick={() => { setSelectedTask(null); setTaskFiles([]); }}>
                  Cancelar
                </button>
                <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={() => void reportTask(selectedTask)}>
                  {saving ? "Guardando..." : "Reportar tarea"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function TaskCard({
  activeWorkday,
  canUpload,
  files,
  onFilesChange,
  onProcess,
  onReport,
  onStart,
  saving,
  task
}: {
  activeWorkday?: FieldWorkday;
  canUpload: boolean;
  files: File[];
  onFilesChange: (files: File[]) => void;
  onProcess: () => void;
  onReport: () => void;
  onStart: () => void;
  saving: boolean;
  task: FieldTask;
}) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-black leading-tight text-next-text">{task.titulo}</h2>
          <p className="mt-1 text-sm font-semibold text-next-muted">{task.obraNombre}</p>
        </div>
        <StatusBadge label={statusLabels[task.estado]} status={badgeForTask(task.estado)} />
      </div>
      <div className="mt-4 grid gap-2 text-sm font-semibold text-next-muted">
        <Line icon={Clock3} label="Fecha" value={task.fechaAsignada ? formatDateShort(task.fechaAsignada) : "Sin fecha"} />
        <Line icon={Flag} label="Rubro" value={task.rubroNombre || "Sin rubro"} />
        <Line icon={Camera} label="Fotos" value={`${task.fotos?.length ?? 0}`} />
        {task.cantidadPrevista ? (
          <Line icon={CheckCircle2} label="Cantidad" value={`${task.cantidadPrevista} ${formatUnitLabel(task.unidad, task.cantidadPrevista)}`} />
        ) : null}
      </div>
      {task.requiereFotos && canUpload ? (
        <div className="mt-4">
          <FieldPhotoUploader files={files} label="Preparar fotos" multiple onFilesChange={onFilesChange} />
        </div>
      ) : null}
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        {!activeWorkday ? (
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60 sm:col-span-3" type="button" disabled={saving} onClick={onStart}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Iniciar jornada
          </button>
        ) : null}
        <button className="h-10 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue disabled:opacity-50" type="button" disabled={saving || task.estado === "en_proceso"} onClick={onProcess}>
          En proceso
        </button>
        <button className="h-10 rounded-md bg-next-blue px-3 text-xs font-black text-white disabled:opacity-50 sm:col-span-2" type="button" disabled={saving || task.estado === "reportada" || task.estado === "completada"} onClick={onReport}>
          Reportar tarea
        </button>
      </div>
    </article>
  );
}

function buildPhoto(
  url: string,
  storagePath: string,
  fileName: string,
  obraId: string,
  refs: { taskId?: string; jornadaId?: string; phase?: TaskPhoto["phase"] }
): TaskPhoto {
  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    storagePath,
    fileName,
    uploadedBy: "campo",
    uploadedAt: new Date().toISOString(),
    obraId,
    ...refs
  };
}

function badgeForTask(status: FieldTaskStatus) {
  if (status === "completada") return "success";
  if (status === "observada" || status === "cancelada") return "critical";
  if (status === "reportada") return "warning";
  return "info";
}

function Line({ icon: Icon, label, value }: { icon: typeof Clock3; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-next-blue" aria-hidden="true" />
      <span className="font-black text-next-text">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "warning" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : tone === "warning"
      ? "border-orange-100 bg-orange-50 text-next-orange"
      : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}
