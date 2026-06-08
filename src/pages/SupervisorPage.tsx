import {
  Bell,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  Eye,
  Flag,
  LogOut,
  MessageSquareText,
  UserRound,
  XCircle,
  type LucideIcon
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import BrandLogo from "../components/brand/BrandLogo";
import ProgressReportModal from "../components/progress/ProgressReportModal";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  createProgressReport,
  getCuadrillas,
  getFieldTasks,
  getFieldWorkdays,
  getObras,
  getPendingMaterialsByWork,
  getProgressReportsByWork,
  getProgressRubricsByWork,
  updateFieldTask
} from "../lib/firestore";
import { canViewAllWorksForUser } from "../lib/roles";
import type {
  Cuadrilla,
  FieldTask,
  FieldTaskStatus,
  FieldWorkday,
  Obra,
  ProgressMaterialReport,
  ProgressReport,
  SystemUser,
  WorkProgressRubric
} from "../types";
import { formatDateShort, formatDateTime } from "../utils/formatters";
import { calculateWeightedProgressFromReports } from "../utils/progress";

const allowedRoles = ["admin", "gerencia", "fiscalizador", "supervisor"] as const;

const taskStatusLabels: Record<FieldTaskStatus, string> = {
  pendiente: "Pendiente",
  asignada: "Asignada",
  en_proceso: "En proceso",
  reportada: "Reportada",
  completada: "Completada",
  observada: "Observada",
  cancelada: "Cancelada"
};

