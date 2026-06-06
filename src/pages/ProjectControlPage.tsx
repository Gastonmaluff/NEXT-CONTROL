import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Image as ImageIcon,
  Package,
  Settings2,
  Trash2,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import ProgressReportModal from "../components/progress/ProgressReportModal";
import DataCard from "../components/ui/DataCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import NewWorkWizard from "../components/work/NewWorkWizard";
import { useAuth } from "../context/AuthContext";
import {
  createProgressReport,
  createProgressRubric,
  deleteObra,
  deleteProgressRubric,
  getActividadesByObra,
  getCuadrillas,
  getObras,
  getPendingMaterialsByWork,
  getProgressActivityByWork,
  getProgressReportsByWork,
  getProgressRubricsByWork,
  updatePendingMaterial,
  updateProgressRubric
} from "../lib/firestore";
import { canConfigureProgressForUser, canCreateWork, canRegisterProgressForUser } from "../lib/roles";
import type {
  Actividad,
  Cuadrilla,
  Obra,
  ProgressActivityLog,
  ProgressCalculationMode,
  ProgressMaterialReport,
  ProgressReport,
  WorkProgressRubric,
  WorkStatus
} from "../types";
import { formatDateShort, formatDateTime } from "../utils/formatters";
import {
  calculateRubricProgress,
  calculateTotalExecuted,
  calculateWeightedProgressFromReports,
  getLatestRubricEntry,
  validateRubricWeights
} from "../utils/progress";
import { formatUnitLabel } from "../utils/units";

const workStatuses: WorkStatus[] = [
  "Produccion",
  "Instalacion",
  "Atrasada",
  "Pausada",
  "Finalizada",
  "Aprobado",
  "Facturacion"
];

type RubricFormRow = {
  id?: string;
  nombre: string;
  unidad: string;
  cantidadTotalPrevista: string;
  pesoOperativo: string;
  modoCalculo: ProgressCalculationMode;
  avanceManualPermitido: boolean;
  orden: string;
};

