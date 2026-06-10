import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Image as ImageIcon,
  Package,
  Plus,
  Settings2,
  Trash2,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
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
  getFieldTasks,
  getFieldWorkdays,
  getObras,
  getPendingMaterialsByWork,
  getProgressActivityByWork,
  getProgressReportsByWork,
  getProgressRubricsByWork,
  updateObra,
  updatePendingMaterial,
  updateProgressRubric
} from "../lib/firestore";
import { canConfigureProgressForUser, canCreateWork, canRegisterProgressForUser } from "../lib/roles";
import type {
  Actividad,
  Cuadrilla,
  FieldTask,
  FieldWorkday,
  Obra,
  ProgressActivityLog,
  ProgressCalculationMode,
  ProgressMaterialReport,
  ProgressReport,
  ProductionStage,
  ProductionStageStatus,
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
import { formatUnitLabel, normalizeUnit } from "../utils/units";
import { calculateM2Total, productionProgress } from "../utils/workBreakdown";

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
  const [fieldTasks, setFieldTasks] = useState<FieldTask[]>([]);
  const [fieldWorkdays, setFieldWorkdays] = useState<FieldWorkday[]>([]);
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
      const [tasks, workdays] = await Promise.all([getFieldTasks(), getFieldWorkdays()]);
      setObras(loadedObras);
      setRubrics(allRubrics);
      setReports(allReports);
      setMaterials(allMaterials);
      setCuadrillas(crews);
      setFieldTasks(tasks);
      setFieldWorkdays(workdays);

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

  async function handleSaveProductionStages(stages: ProductionStage[]) {
    if (!selectedObra) return;
    await updateObra(selectedObra.id, { etapasProduccion: stages });
    setMessage("Checklist de produccion actualizado.");
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
          currentUserName={profile?.nombre ?? "Usuario"}
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
          onSaveProductionStages={handleSaveProductionStages}
          reports={obraReports}
          rubrics={obraRubrics}
          tasks={fieldTasks.filter((task) => task.obraId === selectedObra.id)}
          workdays={fieldWorkdays.filter((jornada) => jornada.obraId === selectedObra.id)}
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
  currentUserName,
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
  onSaveProductionStages,
  reports,
  rubrics,
  tasks,
  workdays
}: {
  actividades: ProgressActivityLog[];
  canConfigure: boolean;
  canRegister: boolean;
  cuadrillas: Cuadrilla[];
  currentUserName: string;
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
  onSaveProductionStages: (stages: ProductionStage[]) => Promise<void>;
  reports: ProgressReport[];
  rubrics: WorkProgressRubric[];
  tasks: FieldTask[];
  workdays: FieldWorkday[];
}) {
  const overallProgress = calculateWeightedProgressFromReports(rubrics, reports);
  const overallProgressLabel = Math.round(overallProgress);
  const weightState = validateRubricWeights(rubrics);
  const pendingMaterials = materials.filter((item) => item.estado !== "Resuelto");
  const activeCrew = getActiveCrew(obra.id, cuadrillas);
  const activeFieldWorkday = workdays.find((jornada) => jornada.estado === "activa");
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
              </div>
              <p className="text-3xl font-black text-next-blue">{overallProgressLabel}%</p>
            </div>
            <ProgressBar value={overallProgressLabel} />
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
            <Metric label="Avance fisico" value={`${overallProgressLabel}%`} />
            <Metric label="Produccion completada" value={`${completedStages}/${obra.etapasProduccion.length} etapas`} />
            <Metric label="M2 instalados" value={`${installedMeters} m2`} />
            <Metric label="Ultima actualizacion" value={latestReport ? `${formatDateShort(latestReport.fecha)} ${latestReport.hora}` : formatDateTime(obra.updatedAt)} />
            <Metric label="Cuadrilla activa hoy" value={activeFieldWorkday ? `${activeFieldWorkday.equipoNombre || activeFieldWorkday.userName} desde ${activeFieldWorkday.horaInicio}` : activeCrew ? `${activeCrew.nombre} desde ${activeCrew.horaInicio || "--:--"}` : "Sin cuadrilla activa actualmente"} />
          </div>
        </DataCard>

        <DataCard title="Avance por rubros">
          <div className="space-y-4">
            {rubrics.length ? rubrics.map((rubro) => {
              const progress = calculateRubricProgress(rubro, reports);
              const progressLabel = Math.round(progress);
              const executed = calculateTotalExecuted(rubro.id, reports);
              const latest = getLatestRubricEntry(rubro.id, reports);
              const report = latest ? reports.find((item) => item.entries.some((entry) => entry.id === latest.id)) : null;
              const productionSummary = getRubricProductionSummary(rubro);
              return (
                <div key={rubro.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-next-text">{rubro.nombre}</p>
                      <p className="mt-1 text-xs font-semibold text-next-muted">
                        Total previsto: {rubro.cantidadTotalPrevista} {formatUnitLabel(rubro.unidad, rubro.cantidadTotalPrevista)} | {productionSummary} | Instalado: {executed} / {rubro.cantidadTotalPrevista} | Peso {rubro.pesoOperativo}%
                      </p>
                    </div>
                    <span className="text-xl font-black text-next-blue">{progressLabel}%</span>
                  </div>
                  <ProgressBar value={progressLabel} />
                  {rubro.items?.length ? (
                    <div className="mt-3 space-y-2 rounded-md bg-next-bg p-3">
                      <p className="text-xs font-black uppercase text-next-blue">Desglose detallado</p>
                      {rubro.items.map((item) => {
                        const unit = normalizeUnit(item.unidadProduccion ?? "unidad") || "unidad";
                        const m2Total = item.m2Total ?? calculateM2Total(item.ancho, item.alto, item.cantidad);
                        const m2Unit = item.metrosCuadradosPorUnidad ?? item.m2Unitario ?? calculateM2Total(item.ancho, item.alto, 1);
                        const itemProduced = item.cantidadProducida ?? 0;
                        const itemTotal = item.cantidad;
                        const m2Produced = Math.round(itemProduced * m2Unit * 100) / 100;
                        return (
                          <div key={item.id} className="rounded-md bg-white px-3 py-2 ring-1 ring-slate-100">
                            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                              <div className="min-w-0">
                                <p className="text-sm font-black text-next-text">{item.descripcion}</p>
                                <p className="mt-1 text-xs font-semibold text-next-muted">
                                  Medida: {item.ancho && item.alto ? `${item.ancho} x ${item.alto}` : "Sin medidas"} | Cantidad: {item.cantidad} {formatUnitLabel(unit, item.cantidad)} | m2 por unidad: {m2Unit || "-"} | m2 total: {m2Total || "-"}
                                </p>
                              </div>
                              <div className="grid gap-1 text-xs font-black text-next-muted sm:min-w-44">
                                <span>Producido: {itemProduced} / {itemTotal} {formatUnitLabel(unit, itemTotal)}</span>
                                <span>Equivale a: {m2Produced} / {m2Total} m2</span>
                                <span>Instalado: se registra por reportes del rubro</span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                  <div className="mt-3 grid gap-2 text-xs font-semibold text-next-muted sm:grid-cols-2">
                    <span>Ultima actualizacion: {report ? `${formatDateShort(report.fecha)} ${report.hora}` : "Sin reportes"}</span>
                    <span>Responsable: {report?.userName ?? "Pendiente"}</span>
                    <span>Fuente: {latest?.modo === "manual" ? "Ajuste manual justificado" : "Cantidad instalada reportada"}</span>
                    <span>{latest?.observacion || latest?.justificacionManual || "Sin observacion"}</span>
                  </div>
                </div>
              );
            }) : <EmptyState text="Avance sin configurar. Defini rubros, cantidades y pesos para comenzar." />}
          </div>
        </DataCard>

        <DataCard title="Produccion">
          <div className="space-y-3">
            {rubrics.some((rubro) => rubro.requiereProduccion || rubro.items?.some((item) => item.fabricarEnTaller)) ? rubrics.map((rubro) => (
              <ProductionPreview key={rubro.id} rubro={rubro} />
            )) : (
              <EmptyState text="No hay rubros o items marcados para fabricar en taller." />
            )}
          </div>
        </DataCard>

        <DataCard title="Instalacion">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Cuadrilla" value={activeFieldWorkday?.equipoNombre ?? activeCrew?.nombre ?? "Sin cuadrilla activa actualmente"} />
            <Metric label="Estado de jornada" value={activeFieldWorkday ? activeFieldWorkday.estado : activeCrew ? activeCrew.estado : "Sin jornada activa"} />
            <Metric label="Hora inicio" value={activeFieldWorkday?.horaInicio || activeCrew?.horaInicio || "--:--"} />
            <Metric label="Ultimo avance" value={latestReport ? `${latestReport.hora} · ${latestReport.userName}` : "Sin reportes"} />
          </div>
        </DataCard>

        <DataCard title="Tareas de la obra">
          <div className="space-y-3">
            {tasks.length ? tasks.map((task) => (
              <div key={task.id} className="rounded-md border border-slate-100 p-3">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <p className="text-sm font-black text-next-text">{task.titulo}</p>
                    <p className="mt-1 text-xs font-semibold text-next-muted">
                      Asignado a {task.asignadoANombre || "Sin asignar"} · {task.fechaAsignada ? formatDateShort(task.fechaAsignada) : "Sin fecha"}
                    </p>
                    {task.rubroNombre && task.cantidadReportada ? (
                      <p className="mt-2 rounded-md bg-orange-50 px-2 py-1 text-xs font-black text-next-orange">
                        Tarea reporto {task.cantidadReportada} {formatUnitLabel(task.unidad, task.cantidadReportada)} para {task.rubroNombre}. Pendiente de validacion.
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge label={taskStatusLabel(task.estado)} status={badgeForTask(task.estado)} />
                </div>
                <div className="mt-3 grid gap-2 text-xs font-semibold text-next-muted sm:grid-cols-3">
                  <span>Fotos: {task.fotos?.length ?? 0}</span>
                  <span>Cantidad: {task.cantidadPrevista ? `${task.cantidadPrevista} ${formatUnitLabel(task.unidad, task.cantidadPrevista)}` : "No aplica"}</span>
                  <span>{task.observacionCampo || task.observacionFiscalizador || "Sin observacion"}</span>
                </div>
              </div>
            )) : <EmptyState text="No hay tareas creadas para esta obra." />}
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
                      {material.cantidad} {formatUnitLabel(material.unidad, material.cantidad)} · Reportado por {material.reportadoPor} · {formatDateShort(material.fechaReporte)}
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
                      <span className="font-black text-next-text">{entry.rubroNombre}</span>: {Math.round(entry.porcentajeAnterior)}% → {Math.round(entry.porcentajeNuevo)}%
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

function ProductionChecklistEditor({
  canEdit,
  onSave,
  stages,
  updatedBy
}: {
  canEdit: boolean;
  onSave: (stages: ProductionStage[]) => Promise<void>;
  stages: ProductionStage[];
  updatedBy: string;
}) {
  const [items, setItems] = useState<ProductionStage[]>(() => normalizeProductionStages(stages));
  const [saving, setSaving] = useState(false);
  const completed = items.filter((stage) => stage.estado === "Completado").length;

  useEffect(() => {
    setItems(normalizeProductionStages(stages));
  }, [stages]);

  function updateStage(id: string, data: Partial<ProductionStage>) {
    const timestamp = new Date().toISOString();
    setItems((current) =>
      current.map((stage) =>
        stage.id === id
          ? { ...stage, ...data, updatedAt: timestamp, updatedBy }
          : stage
      )
    );
  }

  function addStage() {
    const timestamp = new Date().toISOString();
    setItems((current) => [
      ...current,
      {
        id: `stage-${timestamp}-${current.length + 1}`,
        nombre: "Nueva etapa",
        estado: "Pendiente",
        updatedAt: timestamp,
        updatedBy
      }
    ]);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(items.filter((stage) => stage.nombre.trim()).map((stage) => ({
        ...stage,
        nombre: stage.nombre.trim()
      })));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <p className="text-sm font-black text-next-blue">
          Produccion: {completed}/{items.length} etapas completadas
        </p>
        {canEdit ? (
          <button className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={addStage}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Agregar etapa
          </button>
        ) : null}
      </div>

      {items.length ? items.map((stage) => (
        <div key={stage.id} className="grid gap-2 rounded-md border border-slate-100 px-3 py-2 sm:grid-cols-[minmax(0,1fr)_160px_36px] sm:items-center">
          {canEdit ? (
            <input
              className="field h-9"
              value={stage.nombre}
              onChange={(event) => updateStage(stage.id, { nombre: event.target.value })}
            />
          ) : (
            <span className="text-sm font-bold text-next-text">{stage.nombre}</span>
          )}
          {canEdit ? (
            <select
              className="field h-9"
              value={stage.estado}
              onChange={(event) => updateStage(stage.id, { estado: event.target.value as ProductionStageStatus })}
            >
              <option>Pendiente</option>
              <option>En proceso</option>
              <option>Completado</option>
            </select>
          ) : (
            <StatusBadge label={stage.estado} status={stage.estado === "Completado" ? "success" : stage.estado === "En proceso" ? "info" : "warning"} />
          )}
          {canEdit ? (
            <button
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-100 text-next-red"
              type="button"
              onClick={() => setItems((current) => current.filter((item) => item.id !== stage.id))}
              title="Eliminar etapa"
              aria-label="Eliminar etapa"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : null}
          {stage.updatedAt ? (
            <p className="text-[11px] font-semibold text-next-muted sm:col-span-3">
              Actualizado por {stage.updatedBy ?? "Sistema"} · {formatDateTime(stage.updatedAt)}
            </p>
          ) : null}
        </div>
      )) : <EmptyState text="Todavia no hay etapas de produccion." />}

      {canEdit ? (
        <button className="h-10 w-full rounded-md bg-next-blue px-3 text-xs font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={save}>
          {saving ? "Guardando..." : "Guardar checklist"}
        </button>
      ) : null}
    </div>
  );
}

function normalizeProductionStages(stages: ProductionStage[]): ProductionStage[] {
  if (stages.length) return stages;
  return ["Medicion", "Planos", "Compra aluminio", "Compra vidrio", "Corte", "Armado", "Vidriado", "Embalaje"].map((nombre, index) => ({
    id: `stage-base-${index + 1}`,
    nombre,
    estado: "Pendiente" as ProductionStageStatus
  }));
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
          <div className="hidden grid-cols-[1.3fr_110px_150px_120px_130px_80px] gap-2 px-3 text-[11px] font-black uppercase text-next-muted lg:grid">
            <span>Rubro</span>
            <span>Unidad</span>
            <span>Cantidad total prevista</span>
            <span>Peso del rubro</span>
            <span>Avance manual</span>
            <span>Acciones</span>
          </div>
          <div className="space-y-3">
            {rows.map((row, index) => (
              <div key={row.id ?? index} className="grid gap-2 rounded-lg border border-slate-200 p-3 lg:grid-cols-[1.3fr_110px_150px_120px_130px_80px]">
                <LabeledCell label="Rubro"><input className="field" required value={row.nombre} onChange={(event) => updateRow(index, { nombre: event.target.value })} /></LabeledCell>
                <LabeledCell label="Unidad">
                  <select className="field" required value={normalizeUnit(row.unidad)} onChange={(event) => updateRow(index, { unidad: normalizeUnit(event.target.value) })}>
                    <option value="" disabled>Seleccionar unidad</option>
                    <option value="m2">m²</option>
                    <option value="unidad">unidad</option>
                  </select>
                </LabeledCell>
                <LabeledCell label="Cantidad total prevista"><input className="field" min={0} required type="number" value={row.cantidadTotalPrevista} onChange={(event) => updateRow(index, { cantidadTotalPrevista: event.target.value })} /></LabeledCell>
                <LabeledCell label="Peso del rubro"><input className="field" max={100} min={0} required type="number" value={row.pesoOperativo} onChange={(event) => updateRow(index, { pesoOperativo: event.target.value })} /></LabeledCell>
                <LabeledCell label="Avance manual">
                  <select className="field" value={row.avanceManualPermitido ? "manual" : "cantidad"} onChange={(event) => updateRow(index, { modoCalculo: event.target.value as ProgressCalculationMode, avanceManualPermitido: event.target.value === "manual" })}>
                    <option value="cantidad">No</option>
                    <option value="manual">Si</option>
                  </select>
                </LabeledCell>
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
                unidad: "unidad",
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

function ProductionPreview({ rubro }: { rubro: WorkProgressRubric }) {
  const rows = getProductionPreviewRows(rubro);
  if (!rows.length) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-100 p-3">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black text-next-text">{rubro.nombre}</p>
          <p className="mt-1 text-xs font-semibold text-next-muted">
            Produccion de taller separada del avance instalado en obra.
          </p>
        </div>
        <span className="rounded-md bg-next-light px-2 py-1 text-xs font-black text-next-blue">
          {rows.length} item(s)
        </span>
      </div>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-md bg-next-bg px-3 py-2">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="text-sm font-black text-next-text">{row.descripcion}</p>
                <p className="mt-1 text-xs font-semibold text-next-muted">
                  Medida: {row.medida} | Cantidad: {row.total} {formatUnitLabel(row.unit, row.total)} | m2 unit.: {row.m2Unit || "-"} | m2 total: {row.m2Total || "-"}
                </p>
              </div>
              <div className="min-w-36">
                <div className="flex items-center justify-between gap-2 text-xs font-black text-next-muted">
                  <span>Producido</span>
                  <span>{row.produced}/{row.total}</span>
                </div>
                {row.m2Total ? (
                  <p className="mt-1 text-xs font-semibold text-next-muted">
                    Equivale a {row.m2Produced} / {row.m2Total} m2
                  </p>
                ) : null}
                <ProgressBar value={productionProgress(row.produced, row.total)} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LabeledCell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block min-w-0 text-[11px] font-black uppercase text-next-muted lg:text-transparent">
      {label}
      <div className="mt-1 lg:mt-0">{children}</div>
    </label>
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

function getRubricProductionSummary(rubro: WorkProgressRubric) {
  const productionItems = (rubro.items ?? []).filter((item) => item.fabricarEnTaller);
  if (productionItems.length) {
    const producedPieces = productionItems.reduce((sum, item) => sum + Number(item.cantidadProducida ?? 0), 0);
    const totalPieces = productionItems.reduce((sum, item) => sum + Number(item.cantidad || 0), 0);
    const producedM2 = productionItems.reduce((sum, item) => {
      const m2Unit = item.metrosCuadradosPorUnidad ?? item.m2Unitario ?? calculateM2Total(item.ancho, item.alto, 1);
      return sum + Number(item.cantidadProducida ?? 0) * m2Unit;
    }, 0);
    const totalM2 = productionItems.reduce((sum, item) => sum + (item.metrosCuadradosTotales ?? item.m2Total ?? calculateM2Total(item.ancho, item.alto, item.cantidad)), 0);
    return `Producido: ${roundLocal(producedPieces)} / ${roundLocal(totalPieces)} unidades | Eq. ${roundLocal(producedM2)} / ${roundLocal(totalM2)} m2`;
  }
  return `Producido: ${roundLocal(Number(rubro.cantidadProducida ?? 0))} / ${rubro.cantidadTotalPrevista}`;
}

function getProductionPreviewRows(rubro: WorkProgressRubric) {
  const itemRows = (rubro.items ?? [])
    .filter((item) => item.fabricarEnTaller)
    .map((item) => {
      const unit = normalizeUnit(item.unidadProduccion ?? "unidad") || "unidad";
      const total = item.cantidad;
      const m2Unit = item.metrosCuadradosPorUnidad ?? item.m2Unitario ?? calculateM2Total(item.ancho, item.alto, 1);
      const m2Total = item.metrosCuadradosTotales ?? item.m2Total ?? calculateM2Total(item.ancho, item.alto, item.cantidad);
      const produced = Number(item.cantidadProducida ?? 0);
      return {
        id: item.id,
        descripcion: item.descripcion || rubro.nombre,
        unit,
        total,
        produced,
        pending: Math.max(total - produced, 0),
        medida: item.ancho && item.alto ? `${item.ancho} x ${item.alto}` : "Sin medidas",
        m2Unit,
        m2Total,
        m2Produced: roundLocal(produced * m2Unit)
      };
    });

  if (itemRows.length) return itemRows;
  if (!rubro.requiereProduccion) return [];

  const unit = normalizeUnit(rubro.unidadPrincipal ?? rubro.unidad) || "unidad";
  const total = Number(rubro.cantidadTotalPrevista || 0);
  const produced = Number(rubro.cantidadProducida ?? 0);
  return [{
    id: rubro.id,
    descripcion: rubro.nombre,
    unit,
    total,
    produced,
    pending: Math.max(total - produced, 0),
    medida: "Carga simple",
    m2Unit: unit === "m2" ? 1 : 0,
    m2Total: unit === "m2" ? total : 0,
    m2Produced: unit === "m2" ? produced : 0
  }];
}

function roundLocal(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
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
  return "Seguimiento operativo actualizado.";
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

function taskStatusLabel(status: FieldTask["estado"]) {
  const labels: Record<FieldTask["estado"], string> = {
    pendiente: "Pendiente",
    asignada: "Asignada",
    en_proceso: "En proceso",
    reportada: "Reportada",
    completada: "Completada",
    observada: "Observada",
    cancelada: "Cancelada"
  };
  return labels[status];
}

function badgeForTask(status: FieldTask["estado"]): BadgeStatus {
  if (status === "completada") return "success";
  if (status === "reportada") return "warning";
  if (status === "observada" || status === "cancelada") return "critical";
  return "info";
}
