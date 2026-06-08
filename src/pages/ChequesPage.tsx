import { Download, Eye, FileSpreadsheet, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  getCheques,
  syncChequesFromMovements,
  updateCheque
} from "../lib/firestore";
import type { Cheque, ChequeStatus } from "../types";
import { exportWorkbookToExcel } from "../utils/excel";
import { formatCurrencyPYG, formatDateShort, getTodayInputDate } from "../utils/formatters";

const receivedStatuses: ChequeStatus[] = ["recibido", "depositado", "cobrado", "rechazado", "anulado"];
const issuedStatuses: ChequeStatus[] = ["emitido", "entregado", "debitado", "rechazado", "anulado"];
const closedReceived = ["cobrado", "rechazado", "anulado"];
const closedIssued = ["debitado", "rechazado", "anulado"];

type QuickFilter = "todos" | "hoy" | "semana" | "mes" | "vencidos";

export default function ChequesPage() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [statusFilter, setStatusFilter] = useState("todos");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("todos");
  const [selected, setSelected] = useState<Cheque | null>(null);

  useEffect(() => {
    void load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const synced = await syncChequesFromMovements();
      setCheques(synced);
    } catch (loadError) {
      console.error("No se pudieron sincronizar cheques.", loadError);
      try {
        setCheques(await getCheques());
      } catch (fallbackError) {
        setError(fallbackError instanceof Error ? fallbackError.message : "No se pudieron cargar los cheques.");
      }
    } finally {
      setLoading(false);
    }
  }

  const filtered = useMemo(() => {
    return cheques.filter((cheque) => {
      const dueDate = getChequeDueDate(cheque);
      const text = [
        cheque.terceroNombre,
        cheque.obraNombre,
        cheque.numeroCheque,
        cheque.bancoCheque,
        cheque.observacion
      ].join(" ").toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesType = typeFilter === "todos" || cheque.tipo === typeFilter;
      const matchesStatus = statusFilter === "todos" || cheque.estado === statusFilter;
      const matchesFrom = !fromDate || dueDate >= fromDate;
      const matchesTo = !toDate || dueDate <= toDate;
      const matchesQuick = matchesQuickDate(cheque, quickFilter);
      return matchesQuery && matchesType && matchesStatus && matchesFrom && matchesTo && matchesQuick;
    });
  }, [cheques, fromDate, query, quickFilter, statusFilter, toDate, typeFilter]);

  const metrics = useMemo(() => getChequeMetrics(cheques), [cheques]);

  async function changeStatus(cheque: Cheque, estado: ChequeStatus) {
    setError("");
    try {
      const updated = await updateCheque(cheque.id, {
        estado,
        updatedBy: profile?.uid ?? "unknown"
      });
      setCheques((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected((current) => current?.id === updated.id ? updated : current);
      setMessage("Estado del cheque actualizado.");
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : "No se pudo actualizar el cheque.");
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

  function exportExcel() {
    if (!filtered.length) {
      setMessage("No hay cheques para exportar con estos filtros.");
      return;
    }

    const rows = filtered.map((cheque) => ({
      "Fecha vencimiento/cobro": getChequeDueDate(cheque),
      Tipo: cheque.tipo === "recibido" ? "Recibido" : "Emitido",
      Estado: formatChequeStatus(cheque.estado),
      "Cliente/Proveedor": cheque.terceroNombre,
      Obra: cheque.obraNombre,
      Banco: cheque.bancoCheque ?? "",
      "Nº cheque": cheque.numeroCheque,
      Monto: cheque.monto,
      "Fecha emisión": cheque.fechaEmisionCheque,
      Observación: cheque.observacion ?? ""
    }));
    exportWorkbookToExcel({
      fileName: `cheques-next-control-${getTodayInputDate()}.xlsx`,
      sheets: [{ name: "Cheques", rows }]
    });
    setMessage("Exportacion generada correctamente.");
  }

  if (loading) {
    return <StateCard text="Cargando cheques..." />;
  }

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-end">
        <div>
          <p className="text-sm font-black uppercase text-next-blue">Agenda financiera</p>
          <h1 className="mt-1 text-3xl font-black tracking-normal">CHEQUES</h1>
          <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-next-muted">
            Cheques recibidos y emitidos vinculados a ingresos, compras, egresos, clientes, proveedores y obras.
          </p>
        </div>
        <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={exportExcel}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Exportar Excel
        </button>
      </div>

      {message ? <Notice tone="success" text={message} /> : null}
      {error ? <Notice tone="error" text={error} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Cheques a cobrar hoy" value={formatCurrencyPYG(metrics.toCollectToday)} tone="green" />
        <MetricCard label="Cheques a pagar hoy" value={formatCurrencyPYG(metrics.toPayToday)} tone="red" />
        <MetricCard label="A cobrar esta semana" value={formatCurrencyPYG(metrics.toCollectWeek)} tone="green" />
        <MetricCard label="A pagar esta semana" value={formatCurrencyPYG(metrics.toPayWeek)} tone="orange" />
        <MetricCard label="Recibidos pendientes" value={formatCurrencyPYG(metrics.receivedPending)} tone="green" />
        <MetricCard label="Emitidos pendientes" value={formatCurrencyPYG(metrics.issuedPending)} tone="red" />
        <MetricCard label="Saldo proyectado" value={formatCurrencyPYG(metrics.projectedBalance)} tone={metrics.projectedBalance >= 0 ? "green" : "red"} />
        <MetricCard label="Cheques vencidos" value={`${metrics.overdueCount}`} tone="critical" />
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_150px_160px_140px_140px]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-next-muted" aria-hidden="true" />
            <input className="field pl-9" placeholder="Buscar por cliente, proveedor, obra o Nº cheque" value={query} onChange={(event) => setQuery(event.target.value)} />
          </label>
          <select className="field" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="todos">Todos</option>
            <option value="recibido">Recibidos</option>
            <option value="emitido">Emitidos</option>
          </select>
          <select className="field" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="todos">Todos los estados</option>
            {Array.from(new Set([...receivedStatuses, ...issuedStatuses])).map((status) => <option key={status} value={status}>{formatChequeStatus(status)}</option>)}
          </select>
          <input className="field" type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input className="field" type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["todos", "hoy", "semana", "mes", "vencidos"] as QuickFilter[]).map((filter) => (
            <button
              key={filter}
              className={`h-9 rounded-md px-3 text-xs font-black ${quickFilter === filter ? "bg-next-blue text-white" : "border border-slate-200 text-next-muted"}`}
              type="button"
              onClick={() => setQuickFilter(filter)}
            >
              {quickLabel(filter)}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
        <div className="hidden overflow-x-auto lg:block">
          <div className="grid min-w-[1180px] grid-cols-[110px_82px_106px_minmax(150px,1fr)_minmax(150px,1fr)_100px_100px_120px_110px_minmax(150px,1fr)_160px] gap-2 border-b border-slate-100 pb-2 text-[11px] font-black uppercase text-next-muted">
            <span>Vencimiento / cobro</span>
            <span>Tipo</span>
            <span>Estado</span>
            <span>Cliente / Proveedor</span>
            <span>Obra</span>
            <span>Banco</span>
            <span>Nº cheque</span>
            <span className="text-right">Monto</span>
            <span>Emision</span>
            <span>Observacion</span>
            <span>Acciones</span>
          </div>
          <div className="divide-y divide-slate-100">
            {filtered.map((cheque) => (
              <ChequeRow
                key={cheque.id}
                cheque={cheque}
                onDetail={() => setSelected(cheque)}
                onStatus={(estado) => void changeStatus(cheque, estado)}
              />
            ))}
          </div>
        </div>

        <div className="space-y-3 lg:hidden">
          {filtered.map((cheque) => (
            <ChequeCard key={cheque.id} cheque={cheque} onDetail={() => setSelected(cheque)} onStatus={(estado) => void changeStatus(cheque, estado)} />
          ))}
        </div>
        {!filtered.length ? <EmptyState text="No hay cheques con esos filtros." /> : null}
      </section>

      {selected ? (
        <ChequeDetailModal
          cheque={selected}
          onClose={() => setSelected(null)}
          onGoParty={(cheque) => navigate(cheque.terceroTipo === "proveedor" ? "/proveedores" : "/clientes")}
          onGoWork={(cheque) => navigate(`/finanzas-obras/${cheque.obraId}`)}
          onSave={(data) => void saveChequeDetails(selected, data)}
          onStatus={(estado) => void changeStatus(selected, estado)}
        />
      ) : null}
    </div>
  );
}

function ChequeRow({ cheque, onDetail, onStatus }: { cheque: Cheque; onDetail: () => void; onStatus: (status: ChequeStatus) => void }) {
  return (
    <div className={`grid min-w-[1180px] grid-cols-[110px_82px_106px_minmax(150px,1fr)_minmax(150px,1fr)_100px_100px_120px_110px_minmax(150px,1fr)_160px] items-center gap-2 py-2 text-xs ${rowTone(cheque)}`}>
      <span className="font-bold text-next-text">{formatDateShort(getChequeDueDate(cheque))}</span>
      <span className="font-black uppercase">{cheque.tipo === "recibido" ? "Recibido" : "Emitido"}</span>
      <StatusBadge label={formatChequeStatus(cheque.estado)} status={statusBadge(cheque)} />
      <span className="truncate font-semibold" title={cheque.terceroNombre}>{cheque.terceroNombre}</span>
      <span className="truncate" title={cheque.obraNombre}>{cheque.obraNombre}</span>
      <span className="truncate">{cheque.bancoCheque || "-"}</span>
      <span className="font-black text-next-text">{cheque.numeroCheque}</span>
      <span className="text-right font-black">{formatCurrencyPYG(cheque.monto)}</span>
      <span>{formatDateShort(cheque.fechaEmisionCheque)}</span>
      <span className="truncate" title={cheque.observacion}>{cheque.observacion || "-"}</span>
      <ChequeActions cheque={cheque} onDetail={onDetail} onStatus={onStatus} compact />
    </div>
  );
}

function ChequeCard({ cheque, onDetail, onStatus }: { cheque: Cheque; onDetail: () => void; onStatus: (status: ChequeStatus) => void }) {
  return (
    <article className={`rounded-lg border p-4 ${cheque.tipo === "recibido" ? "border-green-100 bg-green-50" : "border-orange-100 bg-orange-50"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-next-muted">{cheque.tipo === "recibido" ? "Cheque recibido" : "Cheque emitido"}</p>
          <h3 className="mt-1 text-base font-black text-next-text">{cheque.terceroNombre}</h3>
          <p className="mt-1 text-sm font-semibold text-next-muted">{cheque.obraNombre}</p>
        </div>
        <p className={`text-right text-lg font-black ${cheque.tipo === "recibido" ? "text-next-green" : "text-next-red"}`}>{formatCurrencyPYG(cheque.monto)}</p>
      </div>
      <div className="mt-3 grid gap-2 text-sm text-next-muted">
        <RowLabel label="Nº cheque" value={cheque.numeroCheque} />
        <RowLabel label="Banco" value={cheque.bancoCheque || "-"} />
        <RowLabel label="Cobro/vencimiento" value={formatDateShort(getChequeDueDate(cheque))} />
        <RowLabel label="Estado" value={formatChequeStatus(cheque.estado)} />
      </div>
      <div className="mt-3">
        <ChequeActions cheque={cheque} onDetail={onDetail} onStatus={onStatus} />
      </div>
    </article>
  );
}

function ChequeActions({ cheque, compact = false, onDetail, onStatus }: { cheque: Cheque; compact?: boolean; onDetail: () => void; onStatus: (status: ChequeStatus) => void }) {
  const finalStatus = cheque.tipo === "recibido" ? "cobrado" : "debitado";
  return (
    <div className={`flex flex-wrap gap-1 ${compact ? "justify-end" : ""}`}>
      <button className="inline-flex h-8 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-next-blue" type="button" onClick={onDetail}>
        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
        Ver
      </button>
      {!isChequeClosed(cheque) ? (
        <>
          <button className="h-8 rounded-md bg-next-blue px-2 text-[11px] font-black text-white" type="button" onClick={() => onStatus(finalStatus)}>
            {cheque.tipo === "recibido" ? "Cobrado" : "Debitado"}
          </button>
          <button className="h-8 rounded-md border border-red-100 bg-white px-2 text-[11px] font-black text-next-red" type="button" onClick={() => onStatus("rechazado")}>
            Rechazar
          </button>
          <button className="h-8 rounded-md border border-slate-200 bg-white px-2 text-[11px] font-black text-next-muted" type="button" onClick={() => onStatus("anulado")}>
            Anular
          </button>
        </>
      ) : null}
    </div>
  );
}

function ChequeDetailModal({
  cheque,
  onClose,
  onGoParty,
  onGoWork,
  onSave,
  onStatus
}: {
  cheque: Cheque;
  onClose: () => void;
  onGoParty: (cheque: Cheque) => void;
  onGoWork: (cheque: Cheque) => void;
  onSave: (data: Partial<Cheque>) => void;
  onStatus: (status: ChequeStatus) => void;
}) {
  const statuses = cheque.tipo === "recibido" ? receivedStatuses : issuedStatuses;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    numeroCheque: cheque.numeroCheque,
    bancoCheque: cheque.bancoCheque ?? "",
    fechaEmisionCheque: cheque.fechaEmisionCheque,
    fechaCobroCheque: cheque.fechaCobroCheque,
    monto: String(cheque.monto),
    observacion: cheque.observacion ?? ""
  });
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-3xl rounded-lg bg-white p-5 shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Detalle de cheque</p>
            <h2 className="mt-1 text-xl font-black text-next-text">{cheque.numeroCheque}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem label="Tipo" value={cheque.tipo === "recibido" ? "Recibido" : "Emitido"} />
          <DetailItem label="Estado" value={formatChequeStatus(cheque.estado)} />
          <DetailItem label="Monto" value={formatCurrencyPYG(cheque.monto)} />
          <DetailItem label="Banco" value={cheque.bancoCheque || "-"} />
          <DetailItem label="Fecha emision" value={formatDateShort(cheque.fechaEmisionCheque)} />
          <DetailItem label="Fecha cobro/vencimiento" value={formatDateShort(getChequeDueDate(cheque))} />
          <DetailItem label="Obra" value={cheque.obraNombre} />
          <DetailItem label="Cliente / proveedor" value={cheque.terceroNombre} />
          <DetailItem label="Origen" value={cheque.origen} />
          <DetailItem label="Observacion" value={cheque.observacion || "-"} />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => onGoWork(cheque)}>Ver obra</button>
          <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => onGoParty(cheque)}>Ver cliente/proveedor</button>
          <button className="h-9 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={() => setEditing((current) => !current)}>Editar cheque</button>
          <select className="field h-9 max-w-48" value={cheque.estado} onChange={(event) => onStatus(event.target.value as ChequeStatus)}>
            {statuses.map((status) => <option key={status} value={status}>{formatChequeStatus(status)}</option>)}
          </select>
        </div>
        {editing ? (
          <div className="mt-5 rounded-lg border border-slate-200 bg-next-bg p-3">
            <p className="text-xs font-black uppercase text-next-blue">Editar cheque</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="Nº cheque"><input className="field" value={draft.numeroCheque} onChange={(event) => setDraft({ ...draft, numeroCheque: event.target.value })} /></Field>
              <Field label="Banco"><input className="field" value={draft.bancoCheque} onChange={(event) => setDraft({ ...draft, bancoCheque: event.target.value })} /></Field>
              <Field label="Fecha emision"><input className="field" type="date" value={draft.fechaEmisionCheque} onChange={(event) => setDraft({ ...draft, fechaEmisionCheque: event.target.value })} /></Field>
              <Field label="Fecha cobro/vencimiento"><input className="field" type="date" value={draft.fechaCobroCheque} onChange={(event) => setDraft({ ...draft, fechaCobroCheque: event.target.value })} /></Field>
              <Field label="Monto"><input className="field" min={0} type="number" value={draft.monto} onChange={(event) => setDraft({ ...draft, monto: event.target.value })} /></Field>
              <Field label="Observacion"><input className="field" value={draft.observacion} onChange={(event) => setDraft({ ...draft, observacion: event.target.value })} /></Field>
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
                {formatDateShort(item.fecha.slice(0, 10))} · {formatChequeStatus(item.estado)} · {item.usuario ?? "Sistema"}
              </p>
            )) : <p className="text-sm font-semibold text-next-muted">Sin historial registrado.</p>}
          </div>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, tone, value }: { label: string; tone: "green" | "red" | "orange" | "critical"; value: string }) {
  const classes = {
    green: "text-next-green",
    red: "text-next-red",
    orange: "text-next-orange",
    critical: "text-next-red"
  };
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
      <FileSpreadsheet className={`h-5 w-5 ${classes[tone]}`} aria-hidden="true" />
      <p className="mt-3 text-xs font-black uppercase text-next-muted">{label}</p>
      <p className={`mt-1 whitespace-nowrap text-xl font-black ${classes[tone]}`}>{value}</p>
    </article>
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

function RowLabel({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="font-semibold text-next-muted">{label}</span>
      <span className="text-right font-black text-next-text">{value}</span>
    </div>
  );
}

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="block text-xs font-black uppercase text-next-muted">
      {label}
      <div className="mt-1">{children}</div>
    </label>
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
  return <div className="rounded-lg border border-dashed border-slate-200 bg-next-bg px-4 py-8 text-center text-sm font-semibold text-next-muted">{text}</div>;
}

function getChequeMetrics(cheques: Cheque[]) {
  const today = getTodayInputDate();
  const week = getWeekRange(today);
  const pendingReceived = cheques.filter((cheque) => cheque.tipo === "recibido" && !closedReceived.includes(cheque.estado));
  const pendingIssued = cheques.filter((cheque) => cheque.tipo === "emitido" && !closedIssued.includes(cheque.estado));
  const toCollectToday = sumCheques(pendingReceived.filter((cheque) => getChequeDueDate(cheque) === today));
  const toPayToday = sumCheques(pendingIssued.filter((cheque) => getChequeDueDate(cheque) === today));
  const toCollectWeek = sumCheques(pendingReceived.filter((cheque) => inRange(getChequeDueDate(cheque), week.start, week.end)));
  const toPayWeek = sumCheques(pendingIssued.filter((cheque) => inRange(getChequeDueDate(cheque), week.start, week.end)));
  const receivedPending = sumCheques(pendingReceived);
  const issuedPending = sumCheques(pendingIssued);
  const overdueCount = [...pendingReceived, ...pendingIssued].filter((cheque) => getChequeDueDate(cheque) < today).length;
  return {
    toCollectToday,
    toPayToday,
    toCollectWeek,
    toPayWeek,
    receivedPending,
    issuedPending,
    projectedBalance: receivedPending - issuedPending,
    overdueCount
  };
}

function matchesQuickDate(cheque: Cheque, filter: QuickFilter) {
  if (filter === "todos") return true;
  const dueDate = getChequeDueDate(cheque);
  const today = getTodayInputDate();
  if (filter === "hoy") return dueDate === today;
  if (filter === "vencidos") return dueDate < today && !isChequeClosed(cheque);
  if (filter === "semana") {
    const week = getWeekRange(today);
    return inRange(dueDate, week.start, week.end);
  }
  const month = today.slice(0, 7);
  return dueDate.startsWith(month);
}

function getWeekRange(today: string) {
  const date = new Date(`${today}T00:00:00`);
  const day = date.getDay() || 7;
  const start = new Date(date);
  start.setDate(date.getDate() - day + 1);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toInputDate(start), end: toInputDate(end) };
}

function toInputDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function inRange(value: string, start: string, end: string) {
  return value >= start && value <= end;
}

function sumCheques(cheques: Cheque[]) {
  return cheques.reduce((sum, cheque) => sum + cheque.monto, 0);
}

function getChequeDueDate(cheque: Cheque) {
  return cheque.fechaCobroCheque || cheque.fechaVencimientoCheque || cheque.fechaEmisionCheque;
}

function isChequeClosed(cheque: Cheque) {
  return cheque.tipo === "recibido" ? closedReceived.includes(cheque.estado) : closedIssued.includes(cheque.estado);
}

function statusBadge(cheque: Cheque): BadgeStatus {
  if (cheque.estado === "rechazado") return "critical";
  if (cheque.estado === "anulado") return "neutral";
  if (cheque.estado === "cobrado" || cheque.estado === "debitado") return "success";
  if (getChequeDueDate(cheque) < getTodayInputDate() && !isChequeClosed(cheque)) return "critical";
  return cheque.tipo === "recibido" ? "info" : "warning";
}

function rowTone(cheque: Cheque) {
  if (cheque.estado === "anulado") return "bg-slate-50 text-next-muted";
  if (cheque.estado === "rechazado" || (getChequeDueDate(cheque) < getTodayInputDate() && !isChequeClosed(cheque))) return "bg-red-50 text-next-red";
  return cheque.tipo === "recibido" ? "bg-green-50/40 text-next-text" : "bg-orange-50/40 text-next-text";
}

function formatChequeStatus(status: ChequeStatus) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function quickLabel(filter: QuickFilter) {
  const labels: Record<QuickFilter, string> = {
    todos: "Todos",
    hoy: "Hoy",
    semana: "Esta semana",
    mes: "Este mes",
    vencidos: "Vencidos"
  };
  return labels[filter];
}
