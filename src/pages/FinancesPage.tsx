import { ArrowLeft, ChevronDown, ChevronRight, Edit3, Plus, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import {
  createFinancialWork,
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
import { formatCurrencyPYG, formatDateShort, formatDateTime, getTodayInputDate } from "../utils/formatters";
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
    metodoPago: "Transferencia" as FinancialPaymentMethod,
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
  const [workModal, setWorkModal] = useState<"create" | "edit" | null>(null);
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
    setWorkForm(emptyWorkForm);
    setWorkModal("create");
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
          nombre: workForm.nombre,
          cliente: workForm.cliente,
          arquitecto: workForm.arquitecto,
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
      } else {
        const created = await createFinancialWork({
          nombre: workForm.nombre,
          cliente: workForm.cliente,
          arquitecto: workForm.arquitecto,
          direccion: workForm.direccion,
          fechaInicio: workForm.fechaInicio,
          fechaComprometida: workForm.fechaComprometida,
          presupuestoAprobado,
          adicionalesAprobados,
          descuentos,
          observacionInicial: workForm.observacionInicial
        });
        setWorks((current) => [created, ...current]);
        setMessage("Obra financiera creada.");
        navigate(`/finanzas-obras/${created.id}`);
      }
      setWorkModal(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la obra.");
    }
  }

  function openMovement(type: FinancialMovementKind) {
    setMovementForm(emptyMovementForm(type));
    setMovementModal(type);
  }

  async function handleSaveMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedWork || !movementModal) return;

    try {
      await createMovement(selectedWork.id, {
        fecha: movementForm.fecha,
        tipo: movementModal,
        concepto: movementForm.concepto,
        categoria: movementForm.categoria,
        detalle: movementForm.detalle || undefined,
        cantidad: movementForm.cantidad ? Number(movementForm.cantidad) : undefined,
        unidad: movementForm.unidad || undefined,
        metodoPago: movementForm.metodoPago,
        monto: Number(movementForm.monto),
        tercero: movementForm.tercero || undefined,
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
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Administracion</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">FINANZAS DE OBRAS</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Control financiero por obra: ingresos, compras, egresos y resultado.
          </p>
        </div>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy" type="button" onClick={openCreateWork}>
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva obra
        </button>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
        <div className="mb-5 grid gap-3 lg:grid-cols-[1fr_220px]">
          <input
            className="h-11 w-full rounded-md border border-slate-200 bg-next-bg px-3 text-sm outline-none focus:border-next-blue focus:bg-white focus:ring-4 focus:ring-next-blue/10"
            placeholder="Buscar por obra o cliente"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <select
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold outline-none focus:border-next-blue focus:ring-4 focus:ring-next-blue/10"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option>Todos</option>
            <option>Saludable</option>
            <option value="Atencion">Atención</option>
            <option>Margen bajo</option>
            <option>Pendiente de cobro</option>
          </select>
        </div>

        <div className="hidden min-w-0 xl:block">
          <div className="grid grid-cols-[minmax(180px,1.35fr)_minmax(140px,1fr)_repeat(5,minmax(106px,0.78fr))_minmax(116px,0.7fr)_minmax(126px,auto)] gap-3 border-b border-slate-100 pb-3 text-xs font-black uppercase text-next-muted">
            <span>Obra</span>
            <span>Cliente</span>
            <span>Presupuesto</span>
            <span>Ingresado</span>
            <span>Egresado</span>
            <span>Resultado</span>
            <span>Saldo</span>
            <span>Estado</span>
            <span>Accion</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filteredWorks.map((work) => (
              <FinancialWorkRow
                key={work.id}
                obra={work}
                movements={movementsByWork[work.id] ?? []}
                onOpen={() => navigate(`/finanzas-obras/${work.id}`)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 xl:hidden">
          {filteredWorks.map((work) => (
            <FinancialWorkCard
              key={work.id}
              obra={work}
              movements={movementsByWork[work.id] ?? []}
              onOpen={() => navigate(`/finanzas-obras/${work.id}`)}
            />
          ))}
        </div>
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
  workModal: "create" | "edit" | null;
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

      <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ActionButton label="+ Agregar ingreso" onClick={() => onAddMovement("ingreso")} />
        <ActionButton label="+ Agregar compra" onClick={() => onAddMovement("compra")} />
        <ActionButton label="+ Agregar egreso" onClick={() => onAddMovement("egreso")} />
        <ActionButton label="Editar datos de obra" onClick={onEditWork} secondary />
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

        <div className="hidden min-w-0 xl:block">
          <div className="grid grid-cols-[88px_82px_minmax(170px,1.4fr)_minmax(112px,0.8fr)_96px_118px_118px_minmax(136px,1fr)_112px] gap-2 border-b border-slate-100 pb-3 text-xs font-black uppercase text-next-muted">
            <span>Fecha</span>
            <span>Tipo</span>
            <span>Concepto</span>
            <span>Categoria</span>
            <span>Metodo</span>
            <span>Ingreso</span>
            <span>Egreso</span>
            <span>Proveedor / Cliente</span>
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

        <div className="space-y-3 xl:hidden">
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
    <div className="grid grid-cols-[minmax(180px,1.35fr)_minmax(140px,1fr)_repeat(5,minmax(106px,0.78fr))_minmax(116px,0.7fr)_minmax(126px,auto)] items-center gap-3 py-4 text-xs xl:text-sm">
      <div className="min-w-0">
        <p className="break-words font-black text-next-text">{obra.nombre}</p>
        <p className="text-xs font-semibold text-next-muted">{formatDateShort(obra.fechaComprometida ?? obra.fechaEntrega)}</p>
      </div>
      <p className="min-w-0 break-words font-semibold text-next-muted">{obra.cliente}</p>
      <p className="text-right font-black text-next-text">{formatCurrencyPYG(totals.totalContratado)}</p>
      <p className="text-right font-black text-next-green">{formatCurrencyPYG(totals.ingresos)}</p>
      <p className="text-right font-black text-next-red">{formatCurrencyPYG(totals.egresos)}</p>
      <p className={`text-right font-black ${totals.resultado >= 0 ? "text-next-green" : "text-next-red"}`}>{formatCurrencyPYG(totals.resultado)}</p>
      <p className="text-right font-black text-next-orange">{formatCurrencyPYG(totals.saldo)}</p>
      <div className="min-w-0">
        <StatusBadge label={formatFinancialStatus(totals.status)} status={badgeForFinancial(totals.status)} />
      </div>
      <button className="whitespace-nowrap rounded-md bg-next-blue px-3 py-2 text-xs font-black text-white" type="button" onClick={onOpen}>
        Abrir finanzas
      </button>
    </div>
  );
}

function FinancialWorkCard({ obra, movements, onOpen }: { obra: Obra; movements: FinancialMovement[]; onOpen: () => void }) {
  const totals = getRowTotals(obra, movements);
  return (
    <article className="rounded-lg border border-slate-100 bg-next-bg p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-black text-next-text">{obra.nombre}</p>
          <p className="mt-1 text-sm font-semibold text-next-muted">{obra.cliente}</p>
        </div>
        <StatusBadge label={formatFinancialStatus(totals.status)} status={badgeForFinancial(totals.status)} />
      </div>
      <div className="mt-4 grid gap-2 text-sm">
        <RowLabel label="Presupuesto" value={formatCurrencyPYG(totals.totalContratado)} />
        <RowLabel label="Ingresado" value={formatCurrencyPYG(totals.ingresos)} />
        <RowLabel label="Egresado" value={formatCurrencyPYG(totals.egresos)} />
        <RowLabel label="Resultado" value={formatCurrencyPYG(totals.resultado)} />
        <RowLabel label="Saldo" value={formatCurrencyPYG(totals.saldo)} />
      </div>
      <button className="mt-4 h-10 w-full rounded-md bg-next-blue px-3 text-xs font-black text-white" type="button" onClick={onOpen}>
        Abrir finanzas
      </button>
    </article>
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
  return (
    <>
      <div className={`grid grid-cols-[88px_82px_minmax(170px,1.4fr)_minmax(112px,0.8fr)_96px_118px_118px_minmax(136px,1fr)_112px] items-center gap-2 py-3 text-xs ${isIngreso ? "bg-green-50/35" : "bg-orange-50/35"}`}>
        <span className="font-bold text-next-muted">{formatDateShort(movement.fecha)}</span>
        <span className="font-black uppercase text-next-text">{movement.tipo}</span>
        <span className="min-w-0 break-words font-bold text-next-text">{movement.concepto}</span>
        <span className="min-w-0 break-words">{movement.categoria}</span>
        <span>{movement.metodoPago || "-"}</span>
        <span className="text-right font-black text-next-green">{isIngreso ? formatCurrencyPYG(movement.monto) : "-"}</span>
        <span className="text-right font-black text-next-red">{isIngreso ? "-" : formatCurrencyPYG(movement.monto)}</span>
        <span className="min-w-0 break-words">{movement.tercero || "-"}</span>
        <span className="flex items-center justify-end gap-1">
          <button className="icon-button" type="button" onClick={onToggle} title={expanded ? "Ocultar detalle" : "Ver detalle"}>
            {expanded ? <ChevronDown className="h-4 w-4" aria-hidden="true" /> : <ChevronRight className="h-4 w-4" aria-hidden="true" />}
          </button>
          <button className="icon-button text-next-red" type="button" onClick={onDelete} title="Eliminar">
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
  return (
    <div className={`${compact ? "mt-3 rounded-md bg-white/70 p-3" : "rounded-b-md border-t border-slate-100 bg-white px-4 py-3"} text-xs text-next-muted`}>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <DetailItem label="Detalle" value={movement.detalle || "-"} />
        <DetailItem label="Cantidad" value={movement.cantidad ? String(movement.cantidad) : "-"} />
        <DetailItem label="Unidad" value={movement.unidad || "-"} />
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
  mode: "create" | "edit";
  values: typeof emptyWorkForm;
  setValues: (values: typeof emptyWorkForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const totalContratado =
    Number(values.presupuestoAprobado) + Number(values.adicionalesAprobados) - Number(values.descuentos);

  return (
    <Modal title={mode === "create" ? "Nueva obra" : "Editar datos de obra"} onClose={onClose}>
      <form className="space-y-4" onSubmit={onSubmit}>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="field" required placeholder="Nombre de obra" value={values.nombre} onChange={(event) => setValues({ ...values, nombre: event.target.value })} />
          <input className="field" required placeholder="Cliente" value={values.cliente} onChange={(event) => setValues({ ...values, cliente: event.target.value })} />
          <input className="field" placeholder="Arquitecto opcional" value={values.arquitecto} onChange={(event) => setValues({ ...values, arquitecto: event.target.value })} />
          <input className="field" placeholder="Direccion opcional" value={values.direccion} onChange={(event) => setValues({ ...values, direccion: event.target.value })} />
          <input className="field" type="date" value={values.fechaInicio} onChange={(event) => setValues({ ...values, fechaInicio: event.target.value })} />
          <input className="field" type="date" value={values.fechaComprometida} onChange={(event) => setValues({ ...values, fechaComprometida: event.target.value })} />
          <input className="field" required type="number" placeholder="Presupuesto aprobado" value={values.presupuestoAprobado} onChange={(event) => setValues({ ...values, presupuestoAprobado: event.target.value })} />
          <input className="field" type="number" placeholder="Adicionales aprobados" value={values.adicionalesAprobados} onChange={(event) => setValues({ ...values, adicionalesAprobados: event.target.value })} />
          <input className="field" type="number" placeholder="Descuentos" value={values.descuentos} onChange={(event) => setValues({ ...values, descuentos: event.target.value })} />
          <input className="field" placeholder="Observacion inicial opcional" value={values.observacionInicial} onChange={(event) => setValues({ ...values, observacionInicial: event.target.value })} />
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
  return (
    <Modal title={title} onClose={onClose}>
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={onSubmit}>
        <input className="field" type="date" value={values.fecha} onChange={(event) => setValues({ ...values, fecha: event.target.value })} />
        <input className="field" required placeholder="Concepto" value={values.concepto} onChange={(event) => setValues({ ...values, concepto: event.target.value })} />
        <select className="field" value={values.categoria} onChange={(event) => setValues({ ...values, categoria: event.target.value })}>
          {categoriesByType[type].map((category) => <option key={category}>{category}</option>)}
        </select>
        <input className="field" required type="number" placeholder="Monto" value={values.monto} onChange={(event) => setValues({ ...values, monto: event.target.value })} />
        {type !== "ingreso" ? (
          <>
            <input className="field" placeholder="Detalle" value={values.detalle} onChange={(event) => setValues({ ...values, detalle: event.target.value })} />
            <input className="field" type="number" placeholder="Cantidad opcional" value={values.cantidad} onChange={(event) => setValues({ ...values, cantidad: event.target.value })} />
            <input className="field" placeholder="Unidad opcional" value={values.unidad} onChange={(event) => setValues({ ...values, unidad: event.target.value })} />
          </>
        ) : null}
        <select className="field" value={values.metodoPago} onChange={(event) => setValues({ ...values, metodoPago: event.target.value as FinancialPaymentMethod })}>
          {paymentMethods.map((method) => <option key={method}>{method}</option>)}
        </select>
        <input className="field" placeholder={type === "ingreso" ? "Cliente / pagador" : "Proveedor / persona"} value={values.tercero} onChange={(event) => setValues({ ...values, tercero: event.target.value })} />
        <input className="field" placeholder="Observacion" value={values.observacion} onChange={(event) => setValues({ ...values, observacion: event.target.value })} />
        <button className="h-11 rounded-md bg-next-blue px-4 text-sm font-black text-white sm:col-span-2" type="submit">
          Guardar movimiento
        </button>
      </form>
    </Modal>
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

function ActionButton({ label, onClick, secondary = false }: { label: string; onClick: () => void; secondary?: boolean }) {
  return (
    <button
      className={`inline-flex min-h-12 min-w-0 items-center justify-center gap-2 rounded-md px-3 py-2 text-center text-xs font-black transition sm:text-sm ${
        secondary
          ? "border border-next-blue bg-white text-next-blue hover:bg-next-light"
          : "bg-next-blue text-white hover:bg-next-navy"
      }`}
      type="button"
      onClick={onClick}
    >
      {secondary ? <Edit3 className="h-5 w-5" aria-hidden="true" /> : <Plus className="h-5 w-5" aria-hidden="true" />}
      {label}
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

function formatFinancialStatus(status: FinancialStatus): string {
  return status === "Atencion" ? "Atención" : status;
}
