import { AlertTriangle, ArrowDown, ArrowUp, CheckCircle2, Download, Eye, FileSpreadsheet, MoreHorizontal, PlusCircle, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CurrencyInput from "../components/ui/CurrencyInput";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { createCheque, getCheques, syncChequesFromMovements, updateCheque } from "../lib/firestore";
import type { Cheque, ChequeKind, ChequeStatus, ChequeThirdPartyType } from "../types";
import { exportWorkbookToExcel } from "../utils/excel";
import { formatCurrencyPYG } from "../utils/formatters";
import { toTitleCase } from "../utils/text";

type ActiveTab = "emitido" | "recibido";
type QuickFilter = "todos" | "hoy" | "proximos7" | "mes" | "vencidos";
type Density = "compacta" | "comoda";
type SortKey =
  | "fechaEmision"
  | "numero"
  | "fechaVencimiento"
  | "faltan"
  | "dia"
  | "monto"
  | "tercero"
  | "estado"
  | "obra"
  | "banco";
type SortDirection = "asc" | "desc";

type ConfirmAction = {
  cheque: Cheque;
  nextStatus: ChequeStatus;
  title: string;
  text: string;
  dateLabel: string;
  dateValue: string;
} | null;

type ManualChequeForm = {
  tipo: ChequeKind;
  terceroTipo: ChequeThirdPartyType;
  terceroNombre: string;
  monto: number;
  numeroCheque: string;
  bancoCheque: string;
  fechaEmisionCheque: string;
  fechaCobroCheque: string;
  estado: ChequeStatus;
  obraNombre: string;
  observacion: string;
};

const pendingIssuedStatuses: ChequeStatus[] = ["emitido", "entregado"];
const paidIssuedStatuses: ChequeStatus[] = ["debitado"];
const closedIssuedStatuses: ChequeStatus[] = ["debitado", "rechazado", "anulado"];
const pendingReceivedStatuses: ChequeStatus[] = ["recibido", "depositado"];
const closedReceivedStatuses: ChequeStatus[] = ["cobrado", "rechazado", "anulado"];

const statusOptionsByTab: Record<ActiveTab, Array<{ value: string; label: string }>> = {
  emitido: [
    { value: "todos", label: "Todos los estados" },
    { value: "pendiente", label: "Pendiente" },
    { value: "pagado", label: "Pagado" },
    { value: "rechazado", label: "Rechazado" },
    { value: "anulado", label: "Anulado" }
  ],
  recibido: [
    { value: "todos", label: "Todos los estados" },
    { value: "pendiente", label: "Pendiente" },
    { value: "cobrado", label: "Cobrado" },
    { value: "rechazado", label: "Rechazado" },
    { value: "anulado", label: "Anulado" }
  ]
};

export default function ChequesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("emitido");
  const [density, setDensity] = useState<Density>("compacta");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [partyFilter, setPartyFilter] = useState("");
  const [workFilter, setWorkFilter] = useState("");
  const [bankFilter, setBankFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [sort, setSort] = useState<{ key: SortKey; direction: SortDirection }>({ key: "fechaVencimiento", direction: "asc" });
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Cheque | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    setPage(1);
    setStatusFilter("todos");
    setPartyFilter("");
    setWorkFilter("");
    setBankFilter("");
    setQuery("");
    setFromDate("");
    setToDate("");
    setQuickFilter("todos");
  }, [activeTab]);

  async function load() {
    setLoading(true);
    setError("");
    try {
      setCheques(await syncChequesFromMovements());
    } catch (syncError) {
      console.error("No se pudieron sincronizar cheques.", syncError);
      try {
        setCheques(await getCheques());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar los cheques.");
      }
    } finally {
      setLoading(false);
    }
  }

  const tabCheques = useMemo(
    () => cheques.filter((cheque) => cheque.tipo === activeTab),
    [activeTab, cheques]
  );

  const options = useMemo(() => buildFilterOptions(tabCheques), [tabCheques]);

  const filtered = useMemo(() => {
    const rows = tabCheques.filter((cheque) => {
      const dueDate = getChequeDueDate(cheque);
      const haystack = [
        cheque.numeroCheque,
        cheque.bancoCheque,
        cheque.terceroNombre,
        cheque.obraNombre,
        getChequeDescription(cheque),
        cheque.monto
      ].join(" ").toLowerCase();

      return haystack.includes(query.trim().toLowerCase())
        && matchesStatusFilter(cheque, activeTab, statusFilter)
        && (!partyFilter || cheque.terceroNombre === partyFilter)
        && (!workFilter || cheque.obraNombre === workFilter)
        && (!bankFilter || (cheque.bancoCheque ?? "") === bankFilter)
        && (!fromDate || dueDate >= fromDate)
        && (!toDate || dueDate <= toDate)
        && matchesQuickFilter(cheque, quickFilter);
    });

    return sortCheques(rows, sort);
  }, [activeTab, bankFilter, fromDate, partyFilter, query, quickFilter, sort, statusFilter, tabCheques, toDate, workFilter]);

  const totalFiltered = useMemo(() => sumCheques(filtered), [filtered]);
  const averageFiltered = filtered.length ? totalFiltered / filtered.length : 0;
  const metrics = useMemo(() => getTabMetrics(tabCheques, activeTab), [activeTab, tabCheques]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visibleRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  function setQuick(next: QuickFilter) {
    setQuickFilter(next);
    setPage(1);
  }

  function clearFilters() {
    setQuery("");
    setStatusFilter("todos");
    setPartyFilter("");
    setWorkFilter("");
    setBankFilter("");
    setFromDate("");
    setToDate("");
    setQuickFilter("todos");
    setPage(1);
  }

  function toggleSort(key: SortKey) {
    setSort((current) => ({
      key,
      direction: current.key === key && current.direction === "asc" ? "desc" : "asc"
    }));
  }

  function requestStatusChange(cheque: Cheque, nextStatus: ChequeStatus) {
    const isPaid = nextStatus === "debitado" || nextStatus === "cobrado";
    setConfirmAction({
      cheque,
      nextStatus,
      title: statusChangeTitle(cheque, nextStatus),
      text: isPaid
        ? "Se registrara el cambio de estado y quedara auditado en el historial del cheque."
        : "Esta accion actualizara el estado del cheque y guardara quien hizo el cambio.",
      dateLabel: cheque.tipo === "emitido" ? "Fecha real de pago" : "Fecha real de cobro",
      dateValue: getTodayLocal()
    });
  }

  async function confirmStatusChange() {
    if (!confirmAction || saving) return;
    setSaving(true);
    setError("");
    try {
      const note = statusChangeTitle(confirmAction.cheque, confirmAction.nextStatus);
      const updated = await updateCheque(confirmAction.cheque.id, {
        estado: confirmAction.nextStatus,
        updatedBy: profile?.uid ?? "unknown",
        observacion: mergeObservation(confirmAction.cheque.observacion, `${note}: ${formatDisplayDate(confirmAction.dateValue)}`)
      });
      setCheques((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected((current) => current?.id === updated.id ? updated : current);
      setConfirmAction(null);
      setMessage("Estado del cheque actualizado.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar el cheque.");
    } finally {
      setSaving(false);
    }
  }

  async function saveChequeDetails(cheque: Cheque, data: Partial<Cheque>) {
    setError("");
    try {
      const updated = await updateCheque(cheque.id, {
        ...data,
        updatedBy: profile?.uid ?? "unknown"
      });
      setCheques((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      setMessage("Cheque actualizado correctamente.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar el cheque.");
    }
  }

  async function saveManualCheque(form: ManualChequeForm) {
    setSaving(true);
    setError("");
    try {
      const terceroNombre = toTitleCase(form.terceroNombre.trim());
      const obraNombre = form.obraNombre.trim() ? toTitleCase(form.obraNombre.trim()) : "";
      const created = await createCheque({
        tipo: form.tipo,
        estado: form.estado,
        obraId: "",
        obraNombre,
        movimientoId: `manual-${Date.now()}`,
        origen: "manual",
        terceroNombre,
        terceroTipo: form.terceroTipo,
        clienteNombre: form.tipo === "recibido" && form.terceroTipo === "cliente" ? terceroNombre : undefined,
        pagadorNombre: form.tipo === "recibido" ? terceroNombre : undefined,
        proveedorNombre: form.tipo === "emitido" && form.terceroTipo === "proveedor" ? terceroNombre : undefined,
        beneficiarioNombre: form.tipo === "emitido" ? terceroNombre : undefined,
        monto: form.monto,
        numeroCheque: form.numeroCheque.trim(),
        bancoCheque: form.bancoCheque.trim() || undefined,
        fechaEmisionCheque: form.fechaEmisionCheque,
        fechaCobroCheque: form.fechaCobroCheque,
        fechaVencimientoCheque: form.fechaCobroCheque,
        observacion: form.observacion.trim() || undefined,
        updatedBy: profile?.uid ?? "unknown"
      });
      setCheques((current) => [created, ...current]);
      setActiveTab(created.tipo);
      setShowCreateModal(false);
      setMessage("Cheque registrado correctamente.");
    } catch (createError) {
      console.error("No se pudo registrar el cheque.", createError);
      setError(createError instanceof Error ? createError.message : "No se pudo registrar el cheque.");
    } finally {
      setSaving(false);
    }
  }

  function exportFilteredExcel(exportAll = false) {
    const rowsToExport = exportAll ? sortCheques(tabCheques, sort) : filtered;
    if (!rowsToExport.length) {
      setMessage("No hay cheques para exportar con estos filtros.");
      return;
    }

    const rows = rowsToExport.map((cheque) => buildExportRow(cheque, activeTab));
    rows.push({
      "Fecha expedicion": "",
      Numero: "",
      "Fecha vencimiento": "",
      Faltan: "",
      Dia: "",
      Monto: sumCheques(rowsToExport),
      [activeTab === "emitido" ? "Beneficiario" : "Cliente / Pagador"]: "TOTAL",
      Descripcion: "",
      Estado: "",
      Obra: "",
      Banco: "",
      Tipo: activeTab === "emitido" ? "Emitido" : "Recibido"
    });

    exportWorkbookToExcel({
      fileName: `${activeTab === "emitido" ? "Cheques_a_pagar" : "Cheques_a_cobrar"}_${getTodayLocal()}.xlsx`,
      sheets: [{ name: activeTab === "emitido" ? "A pagar" : "A cobrar", rows }]
    });
    setMessage("Exportacion generada correctamente.");
  }

  if (loading) {
    return <StateCard text="Cargando cheques..." />;
  }

  return (
    <div className="min-w-0 space-y-5">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Agenda financiera</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">CHEQUES</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Control de cheques diferidos emitidos y recibidos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white shadow-soft" type="button" onClick={() => setShowCreateModal(true)}>
            <PlusCircle className="h-4 w-4" aria-hidden="true" />
            Registrar cheque
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={() => exportFilteredExcel(false)}>
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar Excel
          </button>
          <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-next-blue px-4 text-sm font-black text-next-blue" type="button" onClick={() => exportFilteredExcel(true)}>
            Exportar todos
          </button>
        </div>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="inline-flex rounded-lg border border-slate-200 bg-white p-1 shadow-soft">
        <TabButton active={activeTab === "emitido"} onClick={() => setActiveTab("emitido")}>A pagar</TabButton>
        <TabButton active={activeTab === "recibido"} onClick={() => setActiveTab("recibido")}>A cobrar</TabButton>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={activeTab === "emitido" ? "A pagar hoy" : "A cobrar hoy"}
          value={formatCurrencyPYG(metrics.today)}
          tone={activeTab === "emitido" ? "red" : "green"}
          onClick={() => setQuick("hoy")}
        />
        <MetricCard
          label={activeTab === "emitido" ? "A pagar proximos 7 dias" : "A cobrar proximos 7 dias"}
          value={formatCurrencyPYG(metrics.next7)}
          tone="orange"
          onClick={() => setQuick("proximos7")}
        />
        <MetricCard
          label="Total pendiente"
          value={formatCurrencyPYG(metrics.pending)}
          tone={activeTab === "emitido" ? "red" : "green"}
          onClick={() => setQuick("todos")}
        />
        <MetricCard
          label="Vencidos"
          value={`${metrics.overdueCount} - ${formatCurrencyPYG(metrics.overdueAmount)}`}
          tone="critical"
          onClick={() => setQuick("vencidos")}
        />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="grid gap-2 xl:grid-cols-[130px_130px_150px_minmax(180px,1fr)_minmax(160px,1fr)_150px_minmax(220px,1.2fr)]">
          <Field label="Desde"><input className="field" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></Field>
          <Field label="Hasta"><input className="field" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></Field>
          <Field label="Estado">
            <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              {statusOptionsByTab[activeTab].map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label={activeTab === "emitido" ? "Beneficiario" : "Cliente / Pagador"}>
            <select className="field" value={partyFilter} onChange={(event) => setPartyFilter(event.target.value)}>
              <option value="">Todos</option>
              {options.parties.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Obra">
            <select className="field" value={workFilter} onChange={(event) => setWorkFilter(event.target.value)}>
              <option value="">Todas</option>
              {options.works.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
          </Field>
          <Field label="Banco">
            <select className="field" value={bankFilter} onChange={(event) => setBankFilter(event.target.value)}>
              <option value="">Todos</option>
              {options.banks.map((value) => <option key={value} value={value}>{value || "Sin banco"}</option>)}
            </select>
          </Field>
          <Field label="Buscar">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-next-muted" aria-hidden="true" />
              <input className="field pl-9" placeholder="Nro, obra, banco, texto" value={query} onChange={(event) => setQuery(event.target.value)} />
            </label>
          </Field>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(["todos", "hoy", "proximos7", "mes", "vencidos"] as QuickFilter[]).map((filter) => (
            <button
              key={filter}
              className={`h-9 rounded-md px-3 text-xs font-black ${quickFilter === filter ? "bg-next-blue text-white" : "border border-slate-200 text-next-muted"}`}
              type="button"
              onClick={() => setQuick(filter)}
            >
              {quickLabel(filter)}
            </button>
          ))}
          <button className="h-9 rounded-md border border-slate-200 px-3 text-xs font-black text-next-muted" type="button" onClick={clearFilters}>
            Limpiar filtros
          </button>
          <div className="ml-auto flex items-center gap-2">
            <select className="field h-9 w-36 py-1 text-xs" value={density} onChange={(event) => setDensity(event.target.value as Density)}>
              <option value="compacta">Vista compacta</option>
              <option value="comoda">Vista comoda</option>
            </select>
            <select className="field h-9 w-24 py-1 text-xs" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white shadow-soft">
        <div className="flex flex-col justify-between gap-2 border-b border-slate-100 px-4 py-3 md:flex-row md:items-center">
          <div>
            <p className="text-sm font-black text-next-text">{filtered.length} cheques encontrados</p>
            <p className="text-xs font-semibold text-next-muted">Total filtrado: <span className="font-black text-next-blue">{formatCurrencyPYG(totalFiltered)}</span></p>
          </div>
          <p className="text-xs font-semibold text-next-muted">
            Promedio: {formatCurrencyPYG(averageFiltered)} · Pagina {page} de {totalPages}
          </p>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <div className="max-h-[64vh] min-w-[1380px] overflow-auto">
            <table className={`w-full border-collapse text-xs ${density === "compacta" ? "cheque-table-compact" : "cheque-table-comfy"}`}>
              <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-black uppercase text-next-muted shadow-[0_1px_0_rgba(148,163,184,0.35)]">
                <tr>
                  <SortableTh label={activeTab === "emitido" ? "Fecha expedicion" : "Fecha recepcion / expedicion"} sortKey="fechaEmision" activeSort={sort} onSort={toggleSort} />
                  <SortableTh label="Nro de cheque" sortKey="numero" activeSort={sort} onSort={toggleSort} />
                  <SortableTh label={activeTab === "emitido" ? "Fecha vencimiento" : "Fecha cobro"} sortKey="fechaVencimiento" activeSort={sort} onSort={toggleSort} />
                  <SortableTh label="Faltan" sortKey="faltan" activeSort={sort} onSort={toggleSort} />
                  <SortableTh label="Dia" sortKey="dia" activeSort={sort} onSort={toggleSort} />
                  <SortableTh label="Monto" sortKey="monto" activeSort={sort} onSort={toggleSort} align="right" />
                  <SortableTh label={activeTab === "emitido" ? "Beneficiario" : "Cliente / Pagador"} sortKey="tercero" activeSort={sort} onSort={toggleSort} />
                  <th>Descripcion</th>
                  <SortableTh label="Estado" sortKey="estado" activeSort={sort} onSort={toggleSort} />
                  <SortableTh label="Obra" sortKey="obra" activeSort={sort} onSort={toggleSort} />
                  <SortableTh label="Banco" sortKey="banco" activeSort={sort} onSort={toggleSort} />
                  <th className="text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((cheque) => (
                  <ChequeRow
                    key={cheque.id}
                    activeTab={activeTab}
                    cheque={cheque}
                    density={density}
                    onDetail={() => setSelected(cheque)}
                    onNavigate={navigate}
                    onRequestStatus={requestStatusChange}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 p-3 lg:hidden">
          {visibleRows.map((cheque) => (
            <ChequeCard
              key={cheque.id}
              activeTab={activeTab}
              cheque={cheque}
              onDetail={() => setSelected(cheque)}
              onNavigate={navigate}
              onRequestStatus={requestStatusChange}
            />
          ))}
        </div>

        {!filtered.length ? (
          <EmptyState
            text={tabCheques.length
              ? "No hay cheques con esos filtros."
              : "No hay cheques registrados todavia. Los cheques emitidos y recibidos apareceran aqui a medida que se registren movimientos financieros."}
          />
        ) : null}

        <div className="flex flex-col justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs font-semibold text-next-muted sm:flex-row sm:items-center">
          <span>Cantidad: {filtered.length} · Suma total: {formatCurrencyPYG(totalFiltered)}</span>
          <div className="flex items-center gap-2">
            <button className="h-8 rounded-md border border-slate-200 px-3 font-black disabled:opacity-50" type="button" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Anterior</button>
            <button className="h-8 rounded-md border border-slate-200 px-3 font-black disabled:opacity-50" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => Math.min(totalPages, current + 1))}>Siguiente</button>
          </div>
        </div>
      </section>

      {selected ? (
        <ChequeDetailModal
          allCheques={cheques}
          cheque={selected}
          onClose={() => setSelected(null)}
          onGoParty={(cheque) => navigate(cheque.terceroTipo === "proveedor" ? "/proveedores" : "/clientes")}
          onGoWork={(cheque) => navigate(`/finanzas-obras/${cheque.obraId}`)}
          onSave={(data) => void saveChequeDetails(selected, data)}
          onStatus={requestStatusChange}
        />
      ) : null}

      {confirmAction ? (
        <ConfirmStatusModal
          action={confirmAction}
          saving={saving}
          onCancel={() => setConfirmAction(null)}
          onChangeDate={(dateValue) => setConfirmAction((current) => current ? { ...current, dateValue } : current)}
          onConfirm={() => void confirmStatusChange()}
        />
      ) : null}

      {showCreateModal ? (
        <ManualChequeModal
          saving={saving}
          onClose={() => setShowCreateModal(false)}
          onSave={(form) => void saveManualCheque(form)}
        />
      ) : null}

      <style>{`
        .cheque-table-compact th,
        .cheque-table-compact td { padding: 0.42rem 0.55rem; }
        .cheque-table-comfy th,
        .cheque-table-comfy td { padding: 0.72rem 0.65rem; }
        @media (prefers-reduced-motion: no-preference) {
          .cheque-pulse { animation: chequePulse 1.8s ease-in-out infinite; }
          @keyframes chequePulse {
            0%, 100% { opacity: 0.55; transform: scale(1); }
            50% { opacity: 1; transform: scale(1.08); }
          }
        }
      `}</style>
    </div>
  );
}

function ChequeRow({
  activeTab,
  cheque,
  density,
  onDetail,
  onNavigate,
  onRequestStatus
}: {
  activeTab: ActiveTab;
  cheque: Cheque;
  density: Density;
  onDetail: () => void;
  onNavigate: (path: string) => void;
  onRequestStatus: (cheque: Cheque, nextStatus: ChequeStatus) => void;
}) {
  return (
    <tr className={`${rowTone(cheque)} border-b border-slate-100 text-next-text`}>
      <td className="whitespace-nowrap font-bold">{formatDisplayDate(cheque.fechaEmisionCheque)}</td>
      <td className="whitespace-nowrap font-black">{cheque.numeroCheque}</td>
      <td className="whitespace-nowrap font-bold">{formatDisplayDate(getChequeDueDate(cheque))}</td>
      <td className="min-w-32">
        <DueLabel cheque={cheque} />
      </td>
      <td className="whitespace-nowrap capitalize">{getWeekdayName(getChequeDueDate(cheque))}</td>
      <td className="whitespace-nowrap text-right font-black">{formatCurrencyPYG(cheque.monto)}</td>
      <td className="max-w-56 truncate font-semibold" title={cheque.terceroNombre}>{cheque.terceroNombre}</td>
      <td className="max-w-64 truncate text-next-muted" title={getChequeDescription(cheque)}>{getChequeDescription(cheque)}</td>
      <td><StatusBadge label={displayState(cheque)} status={statusBadge(cheque)} /></td>
      <td className="max-w-52 truncate" title={cheque.obraNombre}>{cheque.obraNombre}</td>
      <td className="max-w-36 truncate" title={cheque.bancoCheque}>{cheque.bancoCheque || ""}</td>
      <td>
        <ChequeActions
          activeTab={activeTab}
          cheque={cheque}
          compact={density === "compacta"}
          onDetail={onDetail}
          onNavigate={onNavigate}
          onRequestStatus={onRequestStatus}
        />
      </td>
    </tr>
  );
}

function ChequeCard({
  activeTab,
  cheque,
  onDetail,
  onNavigate,
  onRequestStatus
}: {
  activeTab: ActiveTab;
  cheque: Cheque;
  onDetail: () => void;
  onNavigate: (path: string) => void;
  onRequestStatus: (cheque: Cheque, nextStatus: ChequeStatus) => void;
}) {
  return (
    <article className={`rounded-lg border p-4 ${mobileTone(cheque)}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase text-next-muted">{activeTab === "emitido" ? "A pagar" : "A cobrar"}</p>
          <h3 className="mt-1 truncate text-base font-black text-next-text">{cheque.terceroNombre}</h3>
          <p className="mt-1 text-sm font-semibold text-next-muted">{formatDisplayDate(getChequeDueDate(cheque))} · {getWeekdayName(getChequeDueDate(cheque))}</p>
        </div>
        <p className={`whitespace-nowrap text-right text-lg font-black ${activeTab === "emitido" ? "text-next-red" : "text-next-green"}`}>{formatCurrencyPYG(cheque.monto)}</p>
      </div>
      <div className="mt-3 grid gap-2 text-sm">
        <MobileLine label="Faltan" value={<DueLabel cheque={cheque} />} />
        <MobileLine label="Nro cheque" value={cheque.numeroCheque} />
        <MobileLine label="Estado" value={displayState(cheque)} />
        <MobileLine label="Obra" value={cheque.obraNombre} />
        <MobileLine label="Banco" value={cheque.bancoCheque || ""} />
      </div>
      <div className="mt-3">
        <ChequeActions activeTab={activeTab} cheque={cheque} onDetail={onDetail} onNavigate={onNavigate} onRequestStatus={onRequestStatus} />
      </div>
    </article>
  );
}

function ChequeActions({
  activeTab,
  cheque,
  compact = false,
  onDetail,
  onNavigate,
  onRequestStatus
}: {
  activeTab: ActiveTab;
  cheque: Cheque;
  compact?: boolean;
  onDetail: () => void;
  onNavigate: (path: string) => void;
  onRequestStatus: (cheque: Cheque, nextStatus: ChequeStatus) => void;
}) {
  const finalStatus: ChequeStatus = activeTab === "emitido" ? "debitado" : "cobrado";
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "justify-end" : ""}`}>
      <button className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-next-blue" type="button" onClick={onDetail}>
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        Ver
      </button>
      {!isChequeClosed(cheque) ? (
        <>
          <button className="h-8 rounded-md bg-next-blue px-2 text-[11px] font-black text-white" type="button" onClick={() => onRequestStatus(cheque, finalStatus)}>
            {activeTab === "emitido" ? "Pagado" : "Cobrado"}
          </button>
          <button className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-next-muted" type="button" onClick={() => onRequestStatus(cheque, "anulado")}>
            Anular
          </button>
        </>
      ) : null}
      {cheque.obraId ? (
        <button className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-next-muted" type="button" onClick={() => onNavigate(`/finanzas-obras/${cheque.obraId}`)}>
          Obra
        </button>
      ) : null}
      <button className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-next-muted" type="button" onClick={() => onNavigate(cheque.terceroTipo === "proveedor" ? "/proveedores" : "/clientes")}>
        {compact ? <MoreHorizontal className="h-3.5 w-3.5" aria-hidden="true" /> : "Cliente/proveedor"}
      </button>
    </div>
  );
}

function ManualChequeModal({
  onClose,
  onSave,
  saving
}: {
  onClose: () => void;
  onSave: (form: ManualChequeForm) => void;
  saving: boolean;
}) {
  const today = getTodayLocal();
  const [form, setForm] = useState<ManualChequeForm>({
    tipo: "emitido",
    terceroTipo: "proveedor",
    terceroNombre: "",
    monto: 0,
    numeroCheque: "",
    bancoCheque: "",
    fechaEmisionCheque: today,
    fechaCobroCheque: today,
    estado: "emitido",
    obraNombre: "",
    observacion: ""
  });
  const [formError, setFormError] = useState("");

  function updateType(tipo: ChequeKind) {
    setForm((current) => ({
      ...current,
      tipo,
      terceroTipo: tipo === "recibido" ? "cliente" : "proveedor",
      estado: tipo === "recibido" ? "recibido" : "emitido"
    }));
  }

  function submit() {
    const terceroNombre = form.terceroNombre.trim();
    const numeroCheque = form.numeroCheque.trim();
    if (!terceroNombre) {
      setFormError(form.tipo === "recibido" ? "Carga el cliente o pagador." : "Carga el proveedor o beneficiario.");
      return;
    }
    if (!numeroCheque) {
      setFormError("Carga el numero de cheque.");
      return;
    }
    if (form.monto <= 0) {
      setFormError("Carga un monto mayor a cero.");
      return;
    }
    if (!form.fechaEmisionCheque || !form.fechaCobroCheque) {
      setFormError("Carga las fechas de emision y cobro/vencimiento.");
      return;
    }
    if (form.fechaCobroCheque < form.fechaEmisionCheque) {
      setFormError("La fecha de cobro/vencimiento no puede ser anterior a la emision.");
      return;
    }
    setFormError("");
    onSave({
      ...form,
      terceroNombre: toTitleCase(terceroNombre),
      numeroCheque,
      bancoCheque: toTitleCase(form.bancoCheque),
      obraNombre: form.obraNombre ? toTitleCase(form.obraNombre) : ""
    });
  }

  const statusOptions = form.tipo === "recibido"
    ? [
        { value: "recibido", label: "Recibido" },
        { value: "depositado", label: "Depositado" },
        { value: "cobrado", label: "Cobrado" },
        { value: "rechazado", label: "Rechazado" },
        { value: "anulado", label: "Anulado" }
      ]
    : [
        { value: "emitido", label: "Emitido" },
        { value: "entregado", label: "Entregado" },
        { value: "debitado", label: "Pagado / debitado" },
        { value: "rechazado", label: "Rechazado" },
        { value: "anulado", label: "Anulado" }
      ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Carga manual</p>
            <h2 className="mt-1 text-xl font-black text-next-text">Registrar cheque</h2>
            <p className="mt-1 text-sm font-semibold text-next-muted">La obra es opcional para esta primera fase de prueba.</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {formError ? <Notice tone="error" text={formError} /> : null}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Tipo">
            <select className="field" value={form.tipo} onChange={(event) => updateType(event.target.value as ChequeKind)}>
              <option value="emitido">Cheque emitido / pago</option>
              <option value="recibido">Cheque recibido / ingreso</option>
            </select>
          </Field>
          <Field label="Estado inicial">
            <select className="field" value={form.estado} onChange={(event) => setForm({ ...form, estado: event.target.value as ChequeStatus })}>
              {statusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </Field>
          <Field label={form.tipo === "recibido" ? "Cliente / pagador" : "Proveedor / beneficiario"}>
            <input className="field" value={form.terceroNombre} onBlur={() => setForm({ ...form, terceroNombre: toTitleCase(form.terceroNombre) })} onChange={(event) => setForm({ ...form, terceroNombre: event.target.value })} />
          </Field>
          <Field label="Tipo de tercero">
            <select className="field" value={form.terceroTipo} onChange={(event) => setForm({ ...form, terceroTipo: event.target.value as ChequeThirdPartyType })}>
              <option value="cliente">Cliente</option>
              <option value="proveedor">Proveedor</option>
              <option value="persona">Persona</option>
            </select>
          </Field>
          <Field label="Monto">
            <CurrencyInput value={form.monto} onValueChange={(value) => setForm({ ...form, monto: value })} />
          </Field>
          <Field label="Nro de cheque">
            <input className="field" value={form.numeroCheque} onChange={(event) => setForm({ ...form, numeroCheque: event.target.value })} />
          </Field>
          <Field label="Banco">
            <input className="field" value={form.bancoCheque} onBlur={() => setForm({ ...form, bancoCheque: toTitleCase(form.bancoCheque) })} onChange={(event) => setForm({ ...form, bancoCheque: event.target.value })} />
          </Field>
          <Field label="Obra vinculada opcional">
            <input className="field" placeholder="Sin obra por ahora" value={form.obraNombre} onBlur={() => setForm({ ...form, obraNombre: toTitleCase(form.obraNombre) })} onChange={(event) => setForm({ ...form, obraNombre: event.target.value })} />
          </Field>
          <Field label="Fecha de emision">
            <input className="field" type="date" value={form.fechaEmisionCheque} onChange={(event) => setForm({ ...form, fechaEmisionCheque: event.target.value })} />
          </Field>
          <Field label="Fecha de cobro / vencimiento">
            <input className="field" type="date" value={form.fechaCobroCheque} onChange={(event) => setForm({ ...form, fechaCobroCheque: event.target.value })} />
          </Field>
          <label className="block text-[11px] font-black uppercase text-next-muted sm:col-span-2">
            observacion
            <textarea className="field mt-1 min-h-24" value={form.observacion} onChange={(event) => setForm({ ...form, observacion: event.target.value })} />
          </label>
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button className="h-10 rounded-md border border-slate-200 px-4 text-xs font-black text-next-muted" type="button" onClick={onClose}>Cancelar</button>
          <button className="h-10 rounded-md bg-next-blue px-4 text-xs font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={submit}>
            {saving ? "Guardando..." : "Registrar cheque"}
          </button>
        </div>
      </section>
    </div>
  );
}
function ChequeDetailModal({
  allCheques,
  cheque,
  onClose,
  onGoParty,
  onGoWork,
  onSave,
  onStatus
}: {
  allCheques: Cheque[];
  cheque: Cheque;
  onClose: () => void;
  onGoParty: (cheque: Cheque) => void;
  onGoWork: (cheque: Cheque) => void;
  onSave: (data: Partial<Cheque>) => void;
  onStatus: (cheque: Cheque, status: ChequeStatus) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    numeroCheque: cheque.numeroCheque,
    bancoCheque: cheque.bancoCheque ?? "",
    fechaEmisionCheque: cheque.fechaEmisionCheque,
    fechaCobroCheque: getChequeDueDate(cheque),
    monto: String(cheque.monto),
    observacion: cheque.observacion ?? ""
  });
  const duplicate = findPossibleDuplicate(allCheques, cheque, draft);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Detalle de cheque</p>
            <h2 className="mt-1 text-xl font-black text-next-text">{cheque.numeroCheque}</h2>
            <p className="mt-1 text-sm font-semibold text-next-muted">{cheque.tipo === "emitido" ? "Emitido" : "Recibido"} · {displayState(cheque)}</p>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Monto" value={formatCurrencyPYG(cheque.monto)} />
          <DetailItem label="Faltan" value={getDueAlert(cheque).text} />
          <DetailItem label="Fecha expedicion" value={formatDisplayDate(cheque.fechaEmisionCheque)} />
          <DetailItem label="Fecha vencimiento/cobro" value={formatDisplayDate(getChequeDueDate(cheque))} />
          <DetailItem label="Banco" value={cheque.bancoCheque || ""} />
          <DetailItem label={cheque.tipo === "emitido" ? "Beneficiario" : "Cliente / Pagador"} value={cheque.terceroNombre} />
          <DetailItem label="Obra" value={cheque.obraNombre || "Sin obra vinculada"} />
          <DetailItem label="Descripcion" value={getChequeDescription(cheque)} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {cheque.obraId ? <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => onGoWork(cheque)}>Ver obra</button> : null}
          <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => onGoParty(cheque)}>Ver cliente/proveedor</button>
          <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => setEditing((current) => !current)}>Editar</button>
          {!isChequeClosed(cheque) ? (
            <>
              <button className="h-9 rounded-md bg-next-blue px-3 text-xs font-black text-white" type="button" onClick={() => onStatus(cheque, cheque.tipo === "emitido" ? "debitado" : "cobrado")}>
                {cheque.tipo === "emitido" ? "Marcar pagado" : "Marcar cobrado"}
              </button>
              <button className="h-9 rounded-md border border-slate-200 px-3 text-xs font-black text-next-muted" type="button" onClick={() => onStatus(cheque, "anulado")}>Anular</button>
            </>
          ) : null}
        </div>
        {editing ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-next-bg p-3">
            <p className="text-xs font-black uppercase text-next-blue">Editar cheque</p>
            {duplicate ? (
              <div className="mt-3 rounded-md border border-orange-100 bg-orange-50 px-3 py-2 text-xs font-semibold text-next-orange">
                Posible duplicado: existe otro cheque similar con mismo numero, banco, monto y tercero.
              </div>
            ) : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Nro cheque"><input className="field" value={draft.numeroCheque} onChange={(event) => setDraft({ ...draft, numeroCheque: event.target.value })} /></Field>
              <Field label="Banco"><input className="field" value={draft.bancoCheque} onChange={(event) => setDraft({ ...draft, bancoCheque: event.target.value })} /></Field>
              <Field label="Fecha expedicion"><input className="field" type="date" value={draft.fechaEmisionCheque} onChange={(event) => setDraft({ ...draft, fechaEmisionCheque: event.target.value })} /></Field>
              <Field label="Fecha vencimiento/cobro"><input className="field" type="date" value={draft.fechaCobroCheque} onChange={(event) => setDraft({ ...draft, fechaCobroCheque: event.target.value })} /></Field>
              <Field label="Monto"><input className="field" min={0} type="number" value={draft.monto} onChange={(event) => setDraft({ ...draft, monto: event.target.value })} /></Field>
              <Field label="Descripcion"><input className="field" value={draft.observacion} onChange={(event) => setDraft({ ...draft, observacion: event.target.value })} /></Field>
            </div>
            <button
              className="mt-3 h-10 rounded-md bg-next-blue px-4 text-xs font-black text-white"
              type="button"
              onClick={() => {
                onSave({
                  numeroCheque: draft.numeroCheque,
                  bancoCheque: draft.bancoCheque || undefined,
                  fechaEmisionCheque: draft.fechaEmisionCheque,
                  fechaCobroCheque: draft.fechaCobroCheque,
                  fechaVencimientoCheque: draft.fechaCobroCheque,
                  monto: Number(draft.monto || 0),
                  observacion: draft.observacion || undefined
                });
                setEditing(false);
              }}
            >
              Guardar cheque
            </button>
          </div>
        ) : null}
        <div className="mt-5 rounded-lg bg-next-bg p-3">
          <p className="text-xs font-black uppercase text-next-muted">Historial de cambios</p>
          <div className="mt-2 space-y-2">
            {(cheque.historial ?? []).length ? cheque.historial!.map((item, index) => (
              <p key={`${item.fecha}-${index}`} className="text-sm font-semibold text-next-text">
                {formatDisplayDate(item.fecha.slice(0, 10))} · {displayStatusFromRaw(cheque.tipo, item.estado)} · {item.usuario ?? "Sistema"}
              </p>
            )) : <p className="text-sm font-semibold text-next-muted">Sin historial registrado.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function ConfirmStatusModal({
  action,
  onCancel,
  onChangeDate,
  onConfirm,
  saving
}: {
  action: NonNullable<ConfirmAction>;
  onCancel: () => void;
  onChangeDate: (value: string) => void;
  onConfirm: () => void;
  saving: boolean;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 px-3">
      <section className="w-full max-w-md rounded-lg bg-white p-5 shadow-2xl">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-next-light text-next-blue">
            <CheckCircle2 className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-black text-next-text">{action.title}</h2>
            <p className="mt-2 text-sm font-semibold leading-6 text-next-muted">{action.text}</p>
          </div>
        </div>
        <label className="mt-4 block text-xs font-black uppercase text-next-muted">
          {action.dateLabel}
          <input className="field mt-1" type="date" value={action.dateValue} onChange={(event) => onChangeDate(event.target.value)} />
        </label>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <button className="h-10 rounded-md border border-slate-200 px-4 text-xs font-black text-next-muted" type="button" onClick={onCancel}>Cancelar</button>
          <button className="h-10 rounded-md bg-next-blue px-4 text-xs font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={onConfirm}>
            {saving ? "Guardando..." : "Confirmar"}
          </button>
        </div>
      </section>
    </div>
  );
}

function SortableTh({
  activeSort,
  align,
  label,
  onSort,
  sortKey
}: {
  activeSort: { key: SortKey; direction: SortDirection };
  align?: "right";
  label: string;
  onSort: (key: SortKey) => void;
  sortKey: SortKey;
}) {
  const active = activeSort.key === sortKey;
  return (
    <th className={align === "right" ? "text-right" : ""}>
      <button className={`inline-flex items-center gap-1 ${align === "right" ? "justify-end" : ""}`} type="button" onClick={() => onSort(sortKey)}>
        {label}
        {active ? activeSort.direction === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden="true" /> : <ArrowDown className="h-3 w-3" aria-hidden="true" /> : null}
      </button>
    </th>
  );
}

function DueLabel({ cheque }: { cheque: Cheque }) {
  const alert = getDueAlert(cheque);
  const tone = {
    overdue: "bg-red-50 text-next-red ring-red-100",
    today: "bg-orange-50 text-next-orange ring-orange-100",
    soon: "bg-amber-50 text-amber-700 ring-amber-100",
    normal: "bg-slate-50 text-next-muted ring-slate-100",
    closed: "bg-green-50 text-next-green ring-green-100",
    void: "bg-slate-100 text-next-muted ring-slate-200"
  }[alert.level];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-black ring-1 ${tone}`}>
      {alert.level === "overdue" || alert.level === "today" ? <AlertTriangle className="cheque-pulse h-3 w-3" aria-hidden="true" /> : null}
      {alert.text}
    </span>
  );
}

function MetricCard({ label, onClick, tone, value }: { label: string; onClick: () => void; tone: "green" | "red" | "orange" | "critical"; value: string }) {
  const classes = {
    green: "text-next-green bg-green-50",
    red: "text-next-red bg-red-50",
    orange: "text-next-orange bg-orange-50",
    critical: "text-next-red bg-red-50"
  };
  return (
    <button className="rounded-lg border border-slate-200 bg-white p-3 text-left shadow-soft transition hover:-translate-y-0.5 hover:shadow-lg" type="button" onClick={onClick}>
      <span className={`inline-flex h-9 w-9 items-center justify-center rounded-md ${classes[tone]}`}>
        <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
      </span>
      <p className="mt-2 text-[11px] font-black uppercase text-next-muted">{label}</p>
      <p className={`mt-1 whitespace-nowrap text-lg font-black ${classes[tone].split(" ")[0]}`}>{value}</p>
    </button>
  );
}

function TabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button className={`h-10 rounded-md px-5 text-sm font-black ${active ? "bg-next-blue text-white shadow-soft" : "text-next-muted"}`} type="button" onClick={onClick}>
      {children}
    </button>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-[11px] font-black uppercase text-next-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-next-bg p-3">
      <p className="text-xs font-black uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-next-text">{value}</p>
    </div>
  );
}

function MobileLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="font-semibold text-next-muted">{label}</span>
      <span className="text-right font-black text-next-text">{value}</span>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success" ? "border-green-100 bg-green-50 text-next-green" : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function StateCard({ text }: { text: string }) {
  return <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-bold text-next-muted shadow-soft">{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return <div className="p-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}

function buildFilterOptions(cheques: Cheque[]) {
  return {
    parties: uniqueSorted(cheques.map((cheque) => cheque.terceroNombre).filter(Boolean)),
    works: uniqueSorted(cheques.map((cheque) => cheque.obraNombre).filter(Boolean)),
    banks: uniqueSorted(cheques.map((cheque) => cheque.bancoCheque ?? "").filter((value) => value !== ""))
  };
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b, "es"));
}

function getTabMetrics(cheques: Cheque[], tab: ActiveTab) {
  const pending = cheques.filter((cheque) => !isChequeClosed(cheque));
  const today = getTodayLocal();
  const next7End = addDaysInput(today, 7);
  const todayAmount = sumCheques(pending.filter((cheque) => getChequeDueDate(cheque) === today));
  const next7 = sumCheques(pending.filter((cheque) => inRange(getChequeDueDate(cheque), today, next7End)));
  const overdue = pending.filter((cheque) => getChequeDueDate(cheque) < today);
  return {
    today: todayAmount,
    next7,
    pending: sumCheques(pending),
    overdueCount: overdue.length,
    overdueAmount: sumCheques(overdue),
    tab
  };
}

function matchesStatusFilter(cheque: Cheque, tab: ActiveTab, filter: string) {
  if (filter === "todos") return true;
  const normalized = normalizedDisplayState(cheque);
  if (filter === "pendiente") return normalized === "pendiente";
  if (filter === "pagado") return tab === "emitido" && normalized === "pagado";
  if (filter === "cobrado") return tab === "recibido" && normalized === "cobrado";
  return cheque.estado === filter;
}

function matchesQuickFilter(cheque: Cheque, filter: QuickFilter) {
  if (filter === "todos") return true;
  const dueDate = getChequeDueDate(cheque);
  const today = getTodayLocal();
  if (filter === "hoy") return dueDate === today;
  if (filter === "vencidos") return dueDate < today && !isChequeClosed(cheque);
  if (filter === "proximos7") return inRange(dueDate, today, addDaysInput(today, 7));
  return dueDate.startsWith(today.slice(0, 7));
}

function sortCheques(rows: Cheque[], sort: { key: SortKey; direction: SortDirection }) {
  const direction = sort.direction === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const priorityDiff = defaultPriority(a) - defaultPriority(b);
    if (sort.key === "fechaVencimiento" && priorityDiff !== 0) return priorityDiff;
    const diff = compareValues(sortValue(a, sort.key), sortValue(b, sort.key));
    if (diff !== 0) return diff * direction;
    return compareValues(getChequeDueDate(a), getChequeDueDate(b));
  });
}

function defaultPriority(cheque: Cheque) {
  if (isChequeClosed(cheque)) return 2;
  if (getChequeDueDate(cheque) < getTodayLocal()) return 0;
  return 1;
}

function sortValue(cheque: Cheque, key: SortKey) {
  if (key === "fechaEmision") return cheque.fechaEmisionCheque;
  if (key === "numero") return cheque.numeroCheque;
  if (key === "fechaVencimiento") return getChequeDueDate(cheque);
  if (key === "faltan") return getDaysDiff(getChequeDueDate(cheque));
  if (key === "dia") return getWeekdayName(getChequeDueDate(cheque));
  if (key === "monto") return cheque.monto;
  if (key === "tercero") return cheque.terceroNombre;
  if (key === "estado") return displayState(cheque);
  if (key === "obra") return cheque.obraNombre || "";
  return cheque.bancoCheque ?? "";
}

function compareValues(a: string | number, b: string | number) {
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "es", { numeric: true });
}

function getChequeDueDate(cheque: Cheque) {
  return cheque.fechaCobroCheque || cheque.fechaVencimientoCheque || cheque.fechaEmisionCheque || getTodayLocal();
}

function getChequeDescription(cheque: Cheque) {
  return cheque.observacion || (cheque.origen === "manual" ? "Cheque manual" : cheque.origen) || "";
}

function getDueAlert(cheque: Cheque): { level: "overdue" | "today" | "soon" | "normal" | "closed" | "void"; text: string } {
  if (cheque.estado === "anulado") return { level: "void", text: "Anulado" };
  if (isChequeClosed(cheque)) return { level: "closed", text: displayState(cheque) };
  const diff = getDaysDiff(getChequeDueDate(cheque));
  if (diff < 0) return { level: "overdue", text: `Vencido hace ${Math.abs(diff)} dia${Math.abs(diff) === 1 ? "" : "s"}` };
  if (diff === 0) return { level: "today", text: "Vence hoy" };
  if (diff === 1) return { level: "soon", text: "Manana" };
  if (diff <= 7) return { level: "soon", text: `${diff} dias` };
  return { level: "normal", text: `${diff} dias` };
}

function getDaysDiff(dateValue: string) {
  const today = parseInputDate(getTodayLocal()).getTime();
  const target = parseInputDate(dateValue).getTime();
  return Math.round((target - today) / 86400000);
}

function isChequeClosed(cheque: Cheque) {
  return cheque.tipo === "recibido" ? closedReceivedStatuses.includes(cheque.estado) : closedIssuedStatuses.includes(cheque.estado);
}

function normalizedDisplayState(cheque: Cheque) {
  if (cheque.estado === "anulado") return "anulado";
  if (cheque.estado === "rechazado") return "rechazado";
  if (cheque.tipo === "emitido" && paidIssuedStatuses.includes(cheque.estado)) return "pagado";
  if (cheque.tipo === "recibido" && cheque.estado === "cobrado") return "cobrado";
  if (cheque.tipo === "emitido" && pendingIssuedStatuses.includes(cheque.estado)) return "pendiente";
  if (cheque.tipo === "recibido" && pendingReceivedStatuses.includes(cheque.estado)) return "pendiente";
  return "pendiente";
}

function displayState(cheque: Cheque) {
  const normalized = normalizedDisplayState(cheque);
  if (normalized === "pagado") return "Pagado";
  if (normalized === "cobrado") return "Cobrado";
  if (normalized === "anulado") return "Anulado";
  if (normalized === "rechazado") return "Rechazado";
  return "Pendiente";
}

function displayStatusFromRaw(type: ChequeKind, status: ChequeStatus) {
  return displayState({ tipo: type, estado: status } as Cheque);
}

function statusBadge(cheque: Cheque): BadgeStatus {
  const state = normalizedDisplayState(cheque);
  if (state === "anulado") return "neutral";
  if (state === "rechazado") return "critical";
  if (state === "pagado" || state === "cobrado") return "success";
  if (getChequeDueDate(cheque) < getTodayLocal()) return "critical";
  return cheque.tipo === "recibido" ? "info" : "warning";
}

function rowTone(cheque: Cheque) {
  const alert = getDueAlert(cheque);
  if (alert.level === "void") return "bg-slate-50 text-next-muted opacity-75";
  if (alert.level === "closed") return "bg-green-50/35";
  if (alert.level === "overdue") return "border-l-4 border-l-next-red bg-red-50/80";
  if (alert.level === "today") return "border-l-4 border-l-next-orange bg-orange-50/80";
  if (alert.level === "soon") return "border-l-4 border-l-amber-400 bg-amber-50/50";
  return "bg-white hover:bg-slate-50";
}

function mobileTone(cheque: Cheque) {
  const alert = getDueAlert(cheque);
  if (alert.level === "overdue") return "border-red-100 bg-red-50";
  if (alert.level === "today") return "border-orange-100 bg-orange-50";
  if (alert.level === "soon") return "border-amber-100 bg-amber-50";
  if (alert.level === "void") return "border-slate-200 bg-slate-50 opacity-75";
  return cheque.tipo === "recibido" ? "border-green-100 bg-green-50/50" : "border-slate-200 bg-white";
}

function quickLabel(filter: QuickFilter) {
  const labels: Record<QuickFilter, string> = {
    todos: "Todos",
    hoy: "Hoy",
    proximos7: "Proximos 7 dias",
    mes: "Este mes",
    vencidos: "Vencidos"
  };
  return labels[filter];
}

function statusChangeTitle(cheque: Cheque, nextStatus: ChequeStatus) {
  if (nextStatus === "debitado") return `Marcar cheque ${cheque.numeroCheque} como pagado`;
  if (nextStatus === "cobrado") return `Marcar cheque ${cheque.numeroCheque} como cobrado`;
  if (nextStatus === "anulado") return `Anular cheque ${cheque.numeroCheque}`;
  return `Actualizar cheque ${cheque.numeroCheque}`;
}

function mergeObservation(current: string | undefined, next: string) {
  if (!current) return next;
  if (current.includes(next)) return current;
  return `${current}\n${next}`;
}

function findPossibleDuplicate(allCheques: Cheque[], cheque: Cheque, draft: { numeroCheque: string; bancoCheque: string; monto: string }) {
  return allCheques.find((item) =>
    item.id !== cheque.id &&
    item.numeroCheque.trim().toLowerCase() === draft.numeroCheque.trim().toLowerCase() &&
    (item.bancoCheque ?? "").trim().toLowerCase() === draft.bancoCheque.trim().toLowerCase() &&
    Number(item.monto) === Number(draft.monto || 0) &&
    item.terceroNombre.trim().toLowerCase() === cheque.terceroNombre.trim().toLowerCase()
  );
}

function buildExportRow(cheque: Cheque, tab: ActiveTab): Record<string, string | number> {
  return {
    "Fecha expedicion": formatDisplayDate(cheque.fechaEmisionCheque),
    Numero: cheque.numeroCheque,
    "Fecha vencimiento": formatDisplayDate(getChequeDueDate(cheque)),
    Faltan: getDueAlert(cheque).text,
    Dia: getWeekdayName(getChequeDueDate(cheque)),
    Monto: cheque.monto,
    [tab === "emitido" ? "Beneficiario" : "Cliente / Pagador"]: cheque.terceroNombre,
    Descripcion: getChequeDescription(cheque),
    Estado: displayState(cheque),
    Obra: cheque.obraNombre,
    Banco: cheque.bancoCheque ?? "",
    Tipo: cheque.tipo === "emitido" ? "Emitido" : "Recibido"
  };
}

function sumCheques(cheques: Cheque[]) {
  return cheques.reduce((sum, cheque) => sum + Number(cheque.monto || 0), 0);
}

function inRange(value: string, start: string, end: string) {
  return value >= start && value <= end;
}

function getTodayLocal() {
  const date = new Date();
  return toInputDate(date);
}

function addDaysInput(input: string, days: number) {
  const date = parseInputDate(input);
  date.setDate(date.getDate() + days);
  return toInputDate(date);
}

function parseInputDate(input: string) {
  const [year, month, day] = input.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1, 0, 0, 0, 0);
}

function toInputDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDisplayDate(input: string) {
  if (!input) return "";
  const date = parseInputDate(input.slice(0, 10));
  const day = String(date.getDate()).padStart(2, "0");
  const month = date.toLocaleDateString("es-PY", { month: "short" }).replace(".", "").toLowerCase();
  const year = String(date.getFullYear()).slice(2);
  return `${day}-${month}-${year}`;
}

function getWeekdayName(input: string) {
  if (!input) return "";
  return parseInputDate(input.slice(0, 10)).toLocaleDateString("es-PY", { weekday: "long" }).toLowerCase();
}
