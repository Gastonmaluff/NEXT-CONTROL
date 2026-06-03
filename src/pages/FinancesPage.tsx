import { Calculator, Plus, Receipt, Save, TrendingUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import DataCard from "../components/ui/DataCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import { createCobro, createObra, getCobrosByObra, getObras, updateObra } from "../lib/firestore";
import { generateId } from "../lib/storage";
import type {
  Cobro,
  CostBudgetItem,
  FinancialMovement,
  FinancialMovementType,
  FinancialStatus,
  Obra,
  PaymentMethod,
  WorkStatus
} from "../types";
import { formatCurrencyPYG, formatDateShort, getTodayInputDate } from "../utils/formatters";
import {
  costCategories,
  getContractValue,
  getCostBudget,
  getFinancialStatus,
  getGrossProfit,
  getMargin,
  getRealCosts
} from "../utils/finances";

const workStatuses: WorkStatus[] = [
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
const movementTypes: FinancialMovementType[] = [
  "Anticipo",
  "Certificacion",
  "Pago recibido",
  "Retencion",
  "Compra",
  "Materia prima",
  "Mano de obra",
  "Logistica",
  "Gasto extraordinario"
];

const emptyForm = {
  nombre: "",
  cliente: "",
  arquitecto: "",
  ubicacion: "",
  fechaInicio: getTodayInputDate(),
  fechaEntrega: getTodayInputDate(),
  responsable: "",
  supervisor: "",
  estado: "Aprobado" as WorkStatus,
  presupuestoAprobado: "",
  adicionalesAprobados: "0",
  descuentos: "0"
};

export default function FinancesPage() {
  const [obras, setObras] = useState<Obra[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [costs, setCosts] = useState<CostBudgetItem[]>(
    costCategories.map((categoria) => ({ id: generateId("cost"), categoria, estimado: 0, real: 0 }))
  );
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [movementForm, setMovementForm] = useState({
    tipo: "Compra" as FinancialMovementType,
    categoria: "Compra" as "Ingreso" | "Egreso" | "Compra",
    fecha: getTodayInputDate(),
    concepto: "",
    monto: "",
    metodoPago: "Transferencia" as PaymentMethod,
    proveedor: ""
  });
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedObra = obras.find((obra) => obra.id === selectedId) ?? obras[0];

  useEffect(() => {
    loadObras();
  }, []);

  useEffect(() => {
    if (selectedObra) {
      loadCobros(selectedObra.id);
    }
  }, [selectedObra?.id]);

  const filteredObras = useMemo(() => {
    return obras.filter((obra) =>
      `${obra.nombre} ${obra.cliente}`.toLowerCase().includes(query.toLowerCase())
    );
  }, [obras, query]);

  const totalCobrado = cobros.reduce((sum, cobro) => sum + cobro.monto, 0);
  const contractValue = selectedObra ? getContractValue(selectedObra) : 0;
  const realCosts = selectedObra ? getRealCosts(selectedObra) : 0;
  const grossProfit = selectedObra ? getGrossProfit(selectedObra) : 0;
  const margin = selectedObra ? getMargin(selectedObra) : 0;
  const selectedBudget = selectedObra ? getCostBudget(selectedObra) : [];
  const financialStatus = selectedObra ? getFinancialStatus(selectedObra) : "Atencion";

  async function loadObras() {
    setLoading(true);
    setError("");
    try {
      const loaded = await getObras();
      setObras(loaded);
      setSelectedId((current) => current || loaded[0]?.id || "");
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar finanzas.");
    } finally {
      setLoading(false);
    }
  }

  async function loadCobros(obraId: string) {
    try {
      setCobros(await getCobrosByObra(obraId));
    } catch (cobroError) {
      setError(cobroError instanceof Error ? cobroError.message : "No se pudieron cargar cobros.");
    }
  }

  function handleBudgetBase(value: string) {
    setForm({ ...form, presupuestoAprobado: value });
    const base = Number(value);
    setCosts((current) =>
      current.map((item) => ({
        ...item,
        estimado: item.estimado || Math.round(base / costCategories.length),
        real: item.real || Math.round(base / costCategories.length)
      }))
    );
  }

  async function handleCreateObra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");

    const presupuestoAprobado = Number(form.presupuestoAprobado);
    const adicionalesAprobados = Number(form.adicionalesAprobados);
    const descuentos = Number(form.descuentos);
    const valorFinalContratado = presupuestoAprobado + adicionalesAprobados - descuentos;

    try {
      const created = await createObra({
        nombre: form.nombre,
        cliente: form.cliente,
        arquitecto: form.arquitecto,
        ubicacion: form.ubicacion,
        fechaInicio: form.fechaInicio,
        fechaEntrega: form.fechaEntrega,
        responsable: form.responsable,
        supervisor: form.supervisor,
        estado: form.estado,
        montoAprobado: valorFinalContratado,
        saldoPendienteCobro: valorFinalContratado,
        presupuestoAprobado,
        adicionalesAprobados,
        descuentos,
        valorFinalContratado,
        costosEstimados: costs,
        movimientosFinancieros: [],
        rubrosAvance: [],
        etapasProduccion: [],
        materialesFaltantes: []
      });

      setMessage("Nueva obra creada desde Finanzas.");
      setShowForm(false);
      setForm(emptyForm);
      setSelectedId(created.id);
      await loadObras();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "No se pudo crear la obra.");
    }
  }

  async function handleUpdateCost(item: CostBudgetItem, field: "estimado" | "real", value: number) {
    if (!selectedObra) return;
    const nextCosts = selectedBudget.map((cost) =>
      cost.id === item.id ? { ...cost, [field]: value } : cost
    );
    const updated = await updateObra(selectedObra.id, { costosEstimados: nextCosts });
    setObras((current) => current.map((obra) => (obra.id === updated.id ? updated : obra)));
  }

  async function handleAddMovement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedObra || !movementForm.concepto || !movementForm.monto) return;

    const movement: FinancialMovement = {
      id: generateId("mov"),
      tipo: movementForm.tipo,
      categoria: movementForm.categoria,
      fecha: movementForm.fecha,
      concepto: movementForm.concepto,
      monto: Number(movementForm.monto),
      metodoPago: movementForm.metodoPago,
      proveedor: movementForm.proveedor
    };

    const nextMovements = [movement, ...(selectedObra.movimientosFinancieros ?? [])];
    const updated = await updateObra(selectedObra.id, { movimientosFinancieros: nextMovements });

    if (movement.categoria === "Ingreso") {
      await createCobro({
        obraId: selectedObra.id,
        fecha: movement.fecha,
        monto: movement.monto,
        medio: movement.metodoPago ?? "Transferencia",
        observacion: movement.concepto
      });
    }

    setObras((current) => current.map((obra) => (obra.id === updated.id ? updated : obra)));
    setMovementForm({
      tipo: "Compra",
      categoria: "Compra",
      fecha: getTodayInputDate(),
      concepto: "",
      monto: "",
      metodoPago: "Transferencia",
      proveedor: ""
    });
    setMessage("Movimiento financiero registrado.");
    await loadCobros(selectedObra.id);
  }

  if (loading) {
    return <StateCard text="Cargando finanzas de obras..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Administracion</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">FINANZAS DE OBRAS</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Presupuestos, ingresos, egresos, compras, cobros y rentabilidad por obra.
          </p>
        </div>
        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy"
          type="button"
          onClick={() => setShowForm((current) => !current)}
        >
          <Plus className="h-5 w-5" aria-hidden="true" />
          Nueva obra
        </button>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      {showForm ? (
        <DataCard title="Nueva obra financiera" subtitle="La obra creada aparece tambien en Avance de obras.">
          <form className="space-y-5" onSubmit={handleCreateObra}>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              <input className="field" required placeholder="Nombre de obra" value={form.nombre} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
              <input className="field" required placeholder="Cliente" value={form.cliente} onChange={(event) => setForm({ ...form, cliente: event.target.value })} />
              <input className="field" placeholder="Arquitecto" value={form.arquitecto} onChange={(event) => setForm({ ...form, arquitecto: event.target.value })} />
              <input className="field" placeholder="Direccion" value={form.ubicacion} onChange={(event) => setForm({ ...form, ubicacion: event.target.value })} />
              <input className="field" type="date" value={form.fechaInicio} onChange={(event) => setForm({ ...form, fechaInicio: event.target.value })} />
              <input className="field" type="date" value={form.fechaEntrega} onChange={(event) => setForm({ ...form, fechaEntrega: event.target.value })} />
              <input className="field" placeholder="Encargado de obra" value={form.responsable} onChange={(event) => setForm({ ...form, responsable: event.target.value })} />
              <input className="field" placeholder="Supervisor" value={form.supervisor} onChange={(event) => setForm({ ...form, supervisor: event.target.value })} />
              <select className="field" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value as WorkStatus })}>
                {workStatuses.map((status) => <option key={status}>{status}</option>)}
              </select>
              <input className="field" required type="number" placeholder="Presupuesto aprobado" value={form.presupuestoAprobado} onChange={(event) => handleBudgetBase(event.target.value)} />
              <input className="field" type="number" placeholder="Adicionales aprobados" value={form.adicionalesAprobados} onChange={(event) => setForm({ ...form, adicionalesAprobados: event.target.value })} />
              <input className="field" type="number" placeholder="Descuentos" value={form.descuentos} onChange={(event) => setForm({ ...form, descuentos: event.target.value })} />
            </div>

            <div className="rounded-lg bg-next-bg p-4">
              <p className="text-xs font-bold uppercase text-next-muted">Valor final contratado</p>
              <p className="mt-1 text-2xl font-black text-next-blue">
                {formatCurrencyPYG(Number(form.presupuestoAprobado) + Number(form.adicionalesAprobados) - Number(form.descuentos))}
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="text-xs uppercase text-next-muted">
                  <tr>
                    <th className="pb-3 font-black">Categoria</th>
                    <th className="pb-3 font-black">Estimado</th>
                    <th className="pb-3 font-black">Real inicial</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costs.map((item) => (
                    <tr key={item.id}>
                      <td className="py-2 font-bold text-next-text">{item.categoria}</td>
                      <td className="py-2">
                        <input className="field" type="number" value={item.estimado} onChange={(event) => setCosts((current) => current.map((cost) => cost.id === item.id ? { ...cost, estimado: Number(event.target.value) } : cost))} />
                      </td>
                      <td className="py-2">
                        <input className="field" type="number" value={item.real} onChange={(event) => setCosts((current) => current.map((cost) => cost.id === item.id ? { ...cost, real: Number(event.target.value) } : cost))} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="submit">
              <Save className="h-4 w-4" aria-hidden="true" />
              Guardar obra
            </button>
          </form>
        </DataCard>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <DataCard title="Obras financieras" subtitle="La pregunta clave: margen y caja por obra.">
          <div className="space-y-3">
            <input
              className="h-11 w-full rounded-md border border-slate-200 bg-next-bg px-3 text-sm outline-none focus:border-next-blue focus:bg-white focus:ring-4 focus:ring-next-blue/10"
              placeholder="Buscar por obra o cliente"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="max-h-[650px] space-y-3 overflow-y-auto pr-1">
              {filteredObras.map((obra) => {
                const status = getFinancialStatus(obra);
                const cardMargin = getMargin(obra);
                const cardValue = getContractValue(obra);
                const cardCosts = getRealCosts(obra);
                const cardProfit = getGrossProfit(obra);
                return (
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
                      <StatusBadge label={status} status={badgeForFinancial(status)} />
                    </div>
                    <div className="mt-3 grid gap-2 text-xs font-bold text-next-muted">
                      <span>Valor contratado: {formatCurrencyPYG(cardValue)}</span>
                      <span>Costos reales: {formatCurrencyPYG(cardCosts)}</span>
                      <span>Utilidad estimada: {formatCurrencyPYG(cardProfit)}</span>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={Math.max(0, Math.min(100, cardMargin))} tone={cardMargin < 20 ? "red" : cardMargin < 28 ? "orange" : "green"} />
                    </div>
                    <div className="mt-3 flex items-center justify-between text-xs font-black">
                      <span className="text-next-muted">Margen {cardMargin}%</span>
                      <span className="rounded-md bg-next-blue px-2.5 py-1 text-white">Ver finanzas</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </DataCard>

        {selectedObra ? (
          <div className="space-y-5">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kpi label="Valor final contratado" value={formatCurrencyPYG(contractValue)} icon={Receipt} />
              <Kpi label="Total cobrado" value={formatCurrencyPYG(totalCobrado)} icon={Receipt} tone="green" />
              <Kpi label="Saldo pendiente" value={formatCurrencyPYG(selectedObra.saldoPendienteCobro)} icon={Calculator} tone="orange" />
              <Kpi label="Margen" value={`${margin}%`} icon={TrendingUp} tone={margin < 20 ? "red" : "green"} />
            </section>

            {margin < 20 ? (
              <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-next-red">
                Margen menor al 20%.
              </div>
            ) : null}

            <section className="grid gap-5 xl:grid-cols-2">
              <DataCard title="Resumen financiero">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Costos reales totales" value={formatCurrencyPYG(realCosts)} />
                  <Metric label="Utilidad bruta" value={formatCurrencyPYG(grossProfit)} />
                  <Metric label="Margen %" value={`${margin}%`} />
                  <Metric label="Estado financiero" value={financialStatus} />
                </div>
              </DataCard>

              <DataCard title="Valor contractual">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Metric label="Presupuesto aprobado" value={formatCurrencyPYG(selectedObra.presupuestoAprobado ?? selectedObra.montoAprobado)} />
                  <Metric label="Adicionales aprobados" value={formatCurrencyPYG(selectedObra.adicionalesAprobados ?? 0)} />
                  <Metric label="Descuentos" value={formatCurrencyPYG(selectedObra.descuentos ?? 0)} />
                  <Metric label="Valor final contratado" value={formatCurrencyPYG(contractValue)} />
                </div>
              </DataCard>

              <DataCard title="Presupuesto economico" className="xl:col-span-2">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="text-xs uppercase text-next-muted">
                      <tr>
                        <th className="pb-3 font-black">Categoria</th>
                        <th className="pb-3 font-black">Estimado</th>
                        <th className="pb-3 font-black">Real</th>
                        <th className="pb-3 font-black">Diferencia</th>
                        <th className="pb-3 text-right font-black">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedBudget.map((item) => {
                        const diff = item.estimado - item.real;
                        return (
                          <tr key={item.id}>
                            <td className="py-3 font-bold text-next-text">{item.categoria}</td>
                            <td className="py-3">
                              <input className="field" type="number" value={item.estimado} onChange={(event) => handleUpdateCost(item, "estimado", Number(event.target.value))} />
                            </td>
                            <td className="py-3">
                              <input className="field" type="number" value={item.real} onChange={(event) => handleUpdateCost(item, "real", Number(event.target.value))} />
                            </td>
                            <td className={`py-3 font-black ${diff < 0 ? "text-next-red" : "text-next-green"}`}>{formatCurrencyPYG(diff)}</td>
                            <td className="py-3 text-right">
                              <StatusBadge label={diff < 0 ? "Excedido" : "OK"} status={diff < 0 ? "critical" : "success"} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </DataCard>

              <DataCard title="Ingresos">
                <MovementList
                  movements={[
                    ...cobros.map((cobro) => ({
                      id: cobro.id,
                      tipo: "Pago recibido" as FinancialMovementType,
                      categoria: "Ingreso" as const,
                      fecha: cobro.fecha,
                      concepto: cobro.observacion || cobro.medio,
                      monto: cobro.monto,
                      metodoPago: cobro.medio
                    })),
                    ...(selectedObra.movimientosFinancieros ?? []).filter((item) => item.categoria === "Ingreso")
                  ]}
                />
              </DataCard>

              <DataCard title="Egresos y compras">
                <MovementList movements={(selectedObra.movimientosFinancieros ?? []).filter((item) => item.categoria !== "Ingreso")} />
              </DataCard>

              <DataCard title="Registrar ingreso, egreso o compra" className="xl:col-span-2">
                <form className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" onSubmit={handleAddMovement}>
                  <select className="field" value={movementForm.categoria} onChange={(event) => setMovementForm({ ...movementForm, categoria: event.target.value as "Ingreso" | "Egreso" | "Compra" })}>
                    <option>Ingreso</option>
                    <option>Egreso</option>
                    <option>Compra</option>
                  </select>
                  <select className="field" value={movementForm.tipo} onChange={(event) => setMovementForm({ ...movementForm, tipo: event.target.value as FinancialMovementType })}>
                    {movementTypes.map((type) => <option key={type}>{type}</option>)}
                  </select>
                  <input className="field" type="date" value={movementForm.fecha} onChange={(event) => setMovementForm({ ...movementForm, fecha: event.target.value })} />
                  <input className="field" placeholder="Concepto" value={movementForm.concepto} onChange={(event) => setMovementForm({ ...movementForm, concepto: event.target.value })} />
                  <input className="field" type="number" placeholder="Monto" value={movementForm.monto} onChange={(event) => setMovementForm({ ...movementForm, monto: event.target.value })} />
                  <select className="field" value={movementForm.metodoPago} onChange={(event) => setMovementForm({ ...movementForm, metodoPago: event.target.value as PaymentMethod })}>
                    {paymentMethods.map((method) => <option key={method}>{method}</option>)}
                  </select>
                  <input className="field xl:col-span-2" placeholder="Proveedor o referencia" value={movementForm.proveedor} onChange={(event) => setMovementForm({ ...movementForm, proveedor: event.target.value })} />
                  <button className="h-10 rounded-md bg-next-blue px-3 text-xs font-black text-white" type="submit">Registrar movimiento</button>
                </form>
              </DataCard>

              <DataCard title="Rentabilidad">
                <div className="space-y-4">
                  <Metric label="Costos reales totales" value={formatCurrencyPYG(realCosts)} />
                  <Metric label="Utilidad bruta" value={formatCurrencyPYG(grossProfit)} />
                  <ProgressBar value={Math.max(0, Math.min(100, margin))} tone={margin < 20 ? "red" : margin < 28 ? "orange" : "green"} label={`Margen ${margin}%`} />
                </div>
              </DataCard>

              <DataCard title="Alertas financieras">
                <div className="space-y-3">
                  <Alert text={margin < 20 ? "Margen menor al 20%." : "Margen dentro de rango operativo."} danger={margin < 20} />
                  <Alert text={selectedObra.saldoPendienteCobro > contractValue * 0.35 ? "Saldo pendiente alto." : "Cobranza bajo control."} danger={selectedObra.saldoPendienteCobro > contractValue * 0.35} />
                </div>
              </DataCard>

              <DataCard title="Resultado final" className="xl:col-span-2">
                <div className="grid gap-3 sm:grid-cols-4">
                  <Metric label="Valor final" value={formatCurrencyPYG(contractValue)} />
                  <Metric label="Cobrado" value={formatCurrencyPYG(totalCobrado)} />
                  <Metric label="Utilidad bruta" value={formatCurrencyPYG(grossProfit)} />
                  <Metric label="Estado" value={financialStatus} />
                </div>
              </DataCard>
            </section>
          </div>
        ) : (
          <EmptyState text="Crea una obra financiera para empezar." />
        )}
      </section>
    </div>
  );
}

function MovementList({ movements }: { movements: FinancialMovement[] }) {
  if (!movements.length) {
    return <EmptyState text="Sin movimientos registrados." />;
  }

  return (
    <div className="space-y-2">
      {movements.map((movement) => (
        <div key={movement.id} className="rounded-md border border-slate-100 px-3 py-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-next-text">{movement.concepto}</p>
              <p className="mt-1 text-xs font-semibold text-next-muted">
                {formatDateShort(movement.fecha)} · {movement.tipo}
                {movement.proveedor ? ` · ${movement.proveedor}` : ""}
              </p>
            </div>
            <p className="text-sm font-black text-next-blue">{formatCurrencyPYG(movement.monto)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, value, icon: Icon, tone = "blue" }: { label: string; value: string; icon: LucideIcon; tone?: "blue" | "green" | "orange" | "red" }) {
  const toneClasses = {
    blue: "bg-next-light text-next-blue",
    green: "bg-green-50 text-next-green",
    orange: "bg-orange-50 text-next-orange",
    red: "bg-red-50 text-next-red"
  };

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-next-muted">{label}</p>
          <p className="mt-3 break-words text-2xl font-black text-next-text">{value}</p>
        </div>
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${toneClasses[tone]}`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-next-bg px-3 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-next-text">{value}</p>
    </div>
  );
}

function Alert({ text, danger }: { text: string; danger: boolean }) {
  return (
    <div className={`rounded-md px-3 py-3 text-sm font-black ${danger ? "bg-red-50 text-next-red" : "bg-green-50 text-next-green"}`}>
      {text}
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

function badgeForFinancial(status: FinancialStatus): BadgeStatus {
  if (status === "Saludable") return "success";
  if (status === "Atencion" || status === "Pendiente de cobro") return "warning";
  return "critical";
}
