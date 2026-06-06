import { ArrowLeft, Building2, ChevronDown, ChevronRight, Edit3, Eye, Plus, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CurrencyInput from "../components/ui/CurrencyInput";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import NewWorkWizard from "../components/work/NewWorkWizard";
import {
  createMovement,
  deleteMovement,
  getFinancialWorks,
  getMovementsByWork,
  updateFinancialWork
} from "../lib/firestore";
import type {
  FinancialMovement,
  FinancialMovementKind,
  FinancialPaymentMethod,
  FinancialStatus,
  Obra
} from "../types";
import {
  formatCompactGuarani,
  formatCurrencyPYG,
  formatDateShort,
  formatDateTime,
  getTodayInputDate
} from "../utils/formatters";
import {
  calculateFinancialStatus,
  calculateMargenActual,
  calculateResultadoActual,
  calculateSaldoPendiente,
  calculateTotalEgresos,
  calculateTotalIngresos,
  getTotalContratado,
  groupEgresosByCategoria,
  groupIngresosByCategoria
} from "../utils/finance";
import { toTitleCase } from "../utils/text";
import { formatUnitLabel, normalizeUnit } from "../utils/units";

const paymentMethods: FinancialPaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Cheque",
  "Credito",
  "Otro"
];

const categoriesByType: Record<FinancialMovementKind, string[]> = {
  ingreso: ["Anticipo", "Certificacion", "Pago parcial", "Pago final", "Retencion liberada", "Otro ingreso"],
  compra: ["Vidrio", "Aluminio", "Accesorios", "Herrajes", "ACM", "WPC", "Cielorrasos", "Otros materiales"],
  egreso: ["Mano de obra", "Instalacion", "Transporte", "Combustible", "Viaticos", "Alquiler de equipos", "Roturas", "Reprocesos", "Reclamos", "Otros egresos"]
};

const emptyWorkForm = {
  nombre: "",
  cliente: "",
  arquitecto: "",
  direccion: "",
  fechaInicio: getTodayInputDate(),
  fechaComprometida: getTodayInputDate(),
  presupuestoAprobado: "",
  adicionalesAprobados: "0",
  descuentos: "0",
  observacionInicial: ""
};

function emptyMovementForm(tipo: FinancialMovementKind) {
  return {
    tipo,
    fecha: getTodayInputDate(),
    concepto: "",
    categoria: categoriesByType[tipo][0],
    detalle: "",
    cantidad: "",
    unidad: "",
    metodoPago: (tipo === "ingreso" || tipo === "compra" ? "Cheque" : "Transferencia") as FinancialPaymentMethod,
    numeroCheque: "",
    fechaEmisionCheque: "",
    fechaCobroCheque: "",
    bancoCheque: "",
    monto: "",
    tercero: "",
    observacion: ""
  };
}

