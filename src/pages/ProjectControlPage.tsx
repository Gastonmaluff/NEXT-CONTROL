import {
  Building2,
  CalendarDays,
  CircleDollarSign,
  Pencil,
  Plus,
  Save,
  Trash2,
  UserRound
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import DataCard from "../components/ui/DataCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import {
  createActividad,
  createCobro,
  createObra,
  deleteObra,
  getActividadesByObra,
  getCobrosByObra,
  getObras,
  updateObra
} from "../lib/firestore";
import { generateId } from "../lib/storage";
import type {
  Actividad,
  Cobro,
  MaterialStatus,
  MissingMaterial,
  Obra,
  PaymentMethod,
  ProductionStageStatus,
  WorkStatus
} from "../types";
import { formatCurrencyPYG, formatDateShort, formatDateTime, getTodayInputDate } from "../utils/formatters";
import { calculateWeightedProgress } from "../utils/progress";

const workStatuses: WorkStatus[] = [
  "Prospecto",
  "Presupuesto enviado",
  "Seguimiento",
  "Aprobado",
  "Produccion",
  "Instalacion",
  "Facturacion",
  "Cobrado",
  "Finalizada",
  "Pausada",
  "Atrasada"
];

const paymentMethods: PaymentMethod[] = ["Efectivo", "Transferencia", "Cheque", "Otro"];
const productionStatuses: ProductionStageStatus[] = ["Pendiente", "En proceso", "Completado"];

const emptyObraForm = {
  nombre: "",
  cliente: "",
  arquitecto: "",
  ubicacion: "",
  montoAprobado: "",
  fechaInicio: getTodayInputDate(),
  fechaEntrega: getTodayInputDate(),
  responsable: "",
  estado: "Prospecto" as WorkStatus,
  saldoPendienteCobro: ""
};

