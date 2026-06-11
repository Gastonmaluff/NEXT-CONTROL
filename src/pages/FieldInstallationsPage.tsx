import {
  Bell,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Clock3,
  Flag,
  ImageIcon,
  MapPin,
  MessageSquareText,
  Play,
  Square,
  type LucideIcon
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import BrandLogo from "../components/brand/BrandLogo";
import FieldPhotoUploader from "../components/field/FieldPhotoUploader";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  appendTaskPhotos,
  getFieldAssignments,
  createFieldWorkday,
  getFieldTasks,
  getFieldWorkdays,
  getObras,
  getProgressRubricsByWork,
  registerInstallationForItem,
  updateFieldTask,
  updateFieldWorkday
} from "../lib/firestore";
import { canStartWorkDay, canUploadTaskPhotos } from "../lib/roles";
import { firebaseStorage, isFirebaseConfigured } from "../lib/firebase";
import {
  buildTaskPhotoPath,
  buildWorkdayPhotoPath,
  uploadFile
} from "../lib/storageUpload";
import type { FieldAssignment, FieldLocation, FieldTask, FieldTaskStatus, FieldWorkday, Obra, TaskPhoto, UserRole, WorkProgressRubric } from "../types";
import { formatDateShort } from "../utils/formatters";
import { formatUnitLabel } from "../utils/units";
import { getProductionRows, type ProductionWorkRow } from "../utils/workBreakdown";

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
  const [assignments, setAssignments] = useState<FieldAssignment[]>([]);
  const [workdays, setWorkdays] = useState<FieldWorkday[]>([]);
  const [works, setWorks] = useState<Obra[]>([]);
  const [rubrics, setRubrics] = useState<WorkProgressRubric[]>([]);
  const [selectedTask, setSelectedTask] = useState<FieldTask | null>(null);
  const [selectedInstallItem, setSelectedInstallItem] = useState<ProductionWorkRow | null>(null);
  const [startFiles, setStartFiles] = useState<File[]>([]);
  const [taskFiles, setTaskFiles] = useState<File[]>([]);
  const [finishFiles, setFinishFiles] = useState<File[]>([]);
  const [reportDraft, setReportDraft] = useState({ cantidad: "", observacion: "" });
  const [installDraft, setInstallDraft] = useState({ cantidad: "", observacion: "" });
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
      const [loadedTasks, loadedWorkdays, loadedWorks, loadedAssignments] = await Promise.all([
        getFieldTasks(),
        getFieldWorkdays(),
        getObras().catch((workError) => {
          console.error("No se pudieron cargar obras para /campo.", workError);
          return [] as Obra[];
        }),
        getFieldAssignments().catch(() => [] as FieldAssignment[])
      ]);
      setTasks(loadedTasks);
      setAssignments(loadedAssignments);
      setWorkdays(loadedWorkdays);
      setWorks(loadedWorks);
      const visibleWorkIds = new Set(loadedTasks.map((task) => task.obraId));
      loadedAssignments.forEach((assignment) => visibleWorkIds.add(assignment.obraId));
      if (loadedWorkdays.length) {
        loadedWorkdays.forEach((jornada) => visibleWorkIds.add(jornada.obraId));
      }
      const loadedRubrics = (await Promise.all(Array.from(visibleWorkIds).map((obraId) => getProgressRubricsByWork(obraId).catch(() => [])))).flat();
      setRubrics(loadedRubrics);
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
  const visibleAssignments = useMemo(() => {
    if (!profile) return assignments;
    if (["admin", "gerencia"].includes(profile.role)) return assignments;
    const assignedWorks = profile.assignedWorkIds ?? [];
    const name = (profile.teamName ?? profile.nombre).toLowerCase();
    return assignments.filter((assignment) =>
      assignedWorks.includes(assignment.obraId) ||
      assignment.usuarioResponsableId === profile.uid ||
      assignment.nombreEquipo.toLowerCase().includes(name) ||
      assignment.usuarioResponsableNombre?.toLowerCase().includes(name)
    );
  }, [assignments, profile]);

  const today = new Date().toISOString().slice(0, 10);
  const todaysTasks = visibleTasks.filter((task) => !task.fechaAsignada || task.fechaAsignada <= today);
  const todayAssignment = visibleAssignments.find((assignment) => assignment.fecha <= today && assignment.estado !== "finalizada" && assignment.estado !== "cancelada");
  const activeWorkday = workdays.find((jornada) =>
    jornada.estado === "activa" &&
    (jornada.userId === profile?.uid || jornada.equipoNombre === profile?.teamName || jornada.equipoNombre === profile?.nombre)
  );
  const activeTask = activeWorkday
    ? visibleTasks.find((task) => activeWorkday.tareasIds.includes(task.id)) ?? visibleTasks.find((task) => task.obraId === activeWorkday.obraId)
    : todaysTasks.find((task) => !["completada", "cancelada"].includes(task.estado)) ?? todaysTasks[0];
  const activeWork = works.find((work) => work.id === (activeWorkday?.obraId ?? activeTask?.obraId ?? todayAssignment?.obraId));
  const completedToday = todaysTasks.filter((task) => task.estado === "completada").length;
  const progress = todaysTasks.length ? Math.round((completedToday / todaysTasks.length) * 100) : 0;
  const allPhotos = [
    ...(activeWorkday?.fotosInicio ?? []),
    ...visibleTasks.flatMap((task) => task.fotos ?? []),
    ...(activeWorkday?.fotosAvance ?? []),
    ...(activeWorkday?.fotosFin ?? [])
  ].slice(0, 8);
  const lastObservation = [...visibleTasks]
    .reverse()
    .find((task) => task.observacionCampo || task.observacionFiscalizador);
  const timelineItems = buildTimeline(activeWorkday, visibleTasks);
  const installRows = useMemo(() => {
    if (!activeWork) return [];
    return getProductionRows([activeWork], rubrics.filter((rubro) => rubro.obraId === activeWork.id))
      .filter((row) => row.disponibleParaInstalar > 0 || row.pendienteDeInstalar > 0);
  }, [activeWork, rubrics]);

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
    if (!startFiles.length) {
      setWarning("Para iniciar jornada, primero subi la foto de llegada.");
      return;
    }
    if (!isFirebaseConfigured() || !firebaseStorage) {
      setError("No se pudo subir la foto de llegada. Firebase Storage no esta disponible.");
      return;
    }
    setSaving(true);
    setError("");
    setWarning("");
    try {
      const now = new Date();
      const jornadaId = `jornada-${task.obraId}-${Date.now()}`;
      setUploadStatus("Subiendo foto de llegada...");
      const storagePath = buildWorkdayPhotoPath(task.obraId, jornadaId, "inicio", startFiles[0]);
      const photoUrl = await uploadFile(storagePath, startFiles[0]);
      const fotoLlegada = buildPhoto(photoUrl, storagePath, startFiles[0].name, task.obraId, { jornadaId, phase: "inicio" }, profile.uid);

      const jornada = await createFieldWorkday({
        id: jornadaId,
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
        fotoLlegada,
        fotosInicio: [fotoLlegada],
        observacionInicio: forcedWithoutLocation ? "Jornada iniciada sin ubicacion por confirmacion del usuario." : undefined
      });

      await updateFieldTask(task.id, { estado: task.estado === "pendiente" ? "en_proceso" : task.estado, jornadaId: jornada.id });
      setStartFiles([]);
      setMessage(location ? "Jornada iniciada correctamente con foto y ubicacion." : "Jornada iniciada correctamente con foto.");
      setPendingLocationAction(null);
      setSelectedTask(null);
      await load();
    } catch (startError) {
      console.error("No se pudo iniciar jornada con foto de llegada.", startError);
      setError("No se pudo subir la foto de llegada. Intenta nuevamente.");
    } finally {
      setUploadStatus("");
      setSaving(false);
    }
  }

  async function handleStart(task: FieldTask) {
    if (!startFiles.length) {
      setWarning("Para iniciar jornada, primero subi la foto de llegada.");
      return;
    }
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
    if (!finishFiles.length) {
      setWarning("Para finalizar jornada, primero subi la foto de cierre.");
      return;
    }
    if (!isFirebaseConfigured() || !firebaseStorage) {
      setError("No se pudo subir la foto de cierre. Firebase Storage no esta disponible.");
      return;
    }
    setSaving(true);
    setError("");
    setWarning("");
    try {
      setUploadStatus("Subiendo foto de cierre...");
      const storagePath = buildWorkdayPhotoPath(activeWorkday.obraId, activeWorkday.id, "fin", finishFiles[0]);
      const photoUrl = await uploadFile(storagePath, finishFiles[0]);
      const fotoCierre = buildPhoto(photoUrl, storagePath, finishFiles[0].name, activeWorkday.obraId, { jornadaId: activeWorkday.id, phase: "fin" }, profile?.uid ?? "campo");
      await updateFieldWorkday(activeWorkday.id, {
        estado: "finalizada",
        horaFin: new Date().toTimeString().slice(0, 5),
        ubicacionFin: location ?? undefined,
        ubicacionFinDisponible: Boolean(location) || !forcedWithoutLocation,
        fotoCierre,
        fotosFin: [...(activeWorkday.fotosFin ?? []), fotoCierre],
        observacionFin: forcedWithoutLocation ? "Jornada finalizada sin ubicacion por confirmacion del usuario." : undefined
      });
      setFinishFiles([]);
      setMessage(location ? "Jornada finalizada correctamente con foto y ubicacion." : "Jornada finalizada correctamente con foto.");
      setPendingLocationAction(null);
      await load();
    } catch (finishError) {
      console.error("No se pudo finalizar jornada con foto de cierre.", finishError);
      setError("No se pudo subir la foto de cierre. Intenta nuevamente.");
    } finally {
      setUploadStatus("");
      setSaving(false);
    }
  }

  async function handleFinish() {
    if (!finishFiles.length) {
      setWarning("Para finalizar jornada, primero subi la foto de cierre.");
      return;
    }
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

  async function registerInstallation(row: ProductionWorkRow) {
    const quantity = Number(installDraft.cantidad || 0);
    if (!Number.isFinite(quantity) || quantity < 0) {
      setError("Carga una cantidad instalada acumulada valida.");
      return;
    }
    if (quantity > row.cantidadProducida) {
      setError("No se puede instalar mas cantidad que la producida disponible.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await registerInstallationForItem({
        rubroId: row.rubro.id,
        itemId: row.item?.id,
        cantidadNueva: quantity,
        observacion: installDraft.observacion.trim(),
        ubicacion: activeWorkday?.ubicacionInicio,
        origen: "campo"
      });
      setSelectedInstallItem(null);
      setInstallDraft({ cantidad: "", observacion: "" });
      setMessage("Instalacion registrada correctamente.");
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo registrar la instalacion.");
    } finally {
      setSaving(false);
    }
  }

  function openInstall(row: ProductionWorkRow) {
    setSelectedInstallItem(row);
    setInstallDraft({ cantidad: String(row.cantidadInstalada || ""), observacion: "" });
  }

  function openTaskReport(task: FieldTask) {
    setSelectedTask(task);
    setReportDraft({
      cantidad: task.cantidadReportada ? String(task.cantidadReportada) : "",
      observacion: task.observacionCampo ?? ""
    });
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-next-bg px-4 py-6 text-sm font-bold text-next-muted">
        Cargando campo...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-4 text-next-text">
      <div className="mx-auto max-w-xl space-y-4 pb-8 lg:max-w-3xl">
        <header className="flex items-center justify-between rounded-[1.35rem] border border-white/80 bg-white/90 px-4 py-3 shadow-[0_18px_44px_rgba(15,23,42,0.06)] backdrop-blur">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo variant="compact" className="shrink-0 rounded-2xl bg-next-navy p-1 shadow-sm" />
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight text-next-text">NEXT CONTROL</p>
              <p className="text-xs font-semibold text-next-muted">Cuadrilla en obra</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden min-w-0 text-right sm:block">
              <p className="truncate text-xs font-black text-next-text">{profile?.teamName ?? profile?.nombre ?? "Equipo"}</p>
              <p className="text-[10px] font-bold uppercase text-next-muted">{formatRole(profile?.role)}</p>
            </div>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-next-blue ring-1 ring-slate-200" type="button" title="Notificaciones">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {message ? <Notice tone="success" text={message} /> : null}
        {warning ? <Notice tone="warning" text={warning} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}

        {pendingLocationAction === "start" && selectedTask ? (
          <button className="h-11 w-full rounded-xl border border-next-orange bg-orange-50 px-4 text-sm font-black text-next-orange disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={saving || !startFiles.length} onClick={() => void startWorkday(selectedTask, null, true)}>
            Iniciar sin ubicacion
          </button>
        ) : null}
        {pendingLocationAction === "finish" ? (
          <button className="h-11 w-full rounded-xl border border-next-orange bg-orange-50 px-4 text-sm font-black text-next-orange disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={saving || !finishFiles.length} onClick={() => void finishWorkday(null, true)}>
            Finalizar sin ubicacion
          </button>
        ) : null}

        <section className="rounded-[1.65rem] border border-white/80 bg-white/95 p-3 shadow-[0_22px_55px_rgba(15,23,42,0.07)]">
          <div className="flex min-w-0 gap-3">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[1.25rem] border border-slate-100 bg-[#f7f9fc] p-2 shadow-inner">
              {activeWork?.renderUrl || activeWork?.imageUrl ? (
                <img className="max-h-full max-w-full object-contain" src={activeWork.renderUrl ?? activeWork.imageUrl} alt={activeWork.nombre} />
              ) : (
                <div className="flex h-full w-full items-center justify-center rounded-[1rem] bg-[linear-gradient(145deg,#eef5ff,#ffffff)]">
                  <BriefcaseBusiness className="h-10 w-10 text-next-blue/65" aria-hidden="true" />
                </div>
              )}
            </div>
            <div className="min-w-0 flex-1 py-1">
              <StatusBadge label={activeWorkday ? "Jornada activa" : activeTask ? "Lista para iniciar" : "Sin jornada"} status={activeWorkday ? "success" : activeTask ? "info" : "neutral"} />
              <h1 className="mt-3 text-2xl font-black leading-tight text-next-text">{activeWorkday?.obraNombre ?? activeTask?.obraNombre ?? "No hay jornada activa"}</h1>
              <p className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-next-muted">
                {activeWork?.direccion ?? activeWork?.ubicacion ?? "Selecciona una tarea para iniciar jornada"}
              </p>
              <p className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Obra asignada para hoy</p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-3 gap-2">
          <MiniMetric label="Inicio" value={activeWorkday?.horaInicio ?? "--:--"} />
          <MiniMetric label="Ubicacion" value={activeWorkday?.ubicacionInicio ? "Registrada" : activeWorkday ? "Sin GPS" : "Pendiente"} />
          <MiniMetric label="Rol" value={formatRole(profile?.role)} />
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-next-blue">Jornada</p>
              <h2 className="text-lg font-black text-next-text">{activeWorkday ? "Trabajo en curso" : "Comenzar trabajo"}</h2>
            </div>
            <MapPin className={`h-5 w-5 ${activeWorkday?.ubicacionInicio ? "text-next-green" : "text-next-muted"}`} aria-hidden="true" />
          </div>
          {!activeWorkday ? (
            <div className="space-y-3">
              <FieldPhotoUploader
                capture="environment"
                files={startFiles}
                helper="Subi una foto de llegada para iniciar la jornada."
                label="Foto de llegada"
                multiple={false}
                onFilesChange={setStartFiles}
                status={uploadStatus}
              />
              <button
                className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-next-blue px-4 text-sm font-black text-white shadow-soft disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none"
                type="button"
                disabled={saving || !activeTask || !startFiles.length}
                onClick={() => activeTask ? void handleStart(activeTask) : undefined}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                {saving ? "Iniciando jornada..." : "Iniciar jornada"}
              </button>
              {!startFiles.length ? <p className="text-center text-xs font-semibold text-next-orange">Subi una foto de llegada para iniciar la jornada.</p> : null}
              {!activeTask ? <p className="text-center text-xs font-semibold text-next-muted">No hay tareas disponibles para iniciar.</p> : null}
            </div>
          ) : (
            <div className="space-y-3">
              <FieldPhotoUploader
                capture="environment"
                files={finishFiles}
                helper="Subi una foto de cierre para finalizar la jornada."
                label="Foto de cierre"
                multiple={false}
                onFilesChange={setFinishFiles}
                status={uploadStatus}
              />
              <button className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-next-red px-4 text-sm font-black text-white shadow-soft disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none" type="button" disabled={saving || !finishFiles.length} onClick={() => void handleFinish()}>
                <Square className="h-4 w-4" aria-hidden="true" />
                {saving ? "Finalizando jornada..." : "Finalizar jornada"}
              </button>
              {!finishFiles.length ? <p className="text-center text-xs font-semibold text-next-orange">Subi una foto de cierre para finalizar la jornada.</p> : null}
            </div>
          )}
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-next-blue">Tareas de hoy</p>
              <h2 className="text-lg font-black text-next-text">{completedToday}/{todaysTasks.length} tareas</h2>
            </div>
            <span className="text-2xl font-black text-next-blue">{progress}%</span>
          </div>
          <ProgressBar value={progress} />
          <div className="mt-4 space-y-3">
            {todaysTasks.length ? todaysTasks.map((task) => (
              <TaskCard
                key={task.id}
                activeWorkday={activeWorkday}
                onProcess={() => void handleTaskStatus(task, "en_proceso")}
                onReport={() => openTaskReport(task)}
                onStart={() => void handleStart(task)}
                saving={saving}
                task={task}
              />
            )) : <EmptyState text="No hay tareas asignadas para hoy." />}
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-4">
            <p className="text-xs font-black uppercase text-next-blue">Disponible para instalar</p>
            <h2 className="text-lg font-black text-next-text">{activeWork ? activeWork.nombre : "Sin obra activa"}</h2>
          </div>
          <div className="space-y-3">
            {installRows.length ? installRows.map((row) => (
              <article key={row.id} className="rounded-2xl border border-slate-200 bg-next-bg p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase text-next-blue">{row.rubro.nombre}</p>
                    <h3 className="mt-1 text-base font-black text-next-text">{row.descripcion}</h3>
                    <p className="mt-1 text-xs font-semibold text-next-muted">{row.medida ? `Medida ${row.medida}` : "Carga simple"}</p>
                  </div>
                  <StatusBadge label={row.estadoInstalacion} status={row.estadoInstalacion === "completado" ? "success" : row.estadoInstalacion === "parcial" ? "warning" : "info"} />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <MiniMetric label="Producido" value={`${row.cantidadProducida}/${row.cantidadTotal}`} />
                  <MiniMetric label="Disponible" value={`${row.disponibleParaInstalar}`} />
                  <MiniMetric label="Instalado" value={`${row.cantidadInstalada}/${row.cantidadTotal}`} />
                  <MiniMetric label="Pendiente" value={`${row.pendienteDeInstalar}`} />
                </div>
                <button className="mt-3 h-10 w-full rounded-xl bg-next-blue px-4 text-xs font-black text-white disabled:bg-slate-300" type="button" disabled={!activeWorkday} onClick={() => openInstall(row)}>
                  Registrar instalacion
                </button>
              </article>
            )) : <EmptyState text={activeWork ? "No hay items disponibles para instalar en esta obra." : "Inicia una jornada para ver items disponibles."} />}
          </div>
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-next-blue">Fotos de avance</p>
              <h2 className="text-lg font-black text-next-text">{allPhotos.length} fotos</h2>
            </div>
            <ImageIcon className="h-5 w-5 text-next-blue" aria-hidden="true" />
          </div>
          {allPhotos.length ? (
            <div className="grid grid-cols-4 gap-2">
              {allPhotos.map((photo) => (
                <img key={photo.id} className="aspect-square rounded-xl object-cover ring-1 ring-slate-200" src={photo.url} alt={photo.fileName ?? "Foto de avance"} />
              ))}
            </div>
          ) : (
            <EmptyState text="Todavia no hay fotos cargadas." />
          )}
          {activeTask && canUploadTaskPhotos(profile) ? (
            <button className="mt-3 h-11 w-full rounded-xl border border-next-blue bg-next-light px-4 text-sm font-black text-next-blue" type="button" onClick={() => openTaskReport(activeTask)}>
              Subir fotos
            </button>
          ) : null}
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-next-blue">Observaciones</p>
              <h2 className="text-lg font-black text-next-text">Registro de campo</h2>
            </div>
            <MessageSquareText className="h-5 w-5 text-next-blue" aria-hidden="true" />
          </div>
          <div className="rounded-xl bg-next-bg p-3">
            <p className="text-sm font-semibold leading-6 text-next-muted">
              {lastObservation?.observacionCampo || lastObservation?.observacionFiscalizador || "Sin observaciones registradas hoy."}
            </p>
            {lastObservation ? <p className="mt-2 text-xs font-black uppercase text-next-blue">{lastObservation.titulo}</p> : null}
          </div>
          {activeTask ? (
            <button className="mt-3 h-11 w-full rounded-xl bg-next-navy px-4 text-sm font-black text-white" type="button" onClick={() => openTaskReport(activeTask)}>
              Agregar observacion
            </button>
          ) : null}
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
          <p className="text-xs font-black uppercase text-next-blue">Linea de tiempo</p>
          <h2 className="mt-1 text-lg font-black text-next-text">Actividad de hoy</h2>
          <div className="mt-4 space-y-3">
            {timelineItems.length ? timelineItems.map((item, index) => (
              <div key={`${item.time}-${item.text}-${index}`} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="h-2.5 w-2.5 rounded-full bg-next-blue" />
                  {index < timelineItems.length - 1 ? <span className="mt-1 h-full min-h-8 w-px bg-slate-200" /> : null}
                </div>
                <div className="min-w-0 pb-1">
                  <p className="text-xs font-black uppercase text-next-blue">{item.time} - Hoy</p>
                  <p className="text-sm font-semibold text-next-muted">{item.text}</p>
                </div>
              </div>
            )) : <EmptyState text="Todavia no hay actividad registrada hoy." />}
          </div>
        </section>
      </div>

      {selectedTask && !pendingLocationAction ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
          <section className="mx-auto max-w-lg rounded-[1.35rem] bg-white p-4 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs font-black uppercase text-next-blue">Reportar avance</p>
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
                <button className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-next-muted" type="button" onClick={() => { setSelectedTask(null); setTaskFiles([]); }}>
                  Cancelar
                </button>
                <button className="h-11 rounded-xl bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={() => void reportTask(selectedTask)}>
                  {saving ? "Guardando..." : "Reportar tarea"}
                </button>
              </div>
            </div>
          </section>
        </div>
      ) : null}

      {selectedInstallItem ? (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
          <section className="mx-auto max-w-lg rounded-[1.35rem] bg-white p-4 shadow-2xl">
            <div className="mb-4">
              <p className="text-xs font-black uppercase text-next-blue">Registrar instalacion</p>
              <h2 className="mt-1 text-xl font-black text-next-text">{selectedInstallItem.descripcion}</h2>
              <p className="mt-1 text-sm font-semibold text-next-muted">
                Disponible: {selectedInstallItem.disponibleParaInstalar} {formatUnitLabel(selectedInstallItem.unidad, selectedInstallItem.disponibleParaInstalar)}
              </p>
            </div>
            <div className="space-y-3">
              <label>
                <span className="text-xs font-black uppercase text-next-muted">Cantidad instalada acumulada</span>
                <input className="field mt-1" min={0} max={selectedInstallItem.cantidadProducida} step="0.01" type="number" value={installDraft.cantidad} onChange={(event) => setInstallDraft({ ...installDraft, cantidad: event.target.value })} />
              </label>
              <label>
                <span className="text-xs font-black uppercase text-next-muted">Observacion</span>
                <textarea className="field mt-1 min-h-24" value={installDraft.observacion} onChange={(event) => setInstallDraft({ ...installDraft, observacion: event.target.value })} />
              </label>
              <div className="grid gap-2 sm:grid-cols-2">
                <button className="h-11 rounded-xl border border-slate-200 px-4 text-sm font-black text-next-muted" type="button" onClick={() => setSelectedInstallItem(null)}>
                  Cancelar
                </button>
                <button className="h-11 rounded-xl bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={() => void registerInstallation(selectedInstallItem)}>
                  {saving ? "Guardando..." : "Guardar instalacion"}
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
  onProcess,
  onReport,
  onStart,
  saving,
  task
}: {
  activeWorkday?: FieldWorkday;
  onProcess: () => void;
  onReport: () => void;
  onStart: () => void;
  saving: boolean;
  task: FieldTask;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-black leading-tight text-next-text">{task.titulo}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-next-muted">{task.obraNombre}</p>
        </div>
        <StatusBadge label={statusLabels[task.estado]} status={badgeForTask(task.estado)} />
      </div>
      <div className="mt-3 grid gap-2 text-xs font-semibold text-next-muted sm:grid-cols-2">
        <Line icon={Flag} label="Rubro" value={task.rubroNombre || "Sin rubro"} />
        <Line icon={Clock3} label="Fecha" value={task.fechaAsignada ? formatDateShort(task.fechaAsignada) : "Sin fecha"} />
        <Line icon={Camera} label="Fotos" value={`${task.fotos?.length ?? 0}`} />
        {task.cantidadPrevista ? (
          <Line icon={CheckCircle2} label="Cantidad" value={`${task.cantidadPrevista} ${formatUnitLabel(task.unidad, task.cantidadPrevista)}`} />
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {!activeWorkday ? (
          <button className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-next-blue px-4 text-xs font-black text-white disabled:opacity-60 sm:col-span-3" type="button" disabled={saving} onClick={onStart}>
            <Play className="h-4 w-4" aria-hidden="true" />
            Iniciar jornada
          </button>
        ) : null}
        <button className="h-10 rounded-xl border border-next-blue px-3 text-xs font-black text-next-blue disabled:opacity-50" type="button" disabled={saving || task.estado === "en_proceso"} onClick={onProcess}>
          En proceso
        </button>
        <button className="h-10 rounded-xl bg-next-blue px-3 text-xs font-black text-white disabled:opacity-50 sm:col-span-2" type="button" disabled={saving || task.estado === "reportada" || task.estado === "completada"} onClick={onReport}>
          Reportar
        </button>
      </div>
    </article>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-2xl border border-white/80 bg-white/85 px-3 py-3 shadow-[0_12px_30px_rgba(15,23,42,0.05)] ring-1 ring-slate-200/60">
      <p className="truncate text-[10px] font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-next-text" title={value}>{value}</p>
    </div>
  );
}

function buildPhoto(
  url: string,
  storagePath: string,
  fileName: string,
  obraId: string,
  refs: { taskId?: string; jornadaId?: string; phase?: TaskPhoto["phase"] },
  uploadedBy = "campo"
): TaskPhoto {
  return {
    id: `photo-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    url,
    storagePath,
    fileName,
    uploadedBy,
    uploadedAt: new Date().toISOString(),
    obraId,
    ...refs
  };
}

function buildTimeline(activeWorkday: FieldWorkday | undefined, tasks: FieldTask[]) {
  const items: { time: string; text: string }[] = [];

  if (activeWorkday) {
    items.push({ time: activeWorkday.horaInicio, text: `Inicio jornada en ${activeWorkday.obraNombre}.` });
  }

  tasks
    .filter((task) => ["en_proceso", "reportada", "completada", "observada"].includes(task.estado))
    .slice(0, 5)
    .forEach((task) => {
      const time = task.updatedAt ? new Date(task.updatedAt).toTimeString().slice(0, 5) : "--:--";
      items.push({ time, text: `${task.titulo}: ${statusLabels[task.estado].toLowerCase()}.` });
    });

  if (activeWorkday?.fotosInicio?.length) {
    items.push({ time: activeWorkday.horaInicio, text: "Se cargaron fotos de llegada." });
  }

  return items;
}

function badgeForTask(status: FieldTaskStatus) {
  if (status === "completada") return "success";
  if (status === "observada" || status === "cancelada") return "critical";
  if (status === "reportada") return "warning";
  return "info";
}

function formatRole(role?: UserRole) {
  if (!role) return "sin rol";
  return role.replace("_", " ");
}

function Line({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Icon className="h-4 w-4 shrink-0 text-next-blue" aria-hidden="true" />
      <span className="shrink-0 font-black text-next-text">{label}:</span>
      <span className="min-w-0 truncate">{value}</span>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "warning" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : tone === "warning"
      ? "border-orange-100 bg-orange-50 text-next-orange"
      : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="rounded-xl border border-dashed border-slate-200 bg-next-bg px-4 py-6 text-center text-sm font-semibold text-next-muted">{text}</div>;
}
