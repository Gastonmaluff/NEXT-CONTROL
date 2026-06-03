import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Camera,
  ClipboardCheck,
  Image as ImageIcon,
  Package,
  Pencil,
  Trash2,
  UserRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import DataCard from "../components/ui/DataCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import {
  createActividad,
  deleteObra,
  getActividadesByObra,
  getObras,
  updateObra
} from "../lib/firestore";
import { generateId } from "../lib/storage";
import type {
  Actividad,
  MaterialStatus,
  MissingMaterial,
  Obra,
  ProductionStageStatus,
  WorkStatus
} from "../types";
import { formatDateShort, formatDateTime } from "../utils/formatters";
import { calculateWeightedProgress } from "../utils/progress";

const workStatuses: WorkStatus[] = [
  "Produccion",
  "Instalacion",
  "Atrasada",
  "Pausada",
  "Finalizada",
  "Aprobado",
  "Facturacion"
];

const productionStatuses: ProductionStageStatus[] = ["Pendiente", "En proceso", "Completado"];

export default function ProjectControlPage() {
  const { obraId } = useParams();
  const navigate = useNavigate();
  const [obras, setObras] = useState<Obra[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [actividades, setActividades] = useState<Actividad[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [newMaterial, setNewMaterial] = useState({
    material: "",
    cantidad: "",
    unidad: "",
    observacion: ""
  });

  const selectedObra = obraId ? obras.find((obra) => obra.id === obraId) ?? null : null;

  useEffect(() => {
    loadObras();
  }, []);

  useEffect(() => {
    if (selectedObra) {
      loadActivities(selectedObra.id);
    }
  }, [selectedObra?.id]);

  const filteredObras = useMemo(() => {
    return obras.filter((obra) => {
      const matchesQuery = `${obra.nombre} ${obra.cliente} ${obra.responsable} ${obra.supervisor ?? ""}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesStatus = statusFilter === "Todos" || obra.estado === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [obras, query, statusFilter]);

  async function loadObras() {
    setLoading(true);
    setError("");
    try {
      setObras(await getObras());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las obras.");
    } finally {
      setLoading(false);
    }
  }

  async function loadActivities(id: string) {
    try {
      setActividades(await getActividadesByObra(id));
    } catch (activityError) {
      setError(activityError instanceof Error ? activityError.message : "No se pudo cargar la actividad.");
    }
  }

  async function updateSelectedObra(data: Partial<Obra>, success = "Cambios guardados.") {
    if (!selectedObra) return;

    try {
      const updated = await updateObra(selectedObra.id, data);
      setObras((current) => current.map((obra) => (obra.id === updated.id ? updated : obra)));
      setMessage(success);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo guardar el cambio.");
    }
  }

  async function handleDeleteObra() {
    if (!selectedObra || !window.confirm(`Eliminar ${selectedObra.nombre}?`)) return;

    try {
      await deleteObra(selectedObra.id);
      setMessage("Obra eliminada.");
      await loadObras();
      navigate("/avance-obras");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la obra.");
    }
  }

  async function handleRubroChange(rubroId: string, field: "peso" | "avance", value: number) {
    if (!selectedObra) return;
    const nextRubros = selectedObra.rubrosAvance.map((rubro) =>
      rubro.id === rubroId ? { ...rubro, [field]: Math.max(0, Math.min(100, value)) } : rubro
    );
    const changed = nextRubros.find((rubro) => rubro.id === rubroId);
    await updateSelectedObra({ rubrosAvance: nextRubros }, "Avance actualizado.");

    if (field === "avance" && changed) {
      await createActividad({
        obraId: selectedObra.id,
        tipo: "avance",
        descripcion: `Se actualizo el avance de ${changed.nombre} a ${changed.avance}%.`,
        usuario: selectedObra.supervisor ?? selectedObra.responsable,
        fecha: new Date().toISOString()
      });
      await loadActivities(selectedObra.id);
    }
  }

  async function handleProductionChange(stageId: string, estado: ProductionStageStatus) {
    if (!selectedObra) return;
    const nextStages = selectedObra.etapasProduccion.map((stage) =>
      stage.id === stageId ? { ...stage, estado } : stage
    );
    const changed = nextStages.find((stage) => stage.id === stageId);
    await updateSelectedObra({ etapasProduccion: nextStages }, "Produccion actualizada.");
    if (changed) {
      await createActividad({
        obraId: selectedObra.id,
        tipo: "produccion",
        descripcion: `${changed.nombre} cambio a ${estado}.`,
        usuario: "Produccion",
        fecha: new Date().toISOString()
      });
      await loadActivities(selectedObra.id);
    }
  }

  async function handleAddMaterial(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedObra || !newMaterial.material) return;

    const material: MissingMaterial = {
      id: generateId("material"),
      material: newMaterial.material,
      cantidad: Number(newMaterial.cantidad),
      unidad: newMaterial.unidad,
      observacion: newMaterial.observacion,
      estado: "Pendiente",
      createdAt: new Date().toISOString()
    };
    await updateSelectedObra({
      materialesFaltantes: [material, ...selectedObra.materialesFaltantes]
    }, "Material pendiente agregado.");
    setNewMaterial({ material: "", cantidad: "", unidad: "", observacion: "" });
  }

  async function updateMaterial(materialId: string, data: Partial<MissingMaterial>) {
    if (!selectedObra) return;
    const nextMaterials = selectedObra.materialesFaltantes.map((material) =>
      material.id === materialId ? { ...material, ...data } : material
    );
    await updateSelectedObra({ materialesFaltantes: nextMaterials }, "Material actualizado.");

    if (data.estado === "Resuelto") {
      const material = nextMaterials.find((item) => item.id === materialId);
      await createActividad({
        obraId: selectedObra.id,
        tipo: "materiales",
        descripcion: `Material resuelto: ${material?.material ?? ""}.`,
        usuario: "Produccion",
        fecha: new Date().toISOString()
      });
      await loadActivities(selectedObra.id);
    }
  }

  if (loading) {
    return <StateCard text="Cargando avance de obras..." />;
  }

  if (obraId) {
    if (!selectedObra) {
      return (
        <div className="space-y-5">
          <button className="inline-flex items-center gap-2 text-sm font-black text-next-blue" type="button" onClick={() => navigate("/avance-obras")}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a Avance de obras
          </button>
          <EmptyState text="No se encontro esta obra." />
        </div>
      );
    }

    return (
      <ProgressDetail
        actividades={actividades}
        error={error}
        message={message}
        newMaterial={newMaterial}
        obra={selectedObra}
        onAddMaterial={handleAddMaterial}
        onBack={() => navigate("/avance-obras")}
        onDeleteObra={handleDeleteObra}
        onMaterialChange={updateMaterial}
        onProductionChange={handleProductionChange}
        onRubroChange={handleRubroChange}
        setNewMaterial={setNewMaterial}
      />
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
              obra={obra}
              onOpen={() => navigate(`/avance-obras/${obra.id}`)}
            />
          ))
        ) : (
          <EmptyState text="No hay obras con esos filtros." />
        )}
      </section>
    </div>
  );
}

function ProgressWorkCard({ obra, onOpen }: { obra: Obra; onOpen: () => void }) {
  const progress = calculateWeightedProgress(obra.rubrosAvance);
  const pendingMaterials = obra.materialesFaltantes.filter((item) => item.estado === "Pendiente").length;
  const isDelayed = obra.estado === "Atrasada";
  const summary = obra.observacionInicial || operationalSummary(obra, progress, pendingMaterials);
  const fiscalizador = cleanPersonLabel(obra.supervisor ?? obra.responsable);

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
                Fiscalizador: {fiscalizador}
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
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <SmallMetric label="Fecha comprometida" value={formatDateShort(obra.fechaComprometida ?? obra.fechaEntrega)} />
            <SmallMetric label="Encargado" value={obra.responsable} />
            <SmallMetric label="Materiales pendientes" value={`${pendingMaterials}`} tone={pendingMaterials ? "orange" : "green"} />
            <SmallMetric label="Ultima actualizacion" value={formatDateTime(obra.updatedAt)} />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className={`text-xs font-semibold leading-5 ${isDelayed ? "text-next-red" : "text-next-muted"}`}>
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
  error,
  message,
  newMaterial,
  obra,
  onAddMaterial,
  onBack,
  onDeleteObra,
  onMaterialChange,
  onProductionChange,
  onRubroChange,
  setNewMaterial
}: {
  actividades: Actividad[];
  error: string;
  message: string;
  newMaterial: { material: string; cantidad: string; unidad: string; observacion: string };
  obra: Obra;
  onAddMaterial: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onDeleteObra: () => void;
  onMaterialChange: (materialId: string, data: Partial<MissingMaterial>) => void;
  onProductionChange: (stageId: string, estado: ProductionStageStatus) => void;
  onRubroChange: (rubroId: string, field: "peso" | "avance", value: number) => void;
  setNewMaterial: (value: { material: string; cantidad: string; unidad: string; observacion: string }) => void;
}) {
  const overallProgress = calculateWeightedProgress(obra.rubrosAvance);
  const weightSum = obra.rubrosAvance.reduce((sum, rubro) => sum + rubro.peso, 0);
  const pendingMaterials = obra.materialesFaltantes.filter((item) => item.estado === "Pendiente");
  const completedStages = obra.etapasProduccion.filter((stage) => stage.estado === "Completado").length;
  const installedMeters = Math.round(overallProgress * 14.8);

  return (
    <div className="min-w-0 space-y-6">
      <button className="inline-flex items-center gap-2 text-sm font-black text-next-blue" type="button" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Volver a Avance de obras
      </button>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid min-w-0 gap-5 rounded-lg border border-slate-200 bg-white p-4 shadow-soft lg:grid-cols-[minmax(280px,34%)_minmax(0,1fr)] sm:p-5">
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
              <button className="icon-button" type="button" title="Editar datos operativos">
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
              <button className="icon-button text-next-red" type="button" onClick={onDeleteObra} title="Eliminar obra">
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
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
            {weightSum !== 100 ? (
              <p className="mt-3 text-xs font-black text-next-orange">
                La suma de pesos es {weightSum}%. Lo recomendado es 100%.
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
            <Metric label="M2 instalados" value={`Demo ${installedMeters} m2`} />
            <Metric label="Ultima actualizacion" value={formatDateTime(obra.updatedAt)} />
            <Metric
              label="Alerta de avance"
              value={obra.estado === "Atrasada" ? "Atrasada" : pendingMaterials.length ? "Materiales pendientes" : "En seguimiento"}
            />
          </div>
        </DataCard>

        <DataCard title="Avance por rubros">
          <div className="mb-4 rounded-md bg-next-light px-3 py-3 text-xs font-bold leading-5 text-next-blue">
            El avance se calcula por ejecucion fisica real, no por consumo de presupuesto.
          </div>
          <div className="space-y-5">
            {obra.rubrosAvance.map((rubro) => (
              <div key={rubro.id} className="rounded-lg border border-slate-100 p-3">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-next-text">{rubro.nombre}</p>
                    <p className="mt-0.5 text-xs font-semibold text-next-muted">Peso operativo: {rubro.peso}%</p>
                  </div>
                  <span className="text-sm font-black text-next-blue">{rubro.avance}%</span>
                </div>
                <ProgressBar value={rubro.avance} />
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase text-next-muted">
                    Avance
                    <input
                      className="mt-2 w-full accent-next-blue"
                      type="range"
                      min={0}
                      max={100}
                      value={rubro.avance}
                      onChange={(event) => onRubroChange(rubro.id, "avance", Number(event.target.value))}
                    />
                  </label>
                  <label className="text-xs font-bold uppercase text-next-muted">
                    Peso
                    <input
                      className="mt-2 h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-bold outline-none focus:border-next-blue"
                      type="number"
                      min={0}
                      max={100}
                      value={rubro.peso}
                      onChange={(event) => onRubroChange(rubro.id, "peso", Number(event.target.value))}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="Produccion">
          <div className="space-y-3">
            {obra.etapasProduccion.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2">
                <span className="text-sm font-bold text-next-text">{stage.nombre}</span>
                <select
                  className="h-10 rounded-md border border-slate-200 bg-white px-2 text-xs font-black outline-none focus:border-next-blue"
                  value={stage.estado}
                  onChange={(event) => onProductionChange(stage.id, event.target.value as ProductionStageStatus)}
                >
                  {productionStatuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="Instalacion">
          <div className="grid gap-3 sm:grid-cols-2">
            <Metric label="Cuadrilla asignada" value="Modulo movil" />
            <Metric label="M2 instalados esta semana" value={`Demo ${Math.max(40, Math.round(overallProgress * 3.2))} m2`} />
            <Metric label="Tareas" value="Se actualizan desde Instalaciones." />
            <Metric label="Observaciones" value={obra.observacionInicial || "Seguimiento operativo en curso."} />
          </div>
        </DataCard>

        <DataCard title="Materiales pendientes">
          <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_90px_110px]" onSubmit={onAddMaterial}>
            <input className="field" placeholder="Material" value={newMaterial.material} onChange={(event) => setNewMaterial({ ...newMaterial, material: event.target.value })} />
            <input className="field" placeholder="Cant." type="number" value={newMaterial.cantidad} onChange={(event) => setNewMaterial({ ...newMaterial, cantidad: event.target.value })} />
            <input className="field" placeholder="Unidad" value={newMaterial.unidad} onChange={(event) => setNewMaterial({ ...newMaterial, unidad: event.target.value })} />
            <input className="field sm:col-span-2" placeholder="Observacion" value={newMaterial.observacion} onChange={(event) => setNewMaterial({ ...newMaterial, observacion: event.target.value })} />
            <button className="h-10 rounded-md bg-next-blue px-3 text-xs font-black text-white" type="submit">Agregar</button>
          </form>
          <div className="space-y-3">
            {obra.materialesFaltantes.length ? obra.materialesFaltantes.map((material) => (
              <MaterialRow
                key={material.id}
                material={material}
                onChange={(data) => onMaterialChange(material.id, data)}
              />
            )) : <EmptyState text="No hay materiales pendientes." />}
          </div>
        </DataCard>

        <DataCard title="Observaciones">
          <div className="rounded-md bg-next-bg px-4 py-4 text-sm font-semibold leading-6 text-next-muted">
            {obra.observacionInicial || operationalSummary(obra, overallProgress, pendingMaterials.length)}
          </div>
        </DataCard>

        <DataCard title="Fotos de avance">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold leading-6 text-next-muted">
              Todavia no hay fotos cargadas.
            </p>
            <Camera className="h-5 w-5 text-next-blue" aria-hidden="true" />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="flex aspect-square items-center justify-center rounded-md bg-gradient-to-br from-next-light via-white to-slate-200 ring-1 ring-slate-200"
              >
                <ImageIcon className="h-5 w-5 text-next-blue/45" aria-hidden="true" />
              </div>
            ))}
          </div>
        </DataCard>

        <DataCard title="Actividad reciente">
          <ul className="space-y-3">
            {actividades.length ? actividades.map((activity) => (
              <li key={activity.id} className="rounded-md border border-slate-100 px-3 py-3 text-sm font-semibold leading-6 text-next-muted">
                <span className="font-black text-next-blue">{formatDateTime(activity.fecha)}</span>{" "}
                {activity.descripcion}
              </li>
            )) : <EmptyState text="Sin actividad registrada todavia." />}
          </ul>
        </DataCard>
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
        <img
          className="h-full w-full object-cover"
          src={imageUrl}
          alt={`Render de ${obra.nombre}`}
        />
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

function MaterialRow({
  material,
  onChange
}: {
  material: MissingMaterial;
  onChange: (data: Partial<MissingMaterial>) => void;
}) {
  return (
    <div className="rounded-md border border-slate-100 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_80px_100px]">
        <input className="field" value={material.material} onChange={(event) => onChange({ material: event.target.value })} />
        <input className="field" type="number" value={material.cantidad} onChange={(event) => onChange({ cantidad: Number(event.target.value) })} />
        <input className="field" value={material.unidad} onChange={(event) => onChange({ unidad: event.target.value })} />
        <input className="field sm:col-span-2" value={material.observacion} onChange={(event) => onChange({ observacion: event.target.value })} />
        <select className="field" value={material.estado} onChange={(event) => onChange({ estado: event.target.value as MaterialStatus })}>
          <option>Pendiente</option>
          <option>Resuelto</option>
        </select>
      </div>
    </div>
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

function SmallMetric({
  label,
  value,
  tone = "blue"
}: {
  label: string;
  value: string;
  tone?: "blue" | "green" | "orange" | "red";
}) {
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

function operationalSummary(obra: Obra, progress: number, pendingMaterials: number) {
  if (obra.estado === "Atrasada") return "La obra requiere seguimiento cercano por atraso operativo.";
  if (pendingMaterials) return "Hay materiales pendientes que pueden afectar el avance de instalacion.";
  if (progress >= 85) return "Obra en etapa final de control, instalacion y terminaciones.";
  if (obra.estado === "Produccion") return "Produccion en curso con seguimiento de rubros y compras tecnicas.";
  return "Seguimiento operativo activo con avance fisico actualizado por rubros.";
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