export default function FinancesPage() {
  const { obraId } = useParams();
  const navigate = useNavigate();
  const [works, setWorks] = useState<Obra[]>([]);
  const [allMovements, setAllMovements] = useState<FinancialMovement[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [workModal, setWorkModal] = useState<"edit" | null>(null);
  const [newWorkOpen, setNewWorkOpen] = useState(false);
  const [workForm, setWorkForm] = useState(emptyWorkForm);
  const [movementModal, setMovementModal] = useState<FinancialMovementKind | null>(null);
  const [movementForm, setMovementForm] = useState(emptyMovementForm("ingreso"));

  const selectedWork = works.find((work) => work.id === obraId) ?? null;
  const movements = useMemo(
    () => allMovements.filter((movement) => movement.obraId === selectedWork?.id),
    [allMovements, selectedWork?.id]
  );

  useEffect(() => {
    loadWorks();
  }, []);

  useEffect(() => {
    if (selectedWork) {
      loadMovements(selectedWork.id);
    }
  }, [selectedWork?.id]);

  const movementsByWork = useMemo(() => {
    return works.reduce<Record<string, FinancialMovement[]>>((acc, work) => {
      acc[work.id] = allMovements.filter((movement) => movement.obraId === work.id);
      return acc;
    }, {});
  }, [allMovements, works]);

  const filteredWorks = useMemo(() => {
    return works.filter((work) => {
      const workMovements = movementsByWork[work.id] ?? [];
      const status = calculateFinancialStatus(work, workMovements);
      const matchesQuery = `${work.nombre} ${work.cliente}`.toLowerCase().includes(query.toLowerCase());
      const matchesStatus = statusFilter === "Todos" || status === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [movementsByWork, query, statusFilter, works]);

  async function loadWorks() {
    setLoading(true);
    setError("");
    try {
      const loadedWorks = await getFinancialWorks();
      const loadedMovements = (await Promise.all(
        loadedWorks.map((work) => getMovementsByWork(work.id))
      )).flat();
      setWorks(loadedWorks);
      setAllMovements(loadedMovements);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las finanzas.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMovements(id: string) {
    const nextMovements = await getMovementsByWork(id);
    setAllMovements((current) => [
      ...current.filter((movement) => movement.obraId !== id),
      ...nextMovements
    ]);
  }

  function openCreateWork() {
    setNewWorkOpen(true);
  }

  function openEditWork() {
    if (!selectedWork) return;
    setWorkForm({
      nombre: selectedWork.nombre,
      cliente: selectedWork.cliente,
      arquitecto: selectedWork.arquitecto,
      direccion: selectedWork.direccion ?? selectedWork.ubicacion,
      fechaInicio: selectedWork.fechaInicio,
      fechaComprometida: selectedWork.fechaComprometida ?? selectedWork.fechaEntrega,
      presupuestoAprobado: String(selectedWork.presupuestoAprobado ?? selectedWork.montoAprobado),
      adicionalesAprobados: String(selectedWork.adicionalesAprobados ?? 0),
      descuentos: String(selectedWork.descuentos ?? 0),
      observacionInicial: ""
    });
    setWorkModal("edit");
  }

  async function handleSaveWork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const presupuestoAprobado = Number(workForm.presupuestoAprobado);
    const adicionalesAprobados = Number(workForm.adicionalesAprobados);
    const descuentos = Number(workForm.descuentos);
    const totalContratado = presupuestoAprobado + adicionalesAprobados - descuentos;

    try {
      if (workModal === "edit" && selectedWork) {
        const updated = await updateFinancialWork(selectedWork.id, {
          nombre: toTitleCase(workForm.nombre),
          cliente: toTitleCase(workForm.cliente),
          arquitecto: workForm.arquitecto ? toTitleCase(workForm.arquitecto) : "",
          ubicacion: workForm.direccion,
          direccion: workForm.direccion,
          fechaInicio: workForm.fechaInicio,
          fechaEntrega: workForm.fechaComprometida,
          fechaComprometida: workForm.fechaComprometida,
          montoAprobado: totalContratado,
          presupuestoAprobado,
          adicionalesAprobados,
          descuentos,
          totalContratado,
          valorFinalContratado: totalContratado
        });
        setWorks((current) => current.map((work) => (work.id === updated.id ? updated : work)));
        setMessage("Datos de obra actualizados.");
      }
      setWorkModal(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la obra.");
    }
  }

  function openMovement(type: FinancialMovementKind) {
    setError("");
    setMessage("");
    setMovementForm(emptyMovementForm(type));
    setMovementModal(type);
  }

  async function handleSaveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWork || !movementModal) return;
    setError("");

    if (movementForm.metodoPago === "Cheque") {
      if (!movementForm.numeroCheque.trim()) {
        setError("Carga el numero de cheque.");
        return;
      }
      if (!movementForm.fechaEmisionCheque) {
        setError("Carga la fecha de emision del cheque.");
        return;
      }
      if (!movementForm.fechaCobroCheque) {
        setError("Carga la fecha de cobro del cheque.");
        return;
      }
      if (movementForm.fechaCobroCheque < movementForm.fechaEmisionCheque) {
        setError("La fecha de cobro no puede ser anterior a la fecha de emision.");
        return;
      }
    }

    if (movementModal === "compra" && movementForm.cantidad && !normalizeUnit(movementForm.unidad)) {
      setError("Selecciona una unidad valida para la compra.");
      return;
    }

    try {
      await createMovement(selectedWork.id, {
        fecha: movementForm.fecha,
        tipo: movementModal,
        concepto: movementForm.concepto.trim(),
        categoria: movementForm.categoria,
        detalle: movementForm.detalle || undefined,
        cantidad: movementForm.cantidad ? Number(movementForm.cantidad) : undefined,
        unidad: movementModal === "compra" ? normalizeUnit(movementForm.unidad) || undefined : movementForm.unidad || undefined,
        metodoPago: movementForm.metodoPago,
        numeroCheque: movementForm.metodoPago === "Cheque" ? movementForm.numeroCheque || undefined : undefined,
        fechaEmisionCheque: movementForm.metodoPago === "Cheque" ? movementForm.fechaEmisionCheque || undefined : undefined,
        fechaCobroCheque: movementForm.metodoPago === "Cheque" ? movementForm.fechaCobroCheque || undefined : undefined,
        bancoCheque: movementForm.metodoPago === "Cheque" ? movementForm.bancoCheque || undefined : undefined,
        monto: Number(movementForm.monto),
        tercero: movementForm.tercero ? toTitleCase(movementForm.tercero) : undefined,
        observacion: movementForm.observacion || undefined
      });
      await loadMovements(selectedWork.id);
      await loadWorks();
      setMovementModal(null);
      setMessage("Movimiento registrado.");
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar el movimiento.");
    }
  }

  async function handleDeleteMovement(movementId: string) {
    if (!selectedWork || !window.confirm("Eliminar este movimiento?")) return;
    await deleteMovement(selectedWork.id, movementId);
    await loadMovements(selectedWork.id);
    await loadWorks();
    setMessage("Movimiento eliminado.");
  }

  if (loading) {
    return <StateCard text="Cargando finanzas de obras..." />;
  }

  if (selectedWork) {
    return (
      <FinancialDetail
        obra={selectedWork}
        movements={movements}
        onBack={() => navigate("/finanzas-obras")}
        onAddMovement={openMovement}
        onEditWork={openEditWork}
        onDeleteMovement={handleDeleteMovement}
        message={message}
        error={error}
        workModal={workModal}
        workForm={workForm}
        setWorkForm={setWorkForm}
        onSaveWork={handleSaveWork}
        onCloseWorkModal={() => setWorkModal(null)}
        movementModal={movementModal}
        movementForm={movementForm}
        setMovementForm={setMovementForm}
        onSaveMovement={handleSaveMovement}
        onCloseMovementModal={() => setMovementModal(null)}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="text-sm font-black uppercase text-next-blue">Administracion</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">FINANZAS DE OBRAS</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Control financiero por obra: ingresos, compras, egresos y resultado.
          </p>
        </div>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-soft sm:p-5">
        <div className="mb-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_180px_auto] xl:grid-cols-[minmax(0,1fr)_200px_auto]">
          <input
            className="h-10 w-full rounded-md border border-slate-200 bg-next-bg px-3 text-xs font-semibold outline-none focus:border-next-blue focus:bg-white focus:ring-4 focus:ring-next-blue/10 sm:text-sm"
            placeholder="Buscar por obra o cliente"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="h-10 rounded-md border border-slate-200 bg-white px-3 text-xs font-semibold outline-none focus:border-next-blue focus:ring-4 focus:ring-next-blue/10 sm:text-sm"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>Todos</option>
            <option>Saludable</option>
            <option value="Atencion">Atención</option>
            <option>Margen bajo</option>
            <option>Pendiente de cobro</option>
          </select>
          <button className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-next-blue px-3 text-xs font-black text-white transition hover:bg-next-navy sm:px-4 sm:text-sm" type="button" onClick={openCreateWork}>
            <Plus className="h-4 w-4" aria-hidden="true" />
            Nueva obra
          </button>
        </div>

        <div className="space-y-4">
          {filteredWorks.map((work) => (
            <FinancialWorkCard
              key={work.id}
              obra={work}
              movements={movementsByWork[work.id] ?? []}
              onOpen={() => navigate(`/finanzas-obras/${work.id}`)}
            />
          ))}
        </div>

        {!filteredWorks.length ? <EmptyState text="No hay obras financieras para mostrar." /> : null}
      </section>

      {workModal ? (
        <WorkModal
          mode={workModal}
          values={workForm}
          setValues={setWorkForm}
          onSubmit={handleSaveWork}
          onClose={() => setWorkModal(null)}
        />
      ) : null}
      {newWorkOpen ? (
        <NewWorkWizard
          defaultDestination="finanzas"
          onClose={() => setNewWorkOpen(false)}
          onCreated={(obra, destination) => {
            setNewWorkOpen(false);
            setWorks((current) => [obra, ...current]);
            setMessage("Obra creada.");
            if (destination === "avance") navigate(`/avance-obras/${obra.id}`);
            if (destination === "finanzas") navigate(`/finanzas-obras/${obra.id}`);
            if (destination === "control") navigate("/control");
          }}
        />
      ) : null}
    </div>
  );
}

function FinancialDetail({
  obra,
  movements,
  onBack,
  onAddMovement,
  onEditWork,
  onDeleteMovement,
  message,
  error,
  workModal,
  workForm,
  setWorkForm,
  onSaveWork,
  onCloseWorkModal,
  movementModal,
  movementForm,
  setMovementForm,
  onSaveMovement,
  onCloseMovementModal
}: {
  obra: Obra;
  movements: FinancialMovement[];
  onBack: () => void;
  onAddMovement: (type: FinancialMovementKind) => void;
  onEditWork: () => void;
  onDeleteMovement: (movementId: string) => void;
  message: string;
  error: string;
  workModal: "edit" | null;
  workForm: typeof emptyWorkForm;
  setWorkForm: (values: typeof emptyWorkForm) => void;
  onSaveWork: (event: FormEvent<HTMLFormElement>) => void;
  onCloseWorkModal: () => void;
  movementModal: FinancialMovementKind | null;
  movementForm: ReturnType<typeof emptyMovementForm>;
  setMovementForm: (values: ReturnType<typeof emptyMovementForm>) => void;
  onSaveMovement: (event: FormEvent<HTMLFormElement>) => void;
  onCloseMovementModal: () => void;
}) {
  const [expandedMovements, setExpandedMovements] = useState<Record<string, boolean>>({});
  const totalContratado = getTotalContratado(obra);
  const totalIngresos = calculateTotalIngresos(movements);
  const totalEgresos = calculateTotalEgresos(movements);
  const totalCompras = movements
    .filter((movement) => movement.tipo === "compra")
    .reduce((sum, movement) => sum + movement.monto, 0);
  const totalEgresosOperativos = movements
    .filter((movement) => movement.tipo === "egreso")
    .reduce((sum, movement) => sum + movement.monto, 0);
  const resultado = calculateResultadoActual(obra, movements);
  const saldo = calculateSaldoPendiente(obra, movements);
  const margen = calculateMargenActual(obra, movements);
  const egresosByCategory = groupEgresosByCategoria(movements);
  const ingresosByCategory = groupIngresosByCategoria(movements);

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <button className="mb-3 inline-flex items-center gap-2 text-sm font-black text-next-blue" type="button" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Volver a Finanzas de obras
          </button>
          <p className="text-sm font-black uppercase text-next-blue">Administracion</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">FINANZAS DE OBRA</h1>
        </div>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-5 flex flex-col justify-between gap-3 lg:flex-row lg:items-start">
          <div>
            <h2 className="text-2xl font-black text-next-text">{obra.nombre}</h2>
            <p className="mt-1 text-sm font-semibold text-next-muted">{obra.cliente}</p>
          </div>
        <StatusBadge label={formatFinancialStatus(calculateFinancialStatus(obra, movements))} status={badgeForFinancial(calculateFinancialStatus(obra, movements))} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric label="Presupuesto aprobado" value={formatCurrencyPYG(obra.presupuestoAprobado ?? obra.montoAprobado)} />
          <Metric label="Adicionales" value={formatCurrencyPYG(obra.adicionalesAprobados ?? 0)} />
          <Metric label="Descuentos" value={formatCurrencyPYG(obra.descuentos ?? 0)} />
          <Metric label="Total contratado" value={formatCurrencyPYG(totalContratado)} />
          <Metric label="Total ingresado" value={formatCurrencyPYG(totalIngresos)} tone="green" />
          <Metric label="Total compras" value={formatCurrencyPYG(totalCompras)} tone="red" />
          <Metric label="Egresos operativos" value={formatCurrencyPYG(totalEgresosOperativos)} tone="orange" />
          <Metric label="Total egresado" value={formatCurrencyPYG(totalEgresos)} tone="red" />
          <Metric label="Resultado actual" value={formatCurrencyPYG(resultado)} tone={resultado >= 0 ? "green" : "red"} />
          <Metric label="Saldo pendiente" value={formatCurrencyPYG(saldo)} tone="orange" />
        </div>
      </section>

      <section className="grid min-w-0 gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <ActionButton label="+ Agregar ingreso" shortLabel="Ingreso" onClick={() => onAddMovement("ingreso")} />
        <ActionButton label="+ Agregar compra" shortLabel="Compra" onClick={() => onAddMovement("compra")} />
        <ActionButton label="+ Agregar egreso" shortLabel="Egreso" onClick={() => onAddMovement("egreso")} />
        <ActionButton label="Editar datos de obra" shortLabel="Editar" onClick={onEditWork} secondary />
      </section>

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-5 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="text-lg font-black text-next-text">Movimientos de la obra</h2>
            <p className="mt-1 text-sm font-semibold text-next-muted">
              Ingresos, compras y egresos en una tabla operativa.
            </p>
          </div>
          <p className="text-sm font-black text-next-blue">Margen actual: {margen}%</p>
        </div>

        <div className="hidden min-w-0 overflow-x-auto md:block">
          <div className="grid min-w-[1180px] grid-cols-[74px_58px_minmax(132px,1.05fr)_minmax(86px,0.68fr)_minmax(118px,0.9fr)_74px_70px_86px_86px_104px_104px_72px] items-center gap-1 border-b border-slate-100 px-1 pb-2 text-[10px] font-black uppercase leading-tight text-next-muted xl:min-w-0 xl:grid-cols-[82px_64px_minmax(160px,1.1fr)_minmax(96px,0.7fr)_minmax(140px,0.95fr)_82px_78px_94px_94px_112px_112px_78px] xl:gap-2">
            <span>Fecha</span>
            <span>Tipo</span>
            <span>Concepto</span>
            <span>Categoria</span>
            <span>Proveedor / Cliente</span>
            <span>Metodo</span>
            <span>Cheque</span>
            <span>Fecha emision</span>
            <span>Fecha cobro</span>
            <span>Ingreso</span>
            <span>Egreso</span>
            <span>Acciones</span>
          </div>
          <div className="divide-y divide-slate-100">
            {movements.map((movement) => (
              <MovementRow
                key={movement.id}
                movement={movement}
                expanded={Boolean(expandedMovements[movement.id])}
                onToggle={() =>
                  setExpandedMovements((current) => ({
                    ...current,
                    [movement.id]: !current[movement.id]
                  }))
                }
                onDelete={() => onDeleteMovement(movement.id)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {movements.map((movement) => (
            <MovementCard
              key={movement.id}
              movement={movement}
              expanded={Boolean(expandedMovements[movement.id])}
              onToggle={() =>
                setExpandedMovements((current) => ({
                  ...current,
                  [movement.id]: !current[movement.id]
                }))
              }
              onDelete={() => onDeleteMovement(movement.id)}
            />
          ))}
        </div>

        {!movements.length ? <EmptyState text="Todavia no hay movimientos cargados." /> : null}
        <MovementTotals
          totalIngresos={totalIngresos}
          totalCompras={totalCompras}
          totalEgresosOperativos={totalEgresosOperativos}
          totalEgresos={totalEgresos}
          resultado={resultado}
        />
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <SummaryBlock
          title="Resumen por categoria"
          groups={egresosByCategory}
          total={totalEgresos}
          fallback={["Vidrio", "Aluminio", "Accesorios", "Mano de obra", "Transporte", "Otros"]}
        />
        <SummaryBlock
          title="Resumen de ingresos"
          groups={ingresosByCategory}
          total={totalIngresos}
          fallback={["Anticipo", "Certificacion", "Pago parcial", "Otros ingresos"]}
        />
      </section>

      {workModal ? (
        <WorkModal
          mode={workModal}
          values={workForm}
          setValues={setWorkForm}
          onSubmit={onSaveWork}
          onClose={onCloseWorkModal}
        />
      ) : null}

      {movementModal ? (
        <MovementModal
          type={movementModal}
          values={movementForm}
          setValues={setMovementForm}
          onSubmit={onSaveMovement}
          onClose={onCloseMovementModal}
        />
      ) : null}
    </div>
  );
}

function FinancialWorkRow({
  obra,
  movements,
  onOpen
}: {
  obra: Obra;
  movements: FinancialMovement[];
  onOpen: () => void;
}) {
  const totals = getRowTotals(obra, movements);
  return (
    <div className="grid grid-cols-[minmax(128px,1.16fr)_minmax(104px,0.9fr)_repeat(5,minmax(74px,0.62fr))_minmax(86px,0.55fr)_40px] items-center gap-1 px-1 py-2 text-[11px] leading-tight xl:grid-cols-[minmax(168px,1.25fr)_minmax(132px,0.95fr)_repeat(5,minmax(90px,0.65fr))_minmax(96px,0.55fr)_42px] xl:gap-2 xl:text-xs">
      <div className="min-w-0">
        <p className="line-clamp-2 font-black text-next-text" title={obra.nombre}>{obra.nombre}</p>
        <p className="mt-0.5 truncate text-[10px] font-semibold text-next-muted xl:text-[11px]">{formatDateShort(obra.fechaComprometida ?? obra.fechaEntrega)}</p>
      </div>
      <p className="min-w-0 truncate font-semibold text-next-muted" title={obra.cliente}>{obra.cliente}</p>
      <p className="text-right font-black text-next-text">{formatCompactGuarani(totals.totalContratado)}</p>
      <p className="text-right font-black text-next-green">{formatCompactGuarani(totals.ingresos)}</p>
      <p className="text-right font-black text-next-red">{formatCompactGuarani(totals.egresos)}</p>
      <p className={`text-right font-black ${totals.resultado >= 0 ? "text-next-green" : "text-next-red"}`}>{formatCompactGuarani(totals.resultado)}</p>
      <p className="text-right font-black text-next-orange">{formatCompactGuarani(totals.saldo)}</p>
      <div className="min-w-0">
        <StatusBadge label={formatCompactFinancialStatus(totals.status)} status={badgeForFinancial(totals.status)} title={formatFinancialStatus(totals.status)} />
      </div>
      <button className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-next-blue text-white transition hover:bg-next-navy" type="button" onClick={onOpen} title="Abrir finanzas" aria-label="Abrir finanzas">
        <Eye className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

function FinancialWorkCard({ obra, movements, onOpen }: { obra: Obra; movements: FinancialMovement[]; onOpen: () => void }) {
  const totals = getRowTotals(obra, movements);
  const imageUrl = obra.imageUrl ?? obra.renderUrl;
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-3 shadow-soft transition hover:-translate-y-0.5 hover:shadow-xl">
      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(240px,32%)_minmax(0,1fr)]">
        <div className="relative min-h-52 overflow-hidden rounded-md bg-next-navy lg:min-h-full">
          {imageUrl ? (
            <img
              className="h-full min-h-52 w-full object-cover"
              src={imageUrl}
              alt={`Imagen de ${obra.nombre}`}
            />
          ) : (
            <div className="flex h-full min-h-52 flex-col justify-between bg-[linear-gradient(135deg,#0f2a44_0%,#1f6fb2_58%,#e8f3ff_100%)] p-5 text-white">
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

        <div className="min-w-0 p-1 sm:p-2">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h2 className="line-clamp-2 text-xl font-black leading-tight text-next-text">{obra.nombre}</h2>
              <p className="mt-1 truncate text-sm font-semibold text-next-muted" title={obra.cliente}>{obra.cliente}</p>
              <p className="mt-2 text-xs font-black uppercase text-next-blue">
                Fecha comprometida: {formatDateShort(obra.fechaComprometida ?? obra.fechaEntrega)}
              </p>
            </div>
            <StatusBadge label={formatCompactFinancialStatus(totals.status)} status={badgeForFinancial(totals.status)} title={formatFinancialStatus(totals.status)} />
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
            <FinanceCardMetric label="Presupuesto" value={formatCompactGuarani(totals.totalContratado)} />
            <FinanceCardMetric label="Ingresado" value={formatCompactGuarani(totals.ingresos)} tone="green" />
            <FinanceCardMetric label="Egresado" value={formatCompactGuarani(totals.egresos)} tone="red" />
            <FinanceCardMetric label="Resultado" value={formatCompactGuarani(totals.resultado)} tone={totals.resultado >= 0 ? "green" : "red"} />
            <FinanceCardMetric label="Saldo pendiente" value={formatCompactGuarani(totals.saldo)} tone="orange" />
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs font-semibold leading-5 text-next-muted">
              Los ingresos, compras y egresos se cargan dentro de esta obra.
            </p>
            <button className="inline-flex h-11 w-full shrink-0 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy sm:w-auto" type="button" onClick={onOpen}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              Abrir finanzas
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function FinanceCardMetric({
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
      <p className={`mt-1 truncate text-base font-black ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

function MovementRow({
  movement,
  expanded,
  onToggle,
  onDelete
}: {
  movement: FinancialMovement;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isIngreso = movement.tipo === "ingreso";
  const isCheque = movement.metodoPago === "Cheque";
  return (
    <>
      <div className={`grid min-w-[1180px] grid-cols-[74px_58px_minmax(132px,1.05fr)_minmax(86px,0.68fr)_minmax(118px,0.9fr)_74px_70px_86px_86px_104px_104px_72px] items-center gap-1 px-1 py-2 text-[11px] leading-tight xl:min-w-0 xl:grid-cols-[82px_64px_minmax(160px,1.1fr)_minmax(96px,0.7fr)_minmax(140px,0.95fr)_82px_78px_94px_94px_112px_112px_78px] xl:gap-2 xl:text-xs ${isIngreso ? "bg-green-50/35" : "bg-orange-50/35"}`}>
        <span className="font-bold text-next-muted">{formatDateShort(movement.fecha)}</span>
        <span className="font-black uppercase text-next-text">{formatMovementType(movement.tipo)}</span>
        <span className="min-w-0 truncate font-bold text-next-text" title={movement.concepto}>{movement.concepto}</span>
        <span className="min-w-0 truncate" title={movement.categoria}>{movement.categoria}</span>
        <span className="min-w-0 truncate font-semibold text-next-text" title={movement.tercero || "-"}>{movement.tercero || "-"}</span>
        <span className="min-w-0 truncate">{movement.metodoPago || "-"}</span>
        <span className="min-w-0 truncate font-bold text-next-text" title={isCheque ? movement.numeroCheque || "-" : "-"}>{isCheque && movement.numeroCheque ? movement.numeroCheque : "-"}</span>
        <span className="font-semibold text-next-muted">{isCheque && movement.fechaEmisionCheque ? formatDateShort(movement.fechaEmisionCheque) : "-"}</span>
        <span className="font-semibold text-next-muted">{isCheque && movement.fechaCobroCheque ? formatDateShort(movement.fechaCobroCheque) : "-"}</span>
        <span className="text-right font-black text-next-green">{isIngreso ? formatCurrencyPYG(movement.monto) : "-"}</span>
        <span className="text-right font-black text-next-red">{isIngreso ? "-" : formatCurrencyPYG(movement.monto)}</span>
        <span className="flex items-center justify-end gap-1">
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-next-muted transition hover:border-next-blue hover:text-next-blue" type="button" onClick={onToggle} title={expanded ? "Ocultar detalle" : "Ver detalle"} aria-label={expanded ? "Ocultar detalle" : "Ver detalle"}>
            {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 bg-white text-next-red transition hover:border-next-red" type="button" onClick={onDelete} title="Eliminar" aria-label="Eliminar">
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </span>
      </div>
      {expanded ? <MovementDetails movement={movement} /> : null}
    </>
  );
}

function MovementCard({
  movement,
  expanded,
  onToggle,
  onDelete
}: {
  movement: FinancialMovement;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const isIngreso = movement.tipo === "ingreso";
  const isCheque = movement.metodoPago === "Cheque";
  return (
    <article className={`rounded-lg border p-4 ${isIngreso ? "border-green-100 bg-green-50" : "border-orange-100 bg-orange-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-black uppercase text-next-muted">{movement.tipo}</p>
          <h3 className="mt-1 text-base font-black text-next-text">{movement.concepto}</h3>
          <p className="mt-1 text-sm font-semibold text-next-muted">{formatDateShort(movement.fecha)} · {movement.categoria}</p>
        </div>
        <p className={`text-right text-lg font-black ${isIngreso ? "text-next-green" : "text-next-red"}`}>{formatCurrencyPYG(movement.monto)}</p>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-next-muted">
        <RowLabel label="Metodo" value={movement.metodoPago || "-"} />
        <RowLabel label="Proveedor / Cliente" value={movement.tercero || "-"} />
        {isCheque ? (
          <>
            <RowLabel label="Cheque" value={movement.numeroCheque || "-"} />
            <RowLabel label="Fecha emision" value={movement.fechaEmisionCheque ? formatDateShort(movement.fechaEmisionCheque) : "-"} />
            <RowLabel label="Fecha cobro" value={movement.fechaCobroCheque ? formatDateShort(movement.fechaCobroCheque) : "-"} />
          </>
        ) : null}
      </div>
      {expanded ? <MovementDetails movement={movement} compact /> : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-black text-next-blue" type="button" onClick={onToggle}>
          {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          {expanded ? "Ocultar detalle" : "Ver detalle"}
        </button>
        <button className="inline-flex h-9 items-center gap-2 rounded-md border border-red-100 bg-white px-3 text-xs font-black text-next-red" type="button" onClick={onDelete}>
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Eliminar
        </button>
      </div>
    </article>
  );
}

function MovementDetails({ movement, compact = false }: { movement: FinancialMovement; compact?: boolean }) {
  const formattedUnit = movement.unidad ? formatUnitLabel(movement.unidad, movement.cantidad ?? 0) : "-";
  return (
    <div className={`${compact ? "mt-3 rounded-md bg-white/70 p-3" : "min-w-[1180px] rounded-b-md border-t border-slate-100 bg-white px-4 py-3 xl:min-w-0"} text-xs text-next-muted`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <DetailItem label="Detalle" value={movement.detalle || "-"} />
        <DetailItem label="Cantidad" value={movement.cantidad ? String(movement.cantidad) : "-"} />
        <DetailItem label="Unidad" value={formattedUnit} />
        <DetailItem label="Banco cheque" value={movement.bancoCheque || "-"} />
        <DetailItem label="Observacion" value={movement.observacion || "-"} />
        <DetailItem label="Creado" value={formatDateTime(movement.createdAt)} />
        {movement.updatedAt ? <DetailItem label="Actualizado" value={formatDateTime(movement.updatedAt)} /> : null}
      </div>
    </div>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="font-black uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words font-semibold text-next-text">{value}</p>
    </div>
  );
}

function WorkModal({
  mode,
  values,
  setValues,
  onSubmit,
  onClose
}: {
  mode: "edit";
  values: typeof emptyWorkForm;
  setValues: (values: typeof emptyWorkForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const totalContratado =
    Number(values.presupuestoAprobado) + Number(values.adicionalesAprobados) - Number(values.descuentos);

  return (
    <Modal title="Editar datos de obra" onClose={onClose}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nombre de obra">
            <input className="field" required value={values.nombre} onBlur={() => setValues({ ...values, nombre: toTitleCase(values.nombre) })} onChange={(event) => setValues({ ...values, nombre: event.target.value })} />
          </FormField>
          <FormField label="Cliente">
            <input className="field" required value={values.cliente} onBlur={() => setValues({ ...values, cliente: toTitleCase(values.cliente) })} onChange={(event) => setValues({ ...values, cliente: event.target.value })} />
          </FormField>
          <FormField label="Arquitecto opcional">
            <input className="field" value={values.arquitecto} onBlur={() => setValues({ ...values, arquitecto: toTitleCase(values.arquitecto) })} onChange={(event) => setValues({ ...values, arquitecto: event.target.value })} />
          </FormField>
          <FormField label="Direccion opcional">
            <input className="field" value={values.direccion} onChange={(event) => setValues({ ...values, direccion: event.target.value })} />
          </FormField>
          <FormField label="Fecha de inicio">
            <input className="field" type="date" value={values.fechaInicio} onChange={(event) => setValues({ ...values, fechaInicio: event.target.value })} />
          </FormField>
          <FormField label="Fecha comprometida de entrega">
            <input className="field" type="date" value={values.fechaComprometida} onChange={(event) => setValues({ ...values, fechaComprometida: event.target.value })} />
          </FormField>
          <FormField label="Presupuesto aprobado">
            <CurrencyInput required value={Number(values.presupuestoAprobado || 0)} onValueChange={(value) => setValues({ ...values, presupuestoAprobado: String(value) })} />
          </FormField>
          <FormField label="Adicionales aprobados">
            <CurrencyInput value={Number(values.adicionalesAprobados || 0)} onValueChange={(value) => setValues({ ...values, adicionalesAprobados: String(value) })} />
          </FormField>
          <FormField label="Descuentos">
            <CurrencyInput value={Number(values.descuentos || 0)} onValueChange={(value) => setValues({ ...values, descuentos: String(value) })} />
          </FormField>
          <FormField label="Observacion inicial">
            <input className="field" value={values.observacionInicial} onChange={(event) => setValues({ ...values, observacionInicial: event.target.value })} />
          </FormField>
        </div>
        <div className="rounded-lg bg-next-bg p-4">
          <p className="text-xs font-bold uppercase text-next-muted">Total contratado</p>
          <p className="mt-1 text-2xl font-black text-next-blue">{formatCurrencyPYG(totalContratado)}</p>
        </div>
        <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="submit">
          Guardar
        </button>
      </form>
    </Modal>
  );
}

function FormField({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-xs font-black uppercase text-next-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function MovementModal({
  type,
  values,
  setValues,
  onSubmit,
  onClose
}: {
  type: FinancialMovementKind;
  values: ReturnType<typeof emptyMovementForm>;
  setValues: (values: ReturnType<typeof emptyMovementForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const title = type === "ingreso" ? "Agregar ingreso" : type === "compra" ? "Agregar compra" : "Agregar egreso";
  const isCheque = values.metodoPago === "Cheque";
  function updatePaymentMethod(method: FinancialPaymentMethod) {
    setValues({
      ...values,
      metodoPago: method,
      ...(method === "Cheque"
        ? {}
        : {
            numeroCheque: "",
            fechaEmisionCheque: "",
            fechaCobroCheque: "",
            bancoCheque: ""
          })
    });
  }

  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
        {type === "ingreso" ? (
          <>
            <MovementFormField label="Fecha del ingreso">
              <input className="field" type="date" value={values.fecha} onChange={(event) => setValues({ ...values, fecha: event.target.value })} />
            </MovementFormField>
            <MovementFormField label="Concepto">
              <input className="field" required value={values.concepto} onChange={(event) => setValues({ ...values, concepto: event.target.value })} />
            </MovementFormField>
            <MovementFormField label="Tipo de ingreso">
              <CategorySelect type={type} value={values.categoria} onChange={(categoria) => setValues({ ...values, categoria })} />
            </MovementFormField>
            <MovementFormField label="Monto">
              <CurrencyInput required placeholder="Monto" value={Number(values.monto || 0)} onValueChange={(value) => setValues({ ...values, monto: String(value) })} />
            </MovementFormField>
            <MovementFormField label="Metodo de pago">
              <PaymentMethodSelect value={values.metodoPago} onChange={updatePaymentMethod} />
            </MovementFormField>
            <MovementFormField label="Cliente / pagador">
              <input className="field" value={values.tercero} onBlur={() => setValues({ ...values, tercero: toTitleCase(values.tercero) })} onChange={(event) => setValues({ ...values, tercero: event.target.value })} />
            </MovementFormField>
            {isCheque ? <ChequeFields values={values} setValues={setValues} /> : null}
            <MovementFormField className="sm:col-span-2" label="Observacion">
              <input className="field" value={values.observacion} onChange={(event) => setValues({ ...values, observacion: event.target.value })} />
            </MovementFormField>
          </>
        ) : null}

        {type === "compra" ? (
          <>
            <MovementFormField label="Fecha de compra">
              <input className="field" type="date" value={values.fecha} onChange={(event) => setValues({ ...values, fecha: event.target.value })} />
            </MovementFormField>
            <MovementFormField label="Concepto">
              <input className="field" required value={values.concepto} onChange={(event) => setValues({ ...values, concepto: event.target.value })} />
            </MovementFormField>
            <MovementFormField label="Categoria">
              <CategorySelect type={type} value={values.categoria} onChange={(categoria) => setValues({ ...values, categoria })} />
            </MovementFormField>
            <MovementFormField label="Monto">
              <CurrencyInput required placeholder="Monto" value={Number(values.monto || 0)} onValueChange={(value) => setValues({ ...values, monto: String(value) })} />
            </MovementFormField>
            <MovementFormField label="Detalle">
              <input className="field" value={values.detalle} onChange={(event) => setValues({ ...values, detalle: event.target.value })} />
            </MovementFormField>
            <MovementFormField label="Proveedor / persona">
              <input className="field" value={values.tercero} onBlur={() => setValues({ ...values, tercero: toTitleCase(values.tercero) })} onChange={(event) => setValues({ ...values, tercero: event.target.value })} />
            </MovementFormField>
            <MovementFormField label="Cantidad">
              <input className="field" min={0} type="number" value={values.cantidad} onChange={(event) => setValues({ ...values, cantidad: event.target.value })} />
            </MovementFormField>
            <MovementFormField label="Unidad">
              <select className="field" value={normalizeUnit(values.unidad)} onChange={(event) => setValues({ ...values, unidad: normalizeUnit(event.target.value) })}>
                <option value="" disabled>Seleccionar unidad</option>
                <option value="m2">m²</option>
                <option value="unidad">unidad</option>
              </select>
            </MovementFormField>
            <MovementFormField label="Metodo de pago">
              <PaymentMethodSelect value={values.metodoPago} onChange={updatePaymentMethod} />
            </MovementFormField>
            {isCheque ? (
              <MovementFormField label="Numero de cheque">
                <input className="field" required value={values.numeroCheque} onChange={(event) => setValues({ ...values, numeroCheque: event.target.value })} />
              </MovementFormField>
            ) : null}
            {isCheque ? (
              <>
                <MovementFormField label="Banco opcional">
                  <input className="field" value={values.bancoCheque} onChange={(event) => setValues({ ...values, bancoCheque: event.target.value })} />
                </MovementFormField>
                <MovementFormField label="Observacion">
                  <input className="field" value={values.observacion} onChange={(event) => setValues({ ...values, observacion: event.target.value })} />
                </MovementFormField>
                <ChequeDateFields values={values} setValues={setValues} />
              </>
            ) : (
              <MovementFormField className="sm:col-span-2" label="Observacion">
                <input className="field" value={values.observacion} onChange={(event) => setValues({ ...values, observacion: event.target.value })} />
              </MovementFormField>
            )}
          </>
        ) : null}

        {type === "egreso" ? (
          <>
            <input className="field" type="date" value={values.fecha} onChange={(event) => setValues({ ...values, fecha: event.target.value })} />
            <input className="field" required placeholder="Concepto" value={values.concepto} onChange={(event) => setValues({ ...values, concepto: event.target.value })} />
            <select className="field" value={values.categoria} onChange={(event) => setValues({ ...values, categoria: event.target.value })}>
              {categoriesByType[type].map((category) => <option key={category}>{category}</option>)}
            </select>
            <CurrencyInput required placeholder="Monto" value={Number(values.monto || 0)} onValueChange={(value) => setValues({ ...values, monto: String(value) })} />
            <input className="field" placeholder="Detalle" value={values.detalle} onChange={(event) => setValues({ ...values, detalle: event.target.value })} />
            <input className="field" type="number" placeholder="Cantidad opcional" value={values.cantidad} onChange={(event) => setValues({ ...values, cantidad: event.target.value })} />
            <input className="field" placeholder="Unidad opcional" value={values.unidad} onChange={(event) => setValues({ ...values, unidad: event.target.value })} />
            <PaymentMethodSelect value={values.metodoPago} onChange={updatePaymentMethod} />
            <input className="field" placeholder="Proveedor / persona" value={values.tercero} onBlur={() => setValues({ ...values, tercero: toTitleCase(values.tercero) })} onChange={(event) => setValues({ ...values, tercero: event.target.value })} />
            {isCheque ? (
              <>
                <input className="field" required placeholder="Numero de cheque" value={values.numeroCheque} onChange={(event) => setValues({ ...values, numeroCheque: event.target.value })} />
                <input className="field" placeholder="Banco opcional" value={values.bancoCheque} onChange={(event) => setValues({ ...values, bancoCheque: event.target.value })} />
                <ChequeDateFields values={values} setValues={setValues} />
              </>
            ) : null}
            <input className="field" placeholder="Observacion" value={values.observacion} onChange={(event) => setValues({ ...values, observacion: event.target.value })} />
          </>
        ) : null}

        <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white sm:col-span-2" type="submit">
          Guardar movimiento
        </button>
      </form>
    </Modal>
  );
}

function MovementFormField({
  children,
  className = "",
  label
}: {
  children: ReactNode;
  className?: string;
  label: string;
}) {
  return (
    <label className={`block text-xs font-black uppercase text-next-muted ${className}`}>
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function CategorySelect({
  onChange,
  type,
  value
}: {
  onChange: (value: string) => void;
  type: FinancialMovementKind;
  value: string;
}) {
  return (
    <select className="field" value={value} onChange={(event) => onChange(event.target.value)}>
      {categoriesByType[type].map((category) => <option key={category}>{category}</option>)}
    </select>
  );
}

function PaymentMethodSelect({
  onChange,
  value
}: {
  onChange: (value: FinancialPaymentMethod) => void;
  value: FinancialPaymentMethod;
}) {
  return (
    <select className="field" value={value} onChange={(event) => onChange(event.target.value as FinancialPaymentMethod)}>
      {paymentMethods.map((method) => <option key={method}>{method}</option>)}
    </select>
  );
}

function ChequeFields({
  setValues,
  values
}: {
  setValues: (values: ReturnType<typeof emptyMovementForm>) => void;
  values: ReturnType<typeof emptyMovementForm>;
}) {
  return (
    <>
      <MovementFormField label="Numero de cheque">
        <input className="field" required value={values.numeroCheque} onChange={(event) => setValues({ ...values, numeroCheque: event.target.value })} />
      </MovementFormField>
      <MovementFormField label="Banco opcional">
        <input className="field" value={values.bancoCheque} onChange={(event) => setValues({ ...values, bancoCheque: event.target.value })} />
      </MovementFormField>
      <ChequeDateFields values={values} setValues={setValues} />
    </>
  );
}

function ChequeDateFields({
  setValues,
  values
}: {
  setValues: (values: ReturnType<typeof emptyMovementForm>) => void;
  values: ReturnType<typeof emptyMovementForm>;
}) {
  return (
    <>
      <MovementFormField label="Fecha de emision del cheque">
        <input className="field" required type="date" value={values.fechaEmisionCheque} onChange={(event) => setValues({ ...values, fechaEmisionCheque: event.target.value })} />
      </MovementFormField>
      <MovementFormField label="Fecha de cobro del cheque">
        <input className="field" required type="date" value={values.fechaCobroCheque} onChange={(event) => setValues({ ...values, fechaCobroCheque: event.target.value })} />
      </MovementFormField>
    </>
  );
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-lg font-black text-next-text">{title}</h2>
          <button className="icon-button" type="button" onClick={onClose} title="Cerrar">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function MovementTotals({
  totalIngresos,
  totalCompras,
  totalEgresosOperativos,
  totalEgresos,
  resultado
}: {
  totalIngresos: number;
  totalCompras: number;
  totalEgresosOperativos: number;
  totalEgresos: number;
  resultado: number;
}) {
  return (
    <div className="mt-4 rounded-lg border border-next-blue/15 bg-next-light p-4">
      <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-black uppercase text-next-blue">Cierre financiero</p>
          <h3 className="text-lg font-black text-next-text">Totales de movimientos</h3>
        </div>
        <p className={`text-xl font-black ${resultado >= 0 ? "text-next-green" : "text-next-red"}`}>
          {formatCurrencyPYG(resultado)}
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <TotalPill label="Total ingresos" value={formatCurrencyPYG(totalIngresos)} tone="green" />
        <TotalPill label="Total compras" value={formatCurrencyPYG(totalCompras)} tone="red" />
        <TotalPill label="Egresos operativos" value={formatCurrencyPYG(totalEgresosOperativos)} tone="orange" />
        <TotalPill label="Total egresos" value={formatCurrencyPYG(totalEgresos)} tone="red" />
        <TotalPill label="Resultado actual" value={formatCurrencyPYG(resultado)} tone={resultado >= 0 ? "green" : "red"} />
      </div>
    </div>
  );
}

function TotalPill({
  label,
  value,
  tone
}: {
  label: string;
  value: string;
  tone: "green" | "orange" | "red";
}) {
  const toneClasses = {
    green: "text-next-green",
    orange: "text-next-orange",
    red: "text-next-red"
  };

  return (
    <div className="rounded-md bg-white px-3 py-3 ring-1 ring-slate-200">
      <p className="text-[11px] font-black uppercase text-next-muted">{label}</p>
      <p className={`mt-1 break-words text-sm font-black ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

function SummaryBlock({
  title,
  groups,
  total,
  fallback
}: {
  title: string;
  groups: Record<string, number>;
  total: number;
  fallback: string[];
}) {
  const entries = Object.entries(groups).length
    ? Object.entries(groups)
    : fallback.map((category) => [category, 0] as [string, number]);

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-base font-black text-next-text">{title}</h2>
      <div className="mt-4 space-y-3">
        {entries.map(([category, value]) => (
          <div key={category}>
            <div className="mb-1 flex items-center justify-between gap-3 text-sm">
              <span className="font-bold text-next-text">{category}</span>
              <span className="font-black text-next-blue">{formatCurrencyPYG(value)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-next-blue" style={{ width: `${total ? Math.min(100, Math.round((value / total) * 100)) : 0}%` }} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function Metric({ label, value, tone = "blue" }: { label: string; value: string; tone?: "blue" | "green" | "orange" | "red" }) {
  const toneClasses = {
    blue: "text-next-blue",
    green: "text-next-green",
    orange: "text-next-orange",
    red: "text-next-red"
  };
  return (
    <div className="rounded-md bg-next-bg px-3 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className={`mt-1 break-words text-sm font-black ${toneClasses[tone]}`}>{value}</p>
    </div>
  );
}

function ActionButton({
  label,
  shortLabel,
  onClick,
  secondary = false
}: {
  label: string;
  shortLabel?: string;
  onClick: () => void;
  secondary?: boolean;
}) {
  return (
    <button
      className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-center text-xs font-black transition sm:text-sm ${
        secondary
          ? "border border-next-blue bg-white text-next-blue hover:bg-next-light"
          : "bg-next-blue text-white hover:bg-next-navy"
      }`}
      type="button"
      onClick={onClick}
    >
      {secondary ? <Edit3 className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
      <span className="hidden 2xl:inline">{label}</span>
      <span className="2xl:hidden">{shortLabel ?? label}</span>
    </button>
  );
}

function RowLabel({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="font-semibold text-next-muted">{label}</span>
      <span className="text-right font-black text-next-text">{value}</span>
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

function getRowTotals(obra: Obra, movements: FinancialMovement[]) {
  return {
    totalContratado: getTotalContratado(obra),
    ingresos: calculateTotalIngresos(movements),
    egresos: calculateTotalEgresos(movements),
    resultado: calculateResultadoActual(obra, movements),
    saldo: calculateSaldoPendiente(obra, movements),
    status: calculateFinancialStatus(obra, movements)
  };
}

function badgeForFinancial(status: FinancialStatus): BadgeStatus {
  if (status === "Saludable") return "success";
  if (status === "Atencion" || status === "Pendiente de cobro") return "warning";
  return "critical";
}

function formatCompactFinancialStatus(status: FinancialStatus): string {
  if (status === "Pendiente de cobro") {
    return "Pend. cobro";
  }

  return formatFinancialStatus(status);
}

function formatMovementType(type: FinancialMovementKind): string {
  if (type === "ingreso") {
    return "Ing.";
  }

  if (type === "compra") {
    return "Comp.";
  }

  return "Egr.";
}

function formatFinancialStatus(status: FinancialStatus): string {
  return status === "Atencion" ? "Atención" : status;
}