export default function ProjectControlPage() {
  const { obraId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [rubrics, setRubrics] = useState<WorkProgressRubric[]>([]);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [materials, setMaterials] = useState<ProgressMaterialReport[]>([]);
  const [progressActivity, setProgressActivity] = useState<ProgressActivityLog[]>([]);
  const [legacyActivity, setLegacyActivity] = useState<Actividad[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [newWorkOpen, setNewWorkOpen] = useState(false);

  const selectedObra = obraId ? obras.find((obra) => obra.id === obraId) ?? null : null;

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const loadedObras = await getObras();
      const [allRubrics, allReports, allMaterials, crews] = await Promise.all([
        Promise.all(loadedObras.map((obra) => getProgressRubricsByWork(obra.id))).then((items) => items.flat()),
        Promise.all(loadedObras.map((obra) => getProgressReportsByWork(obra.id))).then((items) => items.flat()),
        Promise.all(loadedObras.map((obra) => getPendingMaterialsByWork(obra.id))).then((items) => items.flat()),
        getCuadrillas()
      ]);
      setObras(loadedObras);
      setRubrics(allRubrics);
      setReports(allReports);
      setMaterials(allMaterials);
      setCuadrillas(crews);

      if (obraId) {
        const [activity, legacy] = await Promise.all([
          getProgressActivityByWork(obraId),
          getActividadesByObra(obraId)
        ]);
        setProgressActivity(activity);
        setLegacyActivity(legacy);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar avance de obras.");
    } finally {
      setLoading(false);
    }
  }

  const filteredObras = useMemo(() => {
    return obras.filter((obra) => {
      const matchesQuery = `${obra.nombre} ${obra.cliente} ${obra.responsable} ${obra.supervisor ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = statusFilter === "Todos" || obra.estado === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [obras, query, statusFilter]);

  async function handleDeleteObra() {
    if (!selectedObra || !window.confirm(`Eliminar ${selectedObra.nombre}?`)) return;
    try {
      await deleteObra(selectedObra.id);
      setMessage("Obra eliminada.");
      navigate("/avance-obras");
      await loadAll();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la obra.");
    }
  }

  async function handleCreateReport(report: Omit<ProgressReport, "id" | "createdAt" | "updatedAt">) {
    await createProgressReport(report);
    setMessage("Parte de avance registrado.");
    await loadAll();
  }

  async function handleSaveRubrics(rows: RubricFormRow[], deletedIds: string[]) {
    if (!selectedObra) return;

    const totalWeight = rows.reduce((sum, row) => sum + Number(row.pesoOperativo), 0);
    if (totalWeight !== 100 && !window.confirm(`La suma de pesos es ${totalWeight}%. Guardar igualmente?`)) {
      return;
    }

    for (const id of deletedIds) {
      await deleteProgressRubric(id);
    }

    for (const row of rows) {
      const data = {
        obraId: selectedObra.id,
        nombre: row.nombre,
        unidad: row.unidad,
        cantidadTotalPrevista: Number(row.cantidadTotalPrevista),
        pesoOperativo: Number(row.pesoOperativo),
        modoCalculo: row.modoCalculo,
        avanceManualPermitido: row.avanceManualPermitido,
        orden: Number(row.orden)
      };

      if (row.id) {
        await updateProgressRubric(row.id, data);
      } else {
        await createProgressRubric(data);
      }
    }

    setMessage("Configuracion de avance guardada.");
    setConfigModalOpen(false);
    await loadAll();
  }

  async function handleMaterialStatus(material: ProgressMaterialReport, estado: ProgressMaterialReport["estado"]) {
    await updatePendingMaterial(material.id, { estado });
    setMessage("Material actualizado.");
    await loadAll();
  }

  if (loading) {
    return <StateCard text="Cargando avance de obras..." />;
  }

  if (obraId) {
    if (!selectedObra) {
      return (
        <div className="space-y-5">
          <BackButton onClick={() => navigate("/avance-obras")} />
          <EmptyState text="No se encontro esta obra." />
        </div>
      );
    }

    const obraRubrics = getRubricsForWork(selectedObra.id, rubrics);
    const obraReports = getReportsForWork(selectedObra.id, reports);
    const obraMaterials = getMaterialsForWork(selectedObra.id, materials);

    return (
      <>
        <ProgressDetail
          actividades={progressActivity}
        canConfigure={canConfigureProgressForUser(profile)}
        canRegister={canRegisterProgressForUser(profile)}
          cuadrillas={cuadrillas}
          error={error}
          legacyActivity={legacyActivity}
          materials={obraMaterials}
          message={message}
          obra={selectedObra}
          onBack={() => navigate("/avance-obras")}
          onDeleteObra={handleDeleteObra}
          onMaterialStatus={handleMaterialStatus}
          onOpenConfig={() => setConfigModalOpen(true)}
          onOpenReport={() => setReportModalOpen(true)}
          reports={obraReports}
          rubrics={obraRubrics}
        />
        {reportModalOpen ? (
          <ProgressReportModal
            obra={selectedObra}
            rubrics={obraRubrics}
            reports={obraReports}
            cuadrillas={cuadrillas}
            user={profile ?? undefined}
            onClose={() => setReportModalOpen(false)}
            onSubmit={handleCreateReport}
          />
        ) : null}
        {configModalOpen ? (
          <ProgressConfigModal
            rubrics={obraRubrics}
            onClose={() => setConfigModalOpen(false)}
            onSave={handleSaveRubrics}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase text-next-blue">Operaciones</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">AVANCE DE OBRAS</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Seguimiento operativo, fiscalizacion, produccion e instalacion de cada obra.
          </p>
        </div>
        {canCreateWork(profile) ? (
          <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={() => setNewWorkOpen(true)}>
            Nueva obra
          </button>
        ) : null}
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_220px]">
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-next-bg px-3 text-sm font-semibold outline-none focus:border-next-blue focus:bg-white focus:ring-4 focus:ring-next-blue/10"
            placeholder="Buscar por obra, cliente o fiscalizador"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-next-blue focus:ring-4 focus:ring-next-blue/10"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>Todos</option>
            {workStatuses.map((status) => (
              <option key={status}>{status}</option>
            ))}
          </select>
        </div>
      </section>

      <section className="min-w-0 space-y-5">
        {filteredObras.length ? (
          filteredObras.map((obra) => (
            <ProgressWorkCard
              key={obra.id}
              activeCrew={getActiveCrew(obra.id, cuadrillas)}
              materials={getMaterialsForWork(obra.id, materials)}
              obra={obra}
              onOpen={() => navigate(`/avance-obras/${obra.id}`)}
              reports={getReportsForWork(obra.id, reports)}
              rubrics={getRubricsForWork(obra.id, rubrics)}
            />
          ))
        ) : (
          <EmptyState text="No hay obras con esos filtros." />
        )}
      </section>

      {newWorkOpen ? (
        <NewWorkWizard
          defaultDestination="avance"
          onClose={() => setNewWorkOpen(false)}
          onCreated={(obra, destination, notice) => {
            setNewWorkOpen(false);
            setObras((current) => [obra, ...current]);
            setMessage(notice ?? "Obra creada correctamente.");
            if (destination === "avance") navigate(`/avance-obras/${obra.id}`);
            if (destination === "finanzas") navigate(`/finanzas-obras/${obra.id}`);
            if (destination === "control") navigate("/control");
          }}
        />
      ) : null}
    </div>
  );
}

function ProgressWorkCard({
  activeCrew,
  materials,
  obra,
  onOpen,
  reports,
  rubrics
}: {
  activeCrew?: Cuadrilla;
  materials: ProgressMaterialReport[];
  obra: Obra;
  onOpen: () => void;
  reports: ProgressReport[];
  rubrics: WorkProgressRubric[];
}) {
  const progress = calculateWeightedProgressFromReports(rubrics, reports);
  const pendingMaterials = materials.filter((item) => item.estado !== "Resuelto").length;
  const latestReport = reports[0];
  const summary = obra.observacionInicial || operationalSummary(obra, progress, pendingMaterials);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(240px,32%)_minmax(0,1fr)]">
        <WorkVisual obra={obra} compact />

        <div className="min-w-0 p-1 sm:p-2">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-xl font-black leading-tight text-next-text">{obra.nombre}</h2>
              <p className="mt-1 truncate text-sm font-semibold text-next-muted" title={obra.cliente}>{obra.cliente}</p>
              <p className="mt-2 text-xs font-black uppercase text-next-blue">
                Fiscalizador: {cleanPersonLabel(obra.supervisor ?? obra.responsable)}
              </p>
            </div>
            <StatusBadge label={obra.estado} status={badgeForWork(obra.estado)} />
          </div>

          <div className="mt-5 rounded-md bg-next-bg px-3 py-3">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-black uppercase text-next-muted">Avance general</p>
              <p className="text-2xl font-black text-next-blue">{progress}%</p>
            </div>
            <ProgressBar value={progress} />
            {!obra.progressConfigured || !rubrics.length ? (
              <p className="mt-2 text-xs font-black text-next-orange">Avance sin configurar</p>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SmallMetric label="Fecha comprometida" value={formatDateShort(obra.fechaComprometida ?? obra.fechaEntrega)} />
            <SmallMetric label="Encargado" value={obra.responsable} />
            <SmallMetric label="Cuadrilla hoy" value={activeCrew ? activeCrew.nombre : "Sin cuadrilla activa"} tone={activeCrew ? "green" : "blue"} />
            <SmallMetric label="Ultima actualizacion" value={latestReport ? `${formatDateShort(latestReport.fecha)} ${latestReport.hora}` : formatDateTime(obra.updatedAt)} />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-xs font-semibold leading-5 ${obra.estado === "Atrasada" ? "text-next-red" : "text-next-muted"}`}>
              {summary}
            </p>
            <button className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy sm:w-auto" type="button" onClick={onOpen}>
              <ClipboardCheck className="h-4 w-4" aria-hidden="true" />
              Abrir avance
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function ProgressDetail({
  actividades,
  canConfigure,
  canRegister,
  cuadrillas,
  error,
  legacyActivity,
  materials,
  message,
  obra,
  onBack,
  onDeleteObra,
  onMaterialStatus,
  onOpenConfig,
  onOpenReport,
  reports,
  rubrics
}: {
  actividades: ProgressActivityLog[];
  canConfigure: boolean;
  canRegister: boolean;
  cuadrillas: Cuadrilla[];
  error: string;
  legacyActivity: Actividad[];
  materials: ProgressMaterialReport[];
  message: string;
  obra: Obra;
  onBack: () => void;
  onDeleteObra: () => void;
  onMaterialStatus: (material: ProgressMaterialReport, estado: ProgressMaterialReport["estado"]) => void;
  onOpenConfig: () => void;
  onOpenReport: () => void;
  reports: ProgressReport[];
  rubrics: WorkProgressRubric[];
}) {
  const overallProgress = calculateWeightedProgressFromReports(rubrics, reports);
  const weightState = validateRubricWeights(rubrics);
  const pendingMaterials = materials.filter((item) => item.estado !== "Resuelto");
  const activeCrew = getActiveCrew(obra.id, cuadrillas);
  const latestReport = reports[0];
  const completedStages = obra.etapasProduccion.filter((stage) => stage.estado === "Completado").length;
  const installedMeters = calculateInstalledM2(rubrics, reports);

  return (
    <div className="min-w-0 space-y-6">
      <BackButton onClick={onBack} />

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid min-w-0 gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-soft sm:p-5 lg:grid-cols-[minmax(280px,34%)_minmax(0,1fr)]">
        <WorkVisual obra={obra} featured />

        <div className="min-w-0 space-y-5">
          <div className="flex min-w-0 flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div className="min-w-0">
              <p className="text-sm font-black uppercase text-next-blue">Seguimiento operativo</p>
              <h1 className="mt-1 text-3xl font-black leading-tight text-next-text">{obra.nombre}</h1>
              <p className="mt-1 text-sm font-semibold text-next-muted">{obra.cliente}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <StatusBadge label={obra.estado} status={badgeForWork(obra.estado)} />
              {canRegister ? (
                <button className="h-10 rounded-md bg-next-blue px-3 text-xs font-black text-white" type="button" onClick={onOpenReport}>
                  Actualizar avance
                </button>
              ) : null}
              {canConfigure ? (
                <button className="inline-flex h-10 items-center gap-2 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={onOpenConfig}>
                  <Settings2 className="h-4 w-4" aria-hidden="true" />
                  Configurar avance
                </button>
              ) : null}
              {canConfigure ? (
                <button className="icon-button text-next-red" type="button" onClick={onDeleteObra} title="Eliminar obra">
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoItem icon={CalendarDays} label="Fecha comprometida" value={formatDateShort(obra.fechaComprometida ?? obra.fechaEntrega)} />
            <InfoItem icon={UserRound} label="Encargado" value={obra.responsable} />
            <InfoItem icon={UserRound} label="Supervisor" value={obra.supervisor ? cleanPersonLabel(obra.supervisor) : "Sin asignar"} />
            <InfoItem icon={Package} label="Materiales pendientes" value={`${pendingMaterials.length}`} />
          </div>

          <div className="rounded-lg bg-next-bg p-4">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-next-text">Avance general</p>
                <p className="text-xs font-semibold text-next-muted">
                  El avance se calcula por ejecucion fisica real, no por consumo de presupuesto.
                </p>
              </div>
              <p className="text-3xl font-black text-next-blue">{overallProgress}%</p>
            </div>
            <ProgressBar value={overallProgress} />
            {!obra.progressConfigured || !rubrics.length ? (
              <p className="mt-3 text-xs font-black text-next-orange">
                Avance sin configurar. Usa Configurar avance para definir rubros, cantidades y pesos.
              </p>
            ) : null}
            {!weightState.isValid ? (
              <p className="mt-3 text-xs font-black text-next-orange">
                La suma de pesos es {weightState.totalWeight}%. Lo recomendado es 100%.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-5 xl:grid-cols-2">
        <DataCard title="Resumen operativo">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Estado operativo" value={obra.estado} />
            <Metric label="Avance fisico" value={`${overallProgress}%`} />
            <Metric label="Produccion completada" value={`${completedStages}/${obra.etapasProduccion.length} etapas`} />
            <Metric label="M2 instalados" value={`${installedMeters} m2`} />
            <Metric label="Ultima actualizacion" value={latestReport ? `${formatDateShort(latestReport.fecha)} ${latestReport.hora}` : formatDateTime(obra.updatedAt)} />
            <Metric label="Cuadrilla activa hoy" value={activeCrew ? `${activeCrew.nombre} desde ${activeCrew.horaInicio || "--:--"}` : "Sin cuadrilla activa actualmente"} />
          </div>
        </DataCard>

        <DataCard title="Avance por rubros">
          <div className="mb-4 rounded-md bg-next-light px-3 py-3 text-xs font-bold leading-5 text-next-blue">
            El avance se calcula por ejecucion fisica real, no por consumo de presupuesto.
          </div>
          <div className="space-y-4">
            {rubrics.length ? rubrics.map((rubro) => {
              const progress = calculateRubricProgress(rubro, reports);
              const executed = calculateTotalExecuted(rubro.id, reports);
              const latest = getLatestRubricEntry(rubro.id, reports);
              const report = latest ? reports.find((item) => item.entries.some((entry) => entry.id === latest.id)) : null;
              return (
                <div key={rubro.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-next-text">{rubro.nombre}</p>
                      <p className="mt-1 text-xs font-semibold text-next-muted">
                        {executed} {formatUnitLabel(rubro.unidad, executed)} / {rubro.cantidadTotalPrevista} {formatUnitLabel(rubro.unidad, rubro.cantidadTotalPrevista)} · Peso {rubro.pesoOperativo}% · {rubro.modoCalculo}
                      </p>
                    </div>
                    <span className="text-xl font-black text-next-blue">{progress}%</span>
                  </div>
                  <ProgressBar value={progress} />
                  <div className="mt-3 grid gap-2 text-xs font-semibold text-next-muted sm:grid-cols-2">
                    <span>Ultima actualizacion: {report ? `${formatDateShort(report.fecha)} ${report.hora}` : "Sin reportes"}</span>
                    <span>Responsable: {report?.userName ?? "Pendiente"}</span>
                    <span>Fuente: {latest?.modo === "manual" ? "Ajuste manual justificado" : "Cantidad ejecutada"}</span>
                    <span>{latest?.observacion || latest?.justificacionManual || "Sin observacion"}</span>
                  </div>
                </div>
              );
            }) : <EmptyState text="Avance sin configurar. Defini rubros, cantidades y pesos para comenzar." />}
          </div>
        </DataCard>

        <DataCard title="Produccion">
          <div className="space-y-3">
            {obra.etapasProduccion.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2">
                <span className="text-sm font-bold text-next-text">{stage.nombre}</span>
                <StatusBadge label={stage.estado} status={stage.estado === "Completado" ? "success" : stage.estado === "En proceso" ? "info" : "warning"} />
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="Instalacion">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Cuadrilla" value={activeCrew?.nombre ?? "Sin cuadrilla activa actualmente"} />
            <Metric label="Estado de jornada" value={activeCrew ? activeCrew.estado : "Sin jornada activa"} />
            <Metric label="Hora inicio" value={activeCrew?.horaInicio || "--:--"} />
            <Metric label="Ultimo avance" value={latestReport ? `${latestReport.hora} · ${latestReport.userName}` : "Sin reportes"} />
          </div>
        </DataCard>

        <DataCard title="Materiales pendientes">
          <div className="space-y-3">
            {materials.length ? materials.map((material) => (
              <div key={material.id} className="rounded-md border border-slate-100 p-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-sm font-black text-next-text">{material.material}</p>
                    <p className="mt-1 text-xs font-semibold text-next-muted">
                      {material.cantidad} {material.unidad} · Reportado por {material.reportadoPor} · {formatDateShort(material.fechaReporte)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-next-muted">{material.observacion || "Sin observacion"}</p>
                  </div>
                  <select className="field h-10 max-w-40" value={material.estado} onChange={(event) => onMaterialStatus(material, event.target.value as ProgressMaterialReport["estado"])}>
                    <option>Pendiente</option>
                    <option>Solicitado</option>
                    <option>Recibido</option>
                    <option>Resuelto</option>
                  </select>
                </div>
              </div>
            )) : <EmptyState text="No hay materiales pendientes." />}
          </div>
        </DataCard>

        <DataCard title="Fotos de avance">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold leading-6 text-next-muted">
              {reports.flatMap((report) => report.photos ?? []).length ? "Fotos cargadas en reportes." : "Todavia no hay fotos cargadas."}
            </p>
            <Camera className="h-5 w-5 text-next-blue" aria-hidden="true" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {reports.flatMap((report) => report.photos ?? []).slice(0, 6).length ? (
              reports.flatMap((report) => report.photos ?? []).slice(0, 6).map((photo) => (
                <img key={photo} className="aspect-square rounded-md object-cover ring-1 ring-slate-200" src={photo} alt="Foto de avance" />
              ))
            ) : (
              [1, 2, 3].map((item) => (
                <div key={item} className="flex aspect-square items-center justify-center rounded-md bg-gradient-to-br from-next-light via-white to-slate-200 ring-1 ring-slate-200">
                  <ImageIcon className="h-5 w-5 text-next-blue/45" aria-hidden="true" />
                </div>
              ))
            )}
          </div>
        </DataCard>

        <DataCard title="Actividad reciente">
          <ul className="space-y-3">
            {actividades.length ? actividades.slice(0, 6).map((activity) => (
              <li key={activity.id} className="rounded-md border border-slate-100 px-3 py-3 text-sm font-semibold leading-6 text-next-muted">
                <span className="font-black text-next-blue">{formatDateTime(activity.fechaHora)}</span>{" "}
                {activity.descripcion}
              </li>
            )) : legacyActivity.length ? legacyActivity.slice(0, 6).map((activity) => (
              <li key={activity.id} className="rounded-md border border-slate-100 px-3 py-3 text-sm font-semibold leading-6 text-next-muted">
                <span className="font-black text-next-blue">{formatDateTime(activity.fecha)}</span>{" "}
                {activity.descripcion}
              </li>
            )) : <EmptyState text="Sin actividad registrada todavia." />}
          </ul>
        </DataCard>

        <DataCard title="Historial de avances">
          <div className="space-y-3">
            {reports.length ? reports.map((report) => (
              <div key={report.id} className="rounded-md border border-slate-100 p-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row">
                  <div>
                    <p className="text-sm font-black text-next-text">{formatDateShort(report.fecha)} · {report.hora}</p>
                    <p className="mt-1 text-xs font-semibold text-next-muted">{report.userName} · {report.userRole}</p>
                  </div>
                  <p className="text-xs font-black uppercase text-next-blue">{report.entries.length} rubro(s)</p>
                </div>
                <ul className="mt-3 space-y-2">
                  {report.entries.map((entry) => (
                    <li key={entry.id} className="text-xs font-semibold leading-5 text-next-muted">
                      <span className="font-black text-next-text">{entry.rubroNombre}</span>: {entry.porcentajeAnterior}% → {entry.porcentajeNuevo}%
                      {entry.cantidadEjecutadaHoy ? ` · ${entry.cantidadEjecutadaHoy} ejecutado hoy` : ""}
                      {entry.observacion ? ` · ${entry.observacion}` : ""}
                      {entry.justificacionManual ? ` · ${entry.justificacionManual}` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            )) : <EmptyState text="Todavia no hay reportes de avance." />}
          </div>
        </DataCard>
      </section>
    </div>
  );
}

function ProgressConfigModal({
  onClose,
  onSave,
  rubrics
}: {
  onClose: () => void;
  onSave: (rows: RubricFormRow[], deletedIds: string[]) => Promise<void>;
  rubrics: WorkProgressRubric[];
}) {
  const [rows, setRows] = useState<RubricFormRow[]>(() =>
    rubrics.map((rubro) => ({
      id: rubro.id,
      nombre: rubro.nombre,
      unidad: rubro.unidad,
      cantidadTotalPrevista: String(rubro.cantidadTotalPrevista),
      pesoOperativo: String(rubro.pesoOperativo),
      modoCalculo: rubro.modoCalculo,
      avanceManualPermitido: rubro.avanceManualPermitido,
      orden: String(rubro.orden)
    }))
  );
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const totalWeight = rows.reduce((sum, row) => sum + Number(row.pesoOperativo || 0), 0);

  function updateRow(index: number, data: Partial<RubricFormRow>) {
    setRows((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, ...data } : row));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    try {
      await onSave(rows, deletedIds);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-4xl rounded-lg bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Configuracion operativa</p>
            <h2 className="mt-1 text-xl font-black text-next-text">Configurar avance de obra</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>×</button>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className={`rounded-md px-3 py-2 text-xs font-black ${totalWeight === 100 ? "bg-green-50 text-next-green" : "bg-orange-50 text-next-orange"}`}>
            Suma de pesos: {totalWeight}%
          </div>
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id ?? index} className="grid gap-2 rounded-lg border border-slate-200 p-3 lg:grid-cols-[1.2fr_90px_130px_90px_130px_80px_auto]">
                <input className="field" required placeholder="Rubro" value={row.nombre} onChange={(event) => updateRow(index, { nombre: event.target.value })} />
                <input className="field" required placeholder="Unidad" value={row.unidad} onChange={(event) => updateRow(index, { unidad: event.target.value })} />
                <input className="field" min={0} required placeholder="Cantidad prevista" type="number" value={row.cantidadTotalPrevista} onChange={(event) => updateRow(index, { cantidadTotalPrevista: event.target.value })} />
                <input className="field" max={100} min={0} required placeholder="Peso" type="number" value={row.pesoOperativo} onChange={(event) => updateRow(index, { pesoOperativo: event.target.value })} />
                <select className="field" value={row.modoCalculo} onChange={(event) => updateRow(index, { modoCalculo: event.target.value as ProgressCalculationMode, avanceManualPermitido: event.target.value === "manual" })}>
                  <option value="cantidad">cantidad</option>
                  <option value="manual">manual</option>
                </select>
                <input className="field" min={1} type="number" value={row.orden} onChange={(event) => updateRow(index, { orden: event.target.value })} />
                <button
                  className="h-10 rounded-md border border-red-100 px-3 text-xs font-black text-next-red"
                  type="button"
                  onClick={() => {
                    if (row.id) setDeletedIds((current) => [...current, row.id as string]);
                    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
                  }}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
          <button
            className="h-10 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue"
            type="button"
            onClick={() => setRows((current) => [
              ...current,
              {
                nombre: "Nuevo rubro",
                unidad: "unidades",
                cantidadTotalPrevista: "0",
                pesoOperativo: "0",
                modoCalculo: "cantidad",
                avanceManualPermitido: false,
                orden: String(current.length + 1)
              }
            ])}
          >
            Agregar rubro
          </button>
          <button className="h-11 w-full rounded-md bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="submit" disabled={saving}>
            {saving ? "Guardando..." : "Guardar configuracion"}
          </button>
        </form>
      </section>
    </div>
  );
}

function WorkVisual({ obra, compact = false, featured = false }: { obra: Obra; compact?: boolean; featured?: boolean }) {
  const imageUrl = obra.imageUrl ?? obra.renderUrl;
  const minHeight = featured ? "min-h-72 lg:min-h-full" : compact ? "min-h-52 lg:min-h-full" : "min-h-56";

  return (
    <div className={`relative overflow-hidden rounded-md bg-next-navy ${minHeight}`}>
      {imageUrl ? (
        <img className="h-full w-full object-cover" src={imageUrl} alt={`Render de ${obra.nombre}`} />
      ) : (
        <div className={`flex h-full ${minHeight} flex-col justify-between bg-[linear-gradient(135deg,#0f2a44_0%,#1f6fb2_58%,#e8f3ff_100%)] p-5 text-white`}>
          <div className="inline-flex h-11 w-11 items-center justify-center rounded-md bg-white/15 ring-1 ring-white/20">
            <Building2 className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="text-xs font-black uppercase text-white/72">Render pendiente</p>
            <p className="mt-1 text-sm font-black leading-tight">{obra.nombre}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <button className="inline-flex items-center gap-2 text-sm font-black text-next-blue" type="button" onClick={onClick}>
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      Volver a Avance de obras
    </button>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-next-bg px-3 py-3">
      <Icon className="mb-3 h-5 w-5 text-next-blue" aria-hidden="true" />
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-next-text">{value}</p>
    </div>
  );
}

function SmallMetric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "green" | "orange" | "red" }) {
  const toneClasses = {
    blue: "text-next-blue",
    green: "text-next-green",
    orange: "text-next-orange",
    red: "text-next-red"
  };

  return (
    <div className="min-w-0 rounded-md bg-next-bg px-3 py-3">
      <p className="text-[11px] font-black uppercase text-next-muted">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${toneClasses[tone]}`} title={value}>{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-next-bg px-3 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 text-sm font-black text-next-text">{value}</p>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function StateCard({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-next-muted shadow-soft">
      {text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-next-bg px-4 py-8 text-center text-sm font-semibold text-next-muted">
      {text}
    </div>
  );
}

function getRubricsForWork(obraId: string, rubrics: WorkProgressRubric[]) {
  return rubrics.filter((rubro) => rubro.obraId === obraId).sort((a, b) => a.orden - b.orden);
}

function getReportsForWork(obraId: string, reports: ProgressReport[]) {
  return reports.filter((report) => report.obraId === obraId);
}

function getMaterialsForWork(obraId: string, materials: ProgressMaterialReport[]) {
  return materials.filter((material) => material.obraId === obraId);
}

function getActiveCrew(obraId: string, cuadrillas: Cuadrilla[]) {
  return cuadrillas.find((crew) => crew.obraId === obraId && crew.estado === "En obra" && !crew.horaFin);
}

function calculateInstalledM2(rubrics: WorkProgressRubric[], reports: ProgressReport[]) {
  return Math.round(
    rubrics
      .filter((rubro) => isInstalledSquareMeterRubric(rubro))
      .reduce((total, rubro) => {
        const accumulated = reports
          .flatMap((report) => report.entries)
          .filter((entry) => entry.rubroId === rubro.id)
          .reduce((max, entry) => Math.max(max, entry.cantidadAcumuladaNueva ?? 0), 0);

        return total + accumulated;
      }, 0)
  );
}

function isInstalledSquareMeterRubric(rubro: WorkProgressRubric) {
  const unit = normalizeOperationalText(rubro.unidad);
  const name = normalizeOperationalText(rubro.nombre);
  const isSquareMeter = unit === "m2" || unit === "m²" || unit.includes("metro cuadrado");
  const looksInstalled = name.includes("instalad") || name.includes("vidrio");
  const excluded = name.includes("sellado");

  return isSquareMeter && looksInstalled && !excluded;
}

function normalizeOperationalText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function operationalSummary(obra: Obra, progress: number, pendingMaterials: number) {
  if (obra.estado === "Atrasada") return "La obra requiere seguimiento cercano por atraso operativo.";
  if (pendingMaterials) return "Hay materiales pendientes que pueden afectar el avance de instalacion.";
  if (progress >= 85) return "Obra en etapa final de control, instalacion y terminaciones.";
  if (obra.estado === "Produccion") return "Produccion en curso con seguimiento de rubros y compras tecnicas.";
  return "Seguimiento operativo activo con avance fisico actualizado por reportes.";
}

function cleanPersonLabel(value: string) {
  return value.replace(/^Fiscalizador:\s*/i, "").replace(/^Supervisor:\s*/i, "");
}

function badgeForWork(status: WorkStatus): BadgeStatus {
  if (status === "Atrasada" || status === "Pausada") return "critical";
  if (status === "Finalizada" || status === "Cobrado") return "success";
  if (status === "Produccion" || status === "Instalacion" || status === "Facturacion") return "info";
  return "warning";
}