export default function ProjectControlPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [obraForm, setObraForm] = useState(emptyObraForm);
  const [cobros, setCobros] = useState<Cobro[]>([]);
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
  const [cobroForm, setCobroForm] = useState({
    fecha: getTodayInputDate(),
    monto: "",
    medio: "Transferencia" as PaymentMethod,
    observacion: ""
  });

  const selectedObra = obras.find((obra) => obra.id === selectedId) ?? obras[0];

  useEffect(() => {
    loadObras();
  }, []);

  useEffect(() => {
    if (!selectedObra) {
      return;
    }

    loadObraDetails(selectedObra.id);
  }, [selectedObra?.id]);

  const filteredObras = useMemo(() => {
    return obras.filter((obra) => {
      const matchesQuery = `${obra.nombre} ${obra.cliente}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "Todos" || obra.estado === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [obras, query, statusFilter]);

  const totalCobrado = cobros.reduce((sum, cobro) => sum + cobro.monto, 0);
  const overallProgress = selectedObra ? calculateWeightedProgress(selectedObra.rubrosAvance) : 0;
  const weightSum = selectedObra?.rubrosAvance.reduce((sum, rubro) => sum + rubro.peso, 0) ?? 0;

  async function loadObras() {
    setLoading(true);
    setError("");
    try {
      const loaded = await getObras();
      setObras(loaded);
      setSelectedId((current) => current || loaded[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las obras.");
    } finally {
      setLoading(false);
    }
  }

  async function loadObraDetails(obraId: string) {
    try {
      setCobros(await getCobrosByObra(obraId));
      setActividades(await getActividadesByObra(obraId));
    } catch (detailError) {
      setError(detailError instanceof Error ? detailError.message : "No se pudo cargar el detalle.");
    }
  }

  function openCreateForm() {
    setEditing(false);
    setObraForm(emptyObraForm);
    setShowForm(true);
  }

  function openEditForm() {
    if (!selectedObra) return;
    setEditing(true);
    setObraForm({
      nombre: selectedObra.nombre,
      cliente: selectedObra.cliente,
      arquitecto: selectedObra.arquitecto,
      ubicacion: selectedObra.ubicacion,
      montoAprobado: String(selectedObra.montoAprobado),
      fechaInicio: selectedObra.fechaInicio,
      fechaEntrega: selectedObra.fechaEntrega,
      responsable: selectedObra.responsable,
      estado: selectedObra.estado,
      saldoPendienteCobro: String(selectedObra.saldoPendienteCobro)
    });
    setShowForm(true);
  }

  async function handleSaveObra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setError("");

    const payload = {
      nombre: obraForm.nombre,
      cliente: obraForm.cliente,
      arquitecto: obraForm.arquitecto,
      ubicacion: obraForm.ubicacion,
      montoAprobado: Number(obraForm.montoAprobado),
      fechaInicio: obraForm.fechaInicio,
      fechaEntrega: obraForm.fechaEntrega,
      responsable: obraForm.responsable,
      estado: obraForm.estado,
      saldoPendienteCobro: Number(obraForm.saldoPendienteCobro || obraForm.montoAprobado),
      rubrosAvance: selectedObra?.rubrosAvance ?? [],
      etapasProduccion: selectedObra?.etapasProduccion ?? [],
      materialesFaltantes: selectedObra?.materialesFaltantes ?? []
    };

    try {
      const saved = editing && selectedObra
        ? await updateObra(selectedObra.id, payload)
        : await createObra(payload);
      setMessage(editing ? "Obra actualizada." : "Nueva obra creada.");
      setShowForm(false);
      await loadObras();
      setSelectedId(saved.id);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la obra.");
    }
  }

  async function handleDeleteObra() {
    if (!selectedObra || !window.confirm(`Eliminar ${selectedObra.nombre}?`)) return;

    try {
      await deleteObra(selectedObra.id);
      setMessage("Obra eliminada.");
      setSelectedId("");
      await loadObras();
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "No se pudo eliminar la obra.");
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
        usuario: "Admin",
        fecha: new Date().toISOString()
      });
      await loadObraDetails(selectedObra.id);
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
      await loadObraDetails(selectedObra.id);
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
    }, "Material faltante agregado.");
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
      await loadObraDetails(selectedObra.id);
    }
  }

  async function deleteMaterial(materialId: string) {
    if (!selectedObra) return;
    await updateSelectedObra({
      materialesFaltantes: selectedObra.materialesFaltantes.filter((material) => material.id !== materialId)
    }, "Material eliminado.");
  }

  async function handleCreateCobro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedObra || !cobroForm.monto) return;

    try {
      await createCobro({
        obraId: selectedObra.id,
        fecha: cobroForm.fecha,
        monto: Number(cobroForm.monto),
        medio: cobroForm.medio,
        observacion: cobroForm.observacion
      });
      setCobroForm({ fecha: getTodayInputDate(), monto: "", medio: "Transferencia", observacion: "" });
      setMessage("Cobro registrado.");
      await loadObras();
      await loadObraDetails(selectedObra.id);
    } catch (cobroError) {
      setError(cobroError instanceof Error ? cobroError.message : "No se pudo registrar el cobro.");
    }
  }

  if (loading) {
    return <StateCard text="Cargando obras..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Operaciones</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">CONTROL DE OBRA</h1>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy"
          type="button"
          onClick={openCreateForm}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva obra
        </button>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <DataCard title="Obras" subtitle="Lista conectada a Firestore o demo local.">
          <div className="space-y-3">
            <input
              className="h-11 w-full rounded-md border border-slate-200 bg-next-bg px-3 text-sm outline-none focus:border-next-blue focus:bg-white focus:ring-4 focus:ring-next-blue/10"
              placeholder="Buscar por obra o cliente"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="h-11 w-full rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-next-blue focus:ring-4 focus:ring-next-blue/10"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option>Todos</option>
              {workStatuses.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>

            <div className="max-h-[580px] space-y-3 overflow-y-auto pr-1">
              {filteredObras.length ? (
                filteredObras.map((obra) => (
                  <button
                    key={obra.id}
                    className={`w-full rounded-lg border px-3 py-3 text-left transition ${
                      obra.id === selectedObra?.id
                        ? "border-next-blue bg-next-light"
                        : "border-slate-100 bg-white hover:border-next-blue/40"
                    }`}
                    type="button"
                    onClick={() => setSelectedId(obra.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-next-text">{obra.nombre}</p>
                        <p className="mt-1 truncate text-xs font-semibold text-next-muted">{obra.cliente}</p>
                      </div>
                      <StatusBadge label={obra.estado} status={badgeForWork(obra.estado)} />
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={calculateWeightedProgress(obra.rubrosAvance)} />
                    </div>
                  </button>
                ))
              ) : (
                <EmptyState text="No hay obras con esos filtros." />
              )}
            </div>
          </div>
        </DataCard>

        <div className="space-y-5">
          {showForm ? (
            <DataCard title={editing ? "Editar obra" : "Nueva obra"}>
              <ObraForm
                values={obraForm}
                onChange={setObraForm}
                onSubmit={handleSaveObra}
                onCancel={() => setShowForm(false)}
              />
            </DataCard>
          ) : null}

          {selectedObra ? (
            <>
              <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-soft lg:grid-cols-[300px_1fr]">
                <div className="flex min-h-56 items-center justify-center rounded-lg bg-gradient-to-br from-next-light via-white to-slate-200">
                  <Building2 className="h-24 w-24 text-next-blue/70" aria-hidden="true" />
                </div>
                <div className="space-y-5">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div>
                      <h2 className="text-3xl font-black text-next-text">{selectedObra.nombre}</h2>
                      <p className="mt-1 text-sm font-semibold text-next-muted">
                        Cliente: {selectedObra.cliente}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <StatusBadge label={selectedObra.estado} status={badgeForWork(selectedObra.estado)} />
                      <button className="icon-button" type="button" onClick={openEditForm} title="Editar obra">
                        <Pencil className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button className="icon-button text-next-red" type="button" onClick={handleDeleteObra} title="Eliminar obra">
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <InfoItem icon={CircleDollarSign} label="Monto aprobado" value={formatCurrencyPYG(selectedObra.montoAprobado)} />
                    <InfoItem icon={CalendarDays} label="Fecha de entrega" value={formatDateShort(selectedObra.fechaEntrega)} />
                    <InfoItem icon={UserRound} label="Responsable" value={selectedObra.responsable} />
                    <InfoItem icon={CircleDollarSign} label="Saldo pendiente" value={formatCurrencyPYG(selectedObra.saldoPendienteCobro)} />
                  </div>

                  <div className="rounded-lg bg-next-bg p-4">
                    <div className="mb-2 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-black text-next-text">Avance general</p>
                        <p className="text-xs font-semibold text-next-muted">
                          El avance general se calcula por avance fisico ponderado, no por presupuesto consumido.
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

              <section className="grid gap-5 xl:grid-cols-2">
                <DataCard title="Avance por rubro">
                  <div className="space-y-5">
                    {selectedObra.rubrosAvance.map((rubro) => (
                      <div key={rubro.id} className="rounded-lg border border-slate-100 p-3">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <p className="text-sm font-black text-next-text">{rubro.nombre}</p>
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
                              onChange={(event) => handleRubroChange(rubro.id, "avance", Number(event.target.value))}
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
                              onChange={(event) => handleRubroChange(rubro.id, "peso", Number(event.target.value))}
                            />
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </DataCard>

                <DataCard title="Produccion">
                  <div className="space-y-3">
                    {selectedObra.etapasProduccion.map((stage) => (
                      <div key={stage.id} className="flex items-center justify-between gap-3 rounded-md border border-slate-100 px-3 py-2">
                        <span className="text-sm font-bold text-next-text">{stage.nombre}</span>
                        <select
                          className="h-10 rounded-md border border-slate-200 bg-white px-2 text-xs font-black outline-none focus:border-next-blue"
                          value={stage.estado}
                          onChange={(event) => handleProductionChange(stage.id, event.target.value as ProductionStageStatus)}
                        >
                          {productionStatuses.map((status) => (
                            <option key={status}>{status}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </DataCard>

                <DataCard title="Materiales faltantes">
                  <form className="mb-4 grid gap-2 sm:grid-cols-[1fr_90px_110px] xl:grid-cols-[1fr_90px_110px]" onSubmit={handleAddMaterial}>
                    <input className="field" placeholder="Material" value={newMaterial.material} onChange={(event) => setNewMaterial({ ...newMaterial, material: event.target.value })} />
                    <input className="field" placeholder="Cant." type="number" value={newMaterial.cantidad} onChange={(event) => setNewMaterial({ ...newMaterial, cantidad: event.target.value })} />
                    <input className="field" placeholder="Unidad" value={newMaterial.unidad} onChange={(event) => setNewMaterial({ ...newMaterial, unidad: event.target.value })} />
                    <input className="field sm:col-span-2" placeholder="Observacion" value={newMaterial.observacion} onChange={(event) => setNewMaterial({ ...newMaterial, observacion: event.target.value })} />
                    <button className="h-10 rounded-md bg-next-blue px-3 text-xs font-black text-white" type="submit">Agregar</button>
                  </form>
                  <div className="space-y-3">
                    {selectedObra.materialesFaltantes.map((material) => (
                      <MaterialRow
                        key={material.id}
                        material={material}
                        onChange={(data) => updateMaterial(material.id, data)}
                        onDelete={() => deleteMaterial(material.id)}
                      />
                    ))}
                  </div>
                </DataCard>

                <DataCard title="Cobros">
                  <div className="mb-4 grid gap-3 sm:grid-cols-4">
                    <Metric label="Aprobado" value={formatCurrencyPYG(selectedObra.montoAprobado)} />
                    <Metric label="Cobrado" value={formatCurrencyPYG(totalCobrado)} />
                    <Metric label="Pendiente" value={formatCurrencyPYG(selectedObra.saldoPendienteCobro)} />
                    <Metric label="% cobrado" value={`${Math.round((totalCobrado / Math.max(selectedObra.montoAprobado, 1)) * 100)}%`} />
                  </div>
                  <form className="grid gap-2 sm:grid-cols-2" onSubmit={handleCreateCobro}>
                    <input className="field" type="date" value={cobroForm.fecha} onChange={(event) => setCobroForm({ ...cobroForm, fecha: event.target.value })} />
                    <input className="field" type="number" placeholder="Monto" value={cobroForm.monto} onChange={(event) => setCobroForm({ ...cobroForm, monto: event.target.value })} />
                    <select className="field" value={cobroForm.medio} onChange={(event) => setCobroForm({ ...cobroForm, medio: event.target.value as PaymentMethod })}>
                      {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                    </select>
                    <input className="field" placeholder="Observacion" value={cobroForm.observacion} onChange={(event) => setCobroForm({ ...cobroForm, observacion: event.target.value })} />
                    <button className="h-10 rounded-md bg-next-blue px-3 text-xs font-black text-white sm:col-span-2" type="submit">Registrar cobro</button>
                  </form>
                  <div className="mt-4 space-y-2">
                    {cobros.map((cobro) => (
                      <div key={cobro.id} className="flex justify-between gap-3 rounded-md bg-next-bg px-3 py-2 text-sm">
                        <span className="font-bold text-next-text">{formatDateShort(cobro.fecha)} · {cobro.medio}</span>
                        <span className="font-black text-next-blue">{formatCurrencyPYG(cobro.monto)}</span>
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
            </>
          ) : (
            <EmptyState text="Crea una obra para empezar." />
          )}
        </div>
      </section>
    </div>
  );
}

function ObraForm({
  values,
  onChange,
  onSubmit,
  onCancel
}: {
  values: typeof emptyObraForm;
  onChange: (values: typeof emptyObraForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onCancel: () => void;
}) {
  return (
    <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
      <input className="field" required placeholder="Nombre de obra" value={values.nombre} onChange={(event) => onChange({ ...values, nombre: event.target.value })} />
      <input className="field" required placeholder="Cliente" value={values.cliente} onChange={(event) => onChange({ ...values, cliente: event.target.value })} />
      <input className="field" placeholder="Arquitecto" value={values.arquitecto} onChange={(event) => onChange({ ...values, arquitecto: event.target.value })} />
      <input className="field" placeholder="Ubicacion" value={values.ubicacion} onChange={(event) => onChange({ ...values, ubicacion: event.target.value })} />
      <input className="field" required type="number" placeholder="Monto aprobado" value={values.montoAprobado} onChange={(event) => onChange({ ...values, montoAprobado: event.target.value })} />
      <input className="field" type="number" placeholder="Saldo pendiente de cobro" value={values.saldoPendienteCobro} onChange={(event) => onChange({ ...values, saldoPendienteCobro: event.target.value })} />
      <input className="field" type="date" value={values.fechaInicio} onChange={(event) => onChange({ ...values, fechaInicio: event.target.value })} />
      <input className="field" type="date" value={values.fechaEntrega} onChange={(event) => onChange({ ...values, fechaEntrega: event.target.value })} />
      <input className="field" placeholder="Responsable" value={values.responsable} onChange={(event) => onChange({ ...values, responsable: event.target.value })} />
      <select className="field" value={values.estado} onChange={(event) => onChange({ ...values, estado: event.target.value as WorkStatus })}>
        {workStatuses.map((status) => <option key={status}>{status}</option>)}
      </select>
      <div className="flex gap-2 sm:col-span-2">
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="submit">
          <Save className="h-4 w-4" aria-hidden="true" />
          Guardar
        </button>
        <button className="h-11 rounded-md border border-slate-200 bg-white px-4 text-sm font-black text-next-muted" type="button" onClick={onCancel}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function MaterialRow({
  material,
  onChange,
  onDelete
}: {
  material: MissingMaterial;
  onChange: (data: Partial<MissingMaterial>) => void;
  onDelete: () => void;
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
      <button className="mt-2 inline-flex h-9 items-center gap-2 rounded-md border border-red-100 px-3 text-xs font-black text-next-red" type="button" onClick={onDelete}>
        <Trash2 className="h-4 w-4" aria-hidden="true" />
        Eliminar
      </button>
    </div>
  );
}

function InfoItem({ icon: Icon, label, value }: { icon: typeof CircleDollarSign; label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-100 bg-next-bg px-3 py-3">
      <Icon className="mb-3 h-5 w-5 text-next-blue" aria-hidden="true" />
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-next-text">{value}</p>
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

function badgeForWork(status: WorkStatus): BadgeStatus {
  if (status === "Atrasada" || status === "Pausada") return "critical";
  if (status === "Prospecto" || status === "Presupuesto enviado" || status === "Seguimiento") return "warning";
  if (status === "Finalizada" || status === "Cobrado") return "success";
  if (status === "Produccion" || status === "Instalacion" || status === "Facturacion") return "info";
  return "neutral";
}