export default function SupervisorPage() {
  const { authUser, login, logout, profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [rubrics, setRubrics] = useState<WorkProgressRubric[]>([]);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [materials, setMaterials] = useState<ProgressMaterialReport[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [tasks, setTasks] = useState<FieldTask[]>([]);
  const [workdays, setWorkdays] = useState<FieldWorkday[]>([]);
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const canAccess = canAccessFiscalizador(profile);

  useEffect(() => {
    if (profile && canAccess) {
      void load();
    }
  }, [profile?.uid, canAccess]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const loadedObras = await getObras();
      const visibleObras = filterFiscalizadorWorks(loadedObras, profile);
      const [allRubrics, allReports, allMaterials, crews, fieldTasks, fieldWorkdays] = await Promise.all([
        Promise.all(visibleObras.map((obra) => getProgressRubricsByWork(obra.id))).then((items) => items.flat()),
        Promise.all(visibleObras.map((obra) => getProgressReportsByWork(obra.id))).then((items) => items.flat()),
        Promise.all(visibleObras.map((obra) => getPendingMaterialsByWork(obra.id))).then((items) => items.flat()),
        getCuadrillas(),
        getFieldTasks(),
        getFieldWorkdays()
      ]);
      const visibleIds = new Set(visibleObras.map((obra) => obra.id));
      setObras(visibleObras);
      setRubrics(allRubrics);
      setReports(allReports);
      setMaterials(allMaterials);
      setCuadrillas(crews);
      setTasks(fieldTasks.filter((task) => visibleIds.has(task.obraId)));
      setWorkdays(fieldWorkdays.filter((workday) => visibleIds.has(workday.obraId)));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar fiscalizacion.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateReport(report: Omit<ProgressReport, "id" | "createdAt" | "updatedAt">) {
    await createProgressReport(report);
    setSelectedObra(null);
    setMessage("Parte de avance registrado.");
    await load();
  }

  async function handleTaskStatus(task: FieldTask, estado: FieldTaskStatus) {
    setError("");
    setMessage("");
    try {
      await updateFieldTask(task.id, { estado });
      setMessage(`Tarea marcada como ${taskStatusLabels[estado].toLowerCase()}.`);
      await load();
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : "No se pudo actualizar la tarea.");
    }
  }

  const pendingTasks = tasks.filter((task) => ["pendiente", "asignada", "en_proceso", "reportada", "observada"].includes(task.estado));
  const reportedTasks = tasks.filter((task) => task.estado === "reportada");
  const averageProgress = useMemo(() => {
    if (!obras.length) return 0;
    const total = obras.reduce((sum, obra) => {
      const obraRubrics = rubrics.filter((rubro) => rubro.obraId === obra.id);
      const obraReports = reports.filter((report) => report.obraId === obra.id);
      return sum + calculateWeightedProgressFromReports(obraRubrics, obraReports);
    }, 0);
    return Math.round(total / obras.length);
  }, [obras, reports, rubrics]);

  if (!authUser && !profile) {
    return <FiscalizadorLogin onLogin={login} />;
  }

  if (authUser && !profile) {
    return (
      <AccessState
        title="Cuenta sin perfil"
        text="Tu cuenta existe, pero todavia no tiene un perfil y rol asignados. Contacta al administrador."
        onLogout={logout}
      />
    );
  }

  if (!canAccess) {
    return (
      <AccessState
        title="Sin permisos"
        text="No tenes permisos para acceder a Fiscalizacion."
        onLogout={logout}
      />
    );
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-next-bg px-4 py-6 text-sm font-bold text-next-muted">
        Cargando fiscalizacion...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f7fb] px-4 py-4 text-next-text">
      <div className="mx-auto max-w-xl space-y-4 pb-8 lg:max-w-3xl">
        <header className="flex items-center justify-between rounded-[1.35rem] bg-next-navy px-4 py-3 text-white shadow-soft">
          <div className="flex min-w-0 items-center gap-3">
            <BrandLogo variant="compact" className="shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-black leading-tight">NEXT CONTROL</p>
              <p className="text-xs font-semibold text-white/65">Fiscalizacion de obras</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10" type="button" title="Notificaciones">
              <Bell className="h-4 w-4" aria-hidden="true" />
            </button>
            <button className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/10" type="button" onClick={() => void logout()} title="Cerrar sesion">
              <LogOut className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </header>

        {message ? <Notice tone="success" text={message} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase text-next-blue">Fiscalizador</p>
              <h1 className="mt-1 truncate text-2xl font-black text-next-text">{profile?.nombre ?? "Usuario"}</h1>
              <p className="mt-1 text-sm font-semibold capitalize text-next-muted">{formatRole(profile?.role)}</p>
            </div>
            <UserRound className="h-10 w-10 rounded-full bg-next-light p-2 text-next-blue" aria-hidden="true" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <MiniMetric label="Obras" value={`${obras.length}`} />
            <MiniMetric label="Pendientes" value={`${reportedTasks.length}`} />
            <MiniMetric label="Avance" value={`${averageProgress}%`} />
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3 px-1">
            <div>
              <p className="text-xs font-black uppercase text-next-blue">Obras asignadas</p>
              <h2 className="text-xl font-black text-next-text">Seguimiento operativo</h2>
            </div>
            <span className="rounded-full bg-next-blue/10 px-3 py-1 text-xs font-black text-next-blue">{obras.length}</span>
          </div>
          {obras.length ? obras.map((obra) => {
            const obraRubrics = rubrics.filter((rubro) => rubro.obraId === obra.id);
            const obraReports = reports.filter((report) => report.obraId === obra.id);
            const obraTasks = tasks.filter((task) => task.obraId === obra.id);
            const progress = Math.round(calculateWeightedProgressFromReports(obraRubrics, obraReports));
            const activeCrew = cuadrillas.find((crew) => crew.obraId === obra.id && crew.estado === "En obra" && !crew.horaFin);
            const activeWorkday = workdays.find((workday) => workday.obraId === obra.id && workday.estado === "activa");
            const latest = obraReports[0];
            const pending = materials.filter((material) => material.obraId === obra.id && material.estado !== "Resuelto").length;
            const reported = obraTasks.filter((task) => task.estado === "reportada").length;
            const open = obraTasks.filter((task) => ["pendiente", "asignada", "en_proceso", "observada"].includes(task.estado)).length;

            return (
              <article key={obra.id} className="overflow-hidden rounded-[1.5rem] bg-white shadow-soft ring-1 ring-slate-200">
                <div className="relative overflow-hidden bg-next-navy" style={{ height: 154 }}>
                  {obra.renderUrl || obra.imageUrl ? (
                    <img className="h-full w-full object-cover" src={obra.renderUrl ?? obra.imageUrl} alt={obra.nombre} />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.22),transparent_32%),linear-gradient(135deg,#08295a,#15558f)]">
                      <BriefcaseBusiness className="h-12 w-12 text-white/85" aria-hidden="true" />
                    </div>
                  )}
                  <div className="absolute bg-gradient-to-t from-slate-950/75 to-transparent p-4 text-white" style={{ bottom: 0, left: 0, right: 0 }}>
                    <StatusBadge label={obra.estado} status={obra.estado === "Atrasada" ? "critical" : "info"} />
                    <h3 className="mt-2 text-xl font-black leading-tight">{obra.nombre}</h3>
                    <p className="mt-1 truncate text-sm font-semibold text-white/80">{obra.cliente}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase text-next-muted">Avance general</p>
                      <p className="text-3xl font-black text-next-blue">{progress}%</p>
                    </div>
                    <p className="text-right text-xs font-semibold text-next-muted">
                      {latest ? `${formatDateShort(latest.fecha)} ${latest.hora}` : formatDateTime(obra.updatedAt)}
                    </p>
                  </div>
                  <ProgressBar value={progress} />
                  <div className="mt-4 grid gap-2 text-sm font-semibold text-next-muted">
                    <Line icon={Clock3} label="Ultima actualizacion" value={latest ? `${formatDateShort(latest.fecha)} ${latest.hora}` : "Sin reportes"} />
                    <Line icon={UserRound} label="Equipo activo" value={activeWorkday ? `${activeWorkday.equipoNombre || activeWorkday.userName} desde ${activeWorkday.horaInicio}` : activeCrew ? `${activeCrew.nombre} desde ${activeCrew.horaInicio || "--:--"}` : "Sin equipo activo"} />
                    <Line icon={ClipboardCheck} label="Materiales pendientes" value={`${pending}`} />
                    <Line icon={Flag} label="Tareas" value={`${open} abiertas / ${reported} reportadas`} />
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button className="h-11 rounded-xl bg-next-blue px-4 text-sm font-black text-white sm:col-span-2" type="button" onClick={() => setSelectedObra(obra)}>
                      Registrar avance
                    </button>
                    <button className="h-11 rounded-xl border border-next-blue px-4 text-sm font-black text-next-blue" type="button" onClick={() => document.getElementById(`tasks-${obra.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}>
                      Ver tareas
                    </button>
                  </div>
                </div>
              </article>
            );
          }) : (
            <EmptyState
              title="No tenes obras asignadas."
              text="Pedile al administrador que te asigne obras para fiscalizar."
            />
          )}
        </section>

        <section className="rounded-[1.35rem] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase text-next-blue">Tareas y reportes</p>
              <h2 className="text-lg font-black text-next-text">Pendientes de revision</h2>
            </div>
            <span className="text-2xl font-black text-next-blue">{pendingTasks.length}</span>
          </div>
          <div className="space-y-3">
            {pendingTasks.length ? pendingTasks.slice(0, 8).map((task) => (
              <TaskReviewCard
                key={task.id}
                task={task}
                onComplete={() => void handleTaskStatus(task, "completada")}
                onObserve={() => void handleTaskStatus(task, "observada")}
                onReopen={() => void handleTaskStatus(task, "en_proceso")}
              />
            )) : <EmptyState title="Sin tareas pendientes." text="Los reportes de campo apareceran aca cuando el equipo los cargue." compact />}
          </div>
        </section>
      </div>

      {selectedObra ? (
        <ProgressReportModal
          obra={selectedObra}
          rubrics={rubrics.filter((rubro) => rubro.obraId === selectedObra.id)}
          reports={reports.filter((report) => report.obraId === selectedObra.id)}
          cuadrillas={cuadrillas}
          user={profile ?? undefined}
          onClose={() => setSelectedObra(null)}
          onSubmit={handleCreateReport}
        />
      ) : null}
    </main>
  );
}

function FiscalizadorLogin({ onLogin }: { onLogin: (email: string, password: string) => Promise<void> }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      await onLogin(email, password);
    } catch (loginError) {
      console.error("No se pudo iniciar sesion de fiscalizador.", loginError);
      setError("No se pudo iniciar sesion. Verifica el correo y la contrasena.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-next-navy px-4 py-8">
      <section className="w-full max-w-md rounded-[1.5rem] bg-white p-6 text-next-text shadow-2xl">
        <div className="mb-6 flex justify-center rounded-[1.25rem] bg-next-navy px-4 py-5">
          <BrandLogo variant="login" />
        </div>
        <p className="text-xs font-black uppercase text-next-blue">NEXT CONTROL</p>
        <h1 className="mt-1 text-2xl font-black">Acceso fiscalizador</h1>
        <p className="mt-2 text-sm font-semibold text-next-muted">Ingresa con el usuario creado por administracion.</p>
        {error ? <Notice tone="error" text={error} /> : null}
        <form className="mt-5 space-y-3" onSubmit={handleSubmit}>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Correo</span>
            <input className="field mt-1" required type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <label>
            <span className="text-xs font-black uppercase text-next-muted">Contrasena</span>
            <input className="field mt-1" required type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </label>
          <button className="h-11 w-full rounded-xl bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="submit" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </section>
    </main>
  );
}

function AccessState({ onLogout, text, title }: { onLogout: () => Promise<void>; text: string; title: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-next-bg px-4">
      <section className="w-full max-w-md rounded-[1.5rem] border border-slate-200 bg-white p-6 text-center shadow-soft">
        <div className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-50 text-next-red">
          <XCircle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-black text-next-text">{title}</h1>
        <p className="mt-3 text-sm font-semibold leading-6 text-next-muted">{text}</p>
        <button className="mt-5 h-11 rounded-xl bg-next-blue px-5 text-sm font-black text-white" type="button" onClick={() => void onLogout()}>
          Cerrar sesion
        </button>
      </section>
    </main>
  );
}

function TaskReviewCard({
  onComplete,
  onObserve,
  onReopen,
  task
}: {
  onComplete: () => void;
  onObserve: () => void;
  onReopen: () => void;
  task: FieldTask;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-black leading-tight text-next-text">{task.titulo}</h3>
          <p className="mt-1 truncate text-xs font-semibold text-next-muted">{task.obraNombre}</p>
        </div>
        <StatusBadge label={taskStatusLabels[task.estado]} status={badgeForTask(task.estado)} />
      </div>
      <div className="mt-3 grid gap-2 text-xs font-semibold text-next-muted sm:grid-cols-2">
        <Line icon={Flag} label="Rubro" value={task.rubroNombre || "Sin rubro"} />
        <Line icon={Camera} label="Fotos" value={`${task.fotos?.length ?? 0}`} />
        {task.observacionCampo ? <Line icon={MessageSquareText} label="Obs." value={task.observacionCampo} /> : null}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <button className="h-10 rounded-xl bg-next-green px-3 text-xs font-black text-white disabled:opacity-50" type="button" disabled={task.estado === "completada"} onClick={onComplete}>
          Validar
        </button>
        <button className="h-10 rounded-xl border border-next-orange px-3 text-xs font-black text-next-orange disabled:opacity-50" type="button" disabled={task.estado === "observada"} onClick={onObserve}>
          Observar
        </button>
        <button className="h-10 rounded-xl border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={onReopen}>
          Reabrir
        </button>
      </div>
    </article>
  );
}

function filterFiscalizadorWorks(obras: Obra[], profile: SystemUser | null) {
  if (!profile) return [];
  if (canViewAllWorksForUser(profile) || profile.role === "admin" || profile.role === "gerencia") return obras;

  const name = profile.nombre.toLowerCase();
  return obras.filter((obra) => {
    const legacy = obra as Obra & { fiscalizadorId?: string; supervisorId?: string };
    return legacy.fiscalizadorId === profile.uid ||
      legacy.supervisorId === profile.uid ||
      obra.assignedUserIds?.includes(profile.uid) ||
      profile.assignedWorkIds?.includes(obra.id) ||
      obra.fiscalizador?.toLowerCase().includes(name) ||
      obra.supervisor?.toLowerCase().includes(name) ||
      obra.responsable?.toLowerCase().includes(name);
  });
}

function canAccessFiscalizador(profile: SystemUser | null) {
  return Boolean(profile?.active && allowedRoles.includes(profile.role as (typeof allowedRoles)[number]));
}

function badgeForTask(status: FieldTaskStatus) {
  if (status === "completada") return "success";
  if (status === "observada" || status === "cancelada") return "critical";
  if (status === "reportada") return "warning";
  return "info";
}

function formatRole(role?: string) {
  if (!role) return "sin rol";
  return role.replace("_", " ");
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-next-bg px-3 py-2">
      <p className="truncate text-[10px] font-black uppercase text-next-muted">{label}</p>
      <p className="mt-1 truncate text-xs font-black text-next-text" title={value}>{value}</p>
    </div>
  );
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

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : "border-red-100 bg-red-50 text-next-red";
  return <div className={`mt-4 rounded-xl border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function EmptyState({ compact = false, text, title }: { compact?: boolean; text: string; title: string }) {
  return (
    <div className={`rounded-[1.35rem] border border-dashed border-slate-200 bg-white px-4 text-center shadow-sm ${compact ? "py-5" : "py-8"}`}>
      <Eye className="mx-auto h-8 w-8 text-next-blue" aria-hidden="true" />
      <h3 className="mt-3 text-base font-black text-next-text">{title}</h3>
      <p className="mt-2 text-sm font-semibold text-next-muted">{text}</p>
    </div>
  );
}
