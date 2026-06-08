import { ArrowLeft, Building2, ChevronDown, ChevronRight, Download, Edit3, Eye, Plus, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";
import { ChangeEvent, FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import CurrencyInput from "../components/ui/CurrencyInput";
import StatusBadge, { type BadgeStatus } from "../components/ui/StatusBadge";
import NewWorkWizard from "../components/work/NewWorkWizard";
import { useAuth } from "../context/AuthContext";
import { firebaseStorage, isFirebaseConfigured } from "../lib/firebase";
import {
  createCliente,
  createMovement,
  createProveedor,
  deleteMovement,
  getCheques,
  getFinancialWorks,
  getClientes,
  getMovementsByWork,
  getProveedores,
  updateFinancialWork
} from "../lib/firestore";
import { buildWorkRenderPath, sanitizeStorageFileName, uploadFile } from "../lib/storageUpload";
import type {
  Cheque,
  FinancialMovement,
  FinancialMovementKind,
  FinancialPaymentMethod,
  FinancialStatus,
  Cliente,
  Obra,
  Proveedor,
  SupplierCategory
} from "../types";
import { exportWorkbookToExcel, type ExcelSheet } from "../utils/excel";
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
import { canManageFinancesForUser } from "../lib/roles";

const paymentMethods: FinancialPaymentMethod[] = [
  "Efectivo",
  "Transferencia",
  "Cheque",
  "Credito",
  "Otro"
];

const maxRenderFileSize = 8 * 1024 * 1024;

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
    proveedorId: "",
    proveedorNombre: "",
    pagadorId: "",
    pagadorNombre: "",
    clienteId: "",
    clienteNombre: "",
    observacion: ""
  };
}

export default function FinancesPage() {
  const { obraId } = useParams();
  const navigate = useNavigate();
  const { profile } = useAuth();
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
  const [workRenderFile, setWorkRenderFile] = useState<File | null>(null);
  const [workRenderStatus, setWorkRenderStatus] = useState("");
  const [movementModal, setMovementModal] = useState<FinancialMovementKind | null>(null);
  const [movementForm, setMovementForm] = useState(emptyMovementForm("ingreso"));
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [allCheques, setAllCheques] = useState<Cheque[]>([]);
  const [exportingExcel, setExportingExcel] = useState(false);

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
      const loadedProveedores = await getProveedores();
      const loadedClientes = await getClientes();
      const loadedCheques = await getCheques().catch((chequeError) => {
        console.error("No se pudieron cargar cheques para exportacion financiera.", chequeError);
        return [] as Cheque[];
      });
      setWorks(loadedWorks);
      setAllMovements(loadedMovements);
      setClientes(loadedClientes);
      setProveedores(loadedProveedores);
      setAllCheques(loadedCheques);
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
    setWorkRenderFile(null);
    setWorkRenderStatus("");
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
        let updated = await updateFinancialWork(selectedWork.id, {
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
        if (workRenderFile) {
          if (!isFirebaseConfigured() || !firebaseStorage) {
            setMessage("Datos de obra actualizados. La imagen se podra cargar cuando Firebase Storage este disponible.");
          } else {
            try {
              setWorkRenderStatus("Subiendo imagen...");
              const uploadPath = buildWorkRenderPath(selectedWork.id, workRenderFile);
              const renderUrl = await withTimeout(
                uploadFile(uploadPath, workRenderFile),
                25000,
                "subir la imagen de la obra"
              );
              updated = await updateFinancialWork(selectedWork.id, {
                renderUrl,
                renderStoragePath: uploadPath,
                renderFileName: sanitizeStorageFileName(workRenderFile.name),
                renderUploadedAt: new Date().toISOString(),
                renderUploadedBy: profile?.uid ?? "unknown"
              });
              setMessage("Datos de obra e imagen actualizados.");
            } catch (renderError) {
              console.error("No se pudo actualizar la imagen/render de la obra.", renderError);
              setMessage("Datos de obra actualizados. La imagen no pudo subirse, podes intentar nuevamente.");
            } finally {
              setWorkRenderStatus("");
            }
          }
        } else {
          setMessage("Datos de obra actualizados.");
        }
        setWorks((current) => current.map((work) => (work.id === updated.id ? updated : work)));
      }
      setWorkRenderFile(null);
      setWorkModal(null);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo guardar la obra.");
    }
  }

  function openMovement(type: FinancialMovementKind) {
    setError("");
    setMessage("");
    const nextForm = emptyMovementForm(type);
    if (type === "ingreso" && selectedWork) {
      nextForm.pagadorId = selectedWork.clienteId ?? "";
      nextForm.pagadorNombre = selectedWork.clienteNombre ?? selectedWork.cliente;
      nextForm.clienteId = selectedWork.clienteId ?? "";
      nextForm.clienteNombre = selectedWork.clienteNombre ?? selectedWork.cliente;
      nextForm.tercero = selectedWork.clienteNombre ?? selectedWork.cliente;
    }
    setMovementForm(nextForm);
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
        tercero: getMovementThirdParty(movementForm),
        pagadorId: movementModal === "ingreso" ? movementForm.pagadorId || movementForm.clienteId || undefined : undefined,
        pagadorNombre: movementModal === "ingreso" ? movementForm.pagadorNombre || movementForm.clienteNombre || getMovementThirdParty(movementForm) : undefined,
        clienteId: movementModal === "ingreso" ? movementForm.clienteId || movementForm.pagadorId || undefined : undefined,
        clienteNombre: movementModal === "ingreso" ? movementForm.clienteNombre || movementForm.pagadorNombre || getMovementThirdParty(movementForm) : undefined,
        proveedorId: movementModal === "compra" ? movementForm.proveedorId || undefined : undefined,
        proveedorNombre: movementModal === "compra" ? movementForm.proveedorNombre || getMovementThirdParty(movementForm) : undefined,
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

  async function handleExportFinancialExcel() {
    if (!selectedWork) return;
    setExportingExcel(true);
    setError("");
    setMessage("");
    try {
      exportWorkbookToExcel({
        fileName: buildFinanceExportFileName(selectedWork),
        sheets: buildFinanceWorkbookSheets(
          selectedWork,
          movements,
          allCheques.filter((cheque) => cheque.obraId === selectedWork.id)
        )
      });
      setMessage("Excel exportado correctamente.");
    } catch (exportError) {
      console.error("No se pudo exportar el Excel de la obra.", exportError);
      setError("No se pudo exportar el Excel de la obra.");
    } finally {
      setExportingExcel(false);
    }
  }

  async function handleDeleteMovement(movementId: string) {
    if (!selectedWork || !window.confirm("Eliminar este movimiento?")) return;
    await deleteMovement(selectedWork.id, movementId);
    await loadMovements(selectedWork.id);
    await loadWorks();
    setMessage("Movimiento eliminado.");
  }

  async function handleCreateProveedor(data: Omit<Proveedor, "id" | "createdAt" | "updatedAt">) {
    const created = await createProveedor({
      ...data,
      createdBy: profile?.uid ?? "unknown"
    });
    setProveedores((current) => [created, ...current]);
    return created;
  }

  async function handleCreateCliente(data: Omit<Cliente, "id" | "createdAt" | "updatedAt">) {
    const created = await createCliente({
      ...data,
      createdBy: profile?.uid ?? "unknown"
    });
    setClientes((current) => [created, ...current]);
    return created;
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
        onExportExcel={handleExportFinancialExcel}
        canExportExcel={canManageFinancesForUser(profile)}
        exportingExcel={exportingExcel}
        onDeleteMovement={handleDeleteMovement}
        cheques={allCheques.filter((cheque) => cheque.obraId === selectedWork.id)}
        message={message}
        error={error}
        workModal={workModal}
        workForm={workForm}
        setWorkForm={setWorkForm}
        renderFile={workRenderFile}
        renderStatus={workRenderStatus}
        onRenderChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          if (!file) return;
          if (!isAllowedRenderImage(file)) {
            setError("Formato no valido. Usa JPG, PNG o WebP.");
            event.target.value = "";
            return;
          }
          if (file.size > maxRenderFileSize) {
            setError("La imagen no puede superar 8 MB.");
            event.target.value = "";
            return;
          }
          setError("");
          setWorkRenderFile(file);
        }}
        onRenderClear={() => setWorkRenderFile(null)}
        onSaveWork={handleSaveWork}
        onCloseWorkModal={() => {
          setWorkRenderFile(null);
          setWorkRenderStatus("");
          setWorkModal(null);
        }}
        movementModal={movementModal}
        movementForm={movementForm}
        proveedores={proveedores}
        clientes={clientes}
        onCreateCliente={handleCreateCliente}
        onCreateProveedor={handleCreateProveedor}
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
          renderFile={workRenderFile}
          renderStatus={workRenderStatus}
          onRenderChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            if (!file) return;
            if (!isAllowedRenderImage(file)) {
              setError("Formato no valido. Usa JPG, PNG o WebP.");
              event.target.value = "";
              return;
            }
            if (file.size > maxRenderFileSize) {
              setError("La imagen no puede superar 8 MB.");
              event.target.value = "";
              return;
            }
            setError("");
            setWorkRenderFile(file);
          }}
          onRenderClear={() => setWorkRenderFile(null)}
          onSubmit={handleSaveWork}
          onClose={() => {
            setWorkRenderFile(null);
            setWorkRenderStatus("");
            setWorkModal(null);
          }}
        />
      ) : null}
      {newWorkOpen ? (
        <NewWorkWizard
          defaultDestination="finanzas"
          onClose={() => setNewWorkOpen(false)}
          onCreated={(obra, destination, notice) => {
            setNewWorkOpen(false);
            setWorks((current) => [obra, ...current]);
            setMessage(notice ?? "Obra creada.");
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
  renderFile,
  renderStatus,
  onRenderChange,
  onRenderClear,
  onSaveWork,
  onCloseWorkModal,
  movementModal,
  movementForm,
  proveedores,
  clientes,
  onCreateCliente,
  onCreateProveedor,
  setMovementForm,
  onSaveMovement,
  onCloseMovementModal,
  onExportExcel,
  canExportExcel,
  exportingExcel,
  cheques
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
  renderFile: File | null;
  renderStatus: string;
  onRenderChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRenderClear: () => void;
  onSaveWork: (event: FormEvent<HTMLFormElement>) => void;
  onCloseWorkModal: () => void;
  movementModal: FinancialMovementKind | null;
  movementForm: ReturnType<typeof emptyMovementForm>;
  proveedores: Proveedor[];
  clientes: Cliente[];
  onCreateCliente: (data: Omit<Cliente, "id" | "createdAt" | "updatedAt">) => Promise<Cliente>;
  onCreateProveedor: (data: Omit<Proveedor, "id" | "createdAt" | "updatedAt">) => Promise<Proveedor>;
  setMovementForm: (values: ReturnType<typeof emptyMovementForm>) => void;
  onSaveMovement: (event: FormEvent<HTMLFormElement>) => void;
  onCloseMovementModal: () => void;
  onExportExcel: () => void;
  canExportExcel: boolean;
  exportingExcel: boolean;
  cheques: Cheque[];
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
        {canExportExcel ? (
          <button
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-next-blue px-4 text-sm font-black text-white shadow-soft transition hover:bg-next-blue/90 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            onClick={onExportExcel}
            disabled={exportingExcel}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            {exportingExcel ? "Exportando..." : "Exportar Excel"}
          </button>
        ) : null}
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
          emptyText="Todavia no hay compras cargadas."
          total={totalEgresos}
        />
        <SummaryBlock
          title="Resumen de ingresos"
          groups={ingresosByCategory}
          emptyText="Todavia no hay ingresos cargados."
          total={totalIngresos}
        />
      </section>

      {cheques.length ? (
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
          <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
            <div>
              <h2 className="text-lg font-black text-next-text">Cheques vinculados</h2>
              <p className="mt-1 text-sm font-semibold text-next-muted">Tambien se incluyen en el Excel de la obra.</p>
            </div>
            <span className="rounded-full bg-next-blue/10 px-3 py-1 text-xs font-black uppercase text-next-blue">
              {cheques.length} registros
            </span>
          </div>
        </section>
      ) : null}

      {workModal ? (
        <WorkModal
          mode={workModal}
          values={workForm}
          setValues={setWorkForm}
          renderFile={renderFile}
          renderStatus={renderStatus}
          onRenderChange={onRenderChange}
          onRenderClear={onRenderClear}
          onSubmit={onSaveWork}
          onClose={onCloseWorkModal}
        />
      ) : null}

      {movementModal ? (
        <MovementModal
          type={movementModal}
          values={movementForm}
          proveedores={proveedores}
          clientes={clientes}
          onCreateCliente={onCreateCliente}
          onCreateProveedor={onCreateProveedor}
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
  const thirdParty = getMovementParty(movement);
  return (
    <>
      <div className={`grid min-w-[1180px] grid-cols-[74px_58px_minmax(132px,1.05fr)_minmax(86px,0.68fr)_minmax(118px,0.9fr)_74px_70px_86px_86px_104px_104px_72px] items-center gap-1 px-1 py-2 text-[11px] leading-tight xl:min-w-0 xl:grid-cols-[82px_64px_minmax(160px,1.1fr)_minmax(96px,0.7fr)_minmax(140px,0.95fr)_82px_78px_94px_94px_112px_112px_78px] xl:gap-2 xl:text-xs ${isIngreso ? "bg-green-50/35" : "bg-orange-50/35"}`}>
        <span className="font-bold text-next-muted">{formatDateShort(movement.fecha)}</span>
        <span className="font-black uppercase text-next-text">{formatMovementType(movement.tipo)}</span>
        <span className="min-w-0 truncate font-bold text-next-text" title={movement.concepto}>{movement.concepto}</span>
        <span className="min-w-0 truncate" title={movement.categoria}>{movement.categoria}</span>
        <span className="min-w-0 truncate font-semibold text-next-text" title={thirdParty}>{thirdParty}</span>
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
  const thirdParty = getMovementParty(movement);
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
        <RowLabel label="Proveedor / Cliente" value={thirdParty} />
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
        <DetailItem label="Proveedor / Cliente" value={getMovementParty(movement)} />
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
  onRenderChange,
  onRenderClear,
  renderFile,
  renderStatus,
  values,
  setValues,
  onSubmit,
  onClose
}: {
  mode: "edit";
  onRenderChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRenderClear: () => void;
  renderFile: File | null;
  renderStatus: string;
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
          <FormField label="Imagen/render">
            <div className="rounded-md border border-dashed border-slate-200 bg-next-bg p-3">
              <input
                className="block w-full text-xs font-semibold text-next-muted file:mr-3 file:h-9 file:rounded-md file:border-0 file:bg-next-blue file:px-3 file:text-xs file:font-black file:text-white"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onRenderChange}
              />
              {renderFile ? (
                <div className="mt-2 rounded-md bg-white px-3 py-2 ring-1 ring-slate-100">
                  <p className="truncate text-xs font-black text-next-text" title={renderFile.name}>{renderFile.name}</p>
                  <p className="mt-1 text-xs font-semibold text-next-muted">{formatFileSize(renderFile.size)}</p>
                  <button className="mt-2 h-8 rounded-md border border-red-100 px-2 text-xs font-black text-next-red" type="button" onClick={onRenderClear}>
                    Eliminar imagen
                  </button>
                </div>
              ) : null}
              {renderStatus ? <p className="mt-2 text-xs font-black text-next-blue">{renderStatus}</p> : null}
            </div>
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
  clientes,
  onCreateCliente,
  onCreateProveedor,
  type,
  proveedores,
  values,
  setValues,
  onSubmit,
  onClose
}: {
  clientes: Cliente[];
  onCreateCliente: (data: Omit<Cliente, "id" | "createdAt" | "updatedAt">) => Promise<Cliente>;
  onCreateProveedor: (data: Omit<Proveedor, "id" | "createdAt" | "updatedAt">) => Promise<Proveedor>;
  type: FinancialMovementKind;
  proveedores: Proveedor[];
  values: ReturnType<typeof emptyMovementForm>;
  setValues: (values: ReturnType<typeof emptyMovementForm>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onClose: () => void;
}) {
  const title = type === "ingreso" ? "Agregar ingreso" : type === "compra" ? "Agregar compra" : "Agregar egreso";
  const isCheque = values.metodoPago === "Cheque";
  const [payerSelectorOpen, setPayerSelectorOpen] = useState(false);
  const [providerSelectorOpen, setProviderSelectorOpen] = useState(false);
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
              <div className="rounded-md border border-slate-200 bg-next-bg px-3 py-2">
                <p className="truncate text-sm font-black text-next-text">
                  {values.pagadorNombre || values.clienteNombre || values.tercero || "Sin pagador seleccionado"}
                </p>
                <button className="mt-1 text-xs font-black text-next-blue" type="button" onClick={() => setPayerSelectorOpen(true)}>
                  Cambiar pagador
                </button>
              </div>
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
              <button className="field flex items-center justify-between text-left" type="button" onClick={() => setProviderSelectorOpen(true)}>
                <span className={values.proveedorNombre || values.tercero ? "text-next-text" : "text-next-muted"}>
                  {values.proveedorNombre || values.tercero || "Seleccionar o crear proveedor"}
                </span>
                <Plus className="h-4 w-4 text-next-blue" aria-hidden="true" />
              </button>
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
      {providerSelectorOpen ? (
        <ProveedorSelectorModal
          onClose={() => setProviderSelectorOpen(false)}
          onCreate={onCreateProveedor}
          onSelect={(proveedor) => {
            setValues({
              ...values,
              proveedorId: proveedor.id,
              proveedorNombre: proveedor.nombre,
              tercero: proveedor.nombre
            });
            setProviderSelectorOpen(false);
          }}
          proveedores={proveedores}
        />
      ) : null}
      {payerSelectorOpen ? (
        <ClienteSelectorModal
          clientes={clientes}
          onClose={() => setPayerSelectorOpen(false)}
          onCreate={onCreateCliente}
          onSelect={(cliente) => {
            setValues({
              ...values,
              pagadorId: cliente.id,
              pagadorNombre: cliente.nombre,
              clienteId: cliente.id,
              clienteNombre: cliente.nombre,
              tercero: cliente.nombre
            });
            setPayerSelectorOpen(false);
          }}
        />
      ) : null}
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

function ClienteSelectorModal({
  clientes,
  onClose,
  onCreate,
  onSelect
}: {
  clientes: Cliente[];
  onClose: () => void;
  onCreate: (data: Omit<Cliente, "id" | "createdAt" | "updatedAt">) => Promise<Cliente>;
  onSelect: (cliente: Cliente) => void;
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    ruc: "",
    telefono: "",
    whatsapp: "",
    email: "",
    direccion: "",
    ciudad: "",
    contactoPrincipal: "",
    observaciones: ""
  });
  const filtered = clientes.filter((cliente) =>
    `${cliente.nombre} ${cliente.ruc ?? ""} ${cliente.email ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  async function create() {
    if (!form.nombre.trim()) return;
    const duplicated = clientes.find((cliente) =>
      cliente.nombre.trim().toLowerCase() === form.nombre.trim().toLowerCase()
      || (cliente.ruc && form.ruc && cliente.ruc.trim() === form.ruc.trim())
    );

    if (duplicated) {
      onSelect(duplicated);
      return;
    }

    setCreating(true);
    try {
      const created = await onCreate({
        nombre: toTitleCase(form.nombre),
        ruc: form.ruc.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        email: form.email.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
        ciudad: form.ciudad ? toTitleCase(form.ciudad) : undefined,
        contactoPrincipal: form.contactoPrincipal ? toTitleCase(form.contactoPrincipal) : undefined,
        observaciones: form.observaciones.trim() || undefined
      });
      onSelect(created);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-4xl rounded-lg bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Pagador del ingreso</p>
            <h3 className="mt-1 text-xl font-black text-next-text">Seleccionar o crear cliente</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="min-w-0">
            <input className="field" placeholder="Buscar cliente por nombre, RUC o email" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {filtered.map((cliente) => (
                <button key={cliente.id} className="w-full rounded-md border border-slate-100 bg-next-bg px-3 py-3 text-left transition hover:border-next-blue hover:bg-white" type="button" onClick={() => onSelect(cliente)}>
                  <p className="text-sm font-black text-next-text">{cliente.nombre}</p>
                  <p className="mt-1 text-xs font-semibold text-next-muted">
                    {[cliente.ruc, cliente.telefono, cliente.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
                  </p>
                </button>
              ))}
              {!filtered.length ? <EmptyState text="No hay clientes con esa busqueda." /> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-next-bg p-3">
            <p className="text-sm font-black text-next-text">Crear nuevo cliente</p>
            <div className="mt-3 grid gap-2">
              <input className="field" placeholder="Nombre / razon social" value={form.nombre} onBlur={() => setForm({ ...form, nombre: toTitleCase(form.nombre) })} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
              <input className="field" placeholder="RUC opcional" value={form.ruc} onChange={(event) => setForm({ ...form, ruc: event.target.value })} />
              <input className="field" placeholder="Telefono" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} />
              <input className="field" placeholder="WhatsApp" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
              <input className="field" placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <input className="field" placeholder="Direccion" value={form.direccion} onChange={(event) => setForm({ ...form, direccion: event.target.value })} />
              <input className="field" placeholder="Ciudad" value={form.ciudad} onBlur={() => setForm({ ...form, ciudad: toTitleCase(form.ciudad) })} onChange={(event) => setForm({ ...form, ciudad: event.target.value })} />
              <input className="field" placeholder="Contacto principal" value={form.contactoPrincipal} onBlur={() => setForm({ ...form, contactoPrincipal: toTitleCase(form.contactoPrincipal) })} onChange={(event) => setForm({ ...form, contactoPrincipal: event.target.value })} />
              <input className="field" placeholder="Observaciones" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} />
            </div>
            <button className="mt-3 h-10 w-full rounded-md bg-next-blue px-3 text-xs font-black text-white disabled:opacity-60" type="button" disabled={creating} onClick={() => void create()}>
              {creating ? "Creando..." : "Crear y seleccionar"}
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

const supplierCategories: SupplierCategory[] = ["Vidrio", "Aluminio", "Accesorios", "Transporte", "Mano de obra", "Otros"];

function ProveedorSelectorModal({
  onClose,
  onCreate,
  onSelect,
  proveedores
}: {
  onClose: () => void;
  onCreate: (data: Omit<Proveedor, "id" | "createdAt" | "updatedAt">) => Promise<Proveedor>;
  onSelect: (proveedor: Proveedor) => void;
  proveedores: Proveedor[];
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    nombre: "",
    ruc: "",
    telefono: "",
    whatsapp: "",
    email: "",
    direccion: "",
    categoriaPrincipal: "Vidrio" as SupplierCategory,
    contactoPrincipal: "",
    observaciones: ""
  });
  const filtered = proveedores.filter((proveedor) =>
    `${proveedor.nombre} ${proveedor.ruc ?? ""} ${proveedor.categoriaPrincipal}`.toLowerCase().includes(query.toLowerCase())
  );

  async function create() {
    if (!form.nombre.trim()) return;
    const duplicated = proveedores.find((proveedor) =>
      proveedor.nombre.trim().toLowerCase() === form.nombre.trim().toLowerCase()
      || (proveedor.ruc && form.ruc && proveedor.ruc.trim() === form.ruc.trim())
    );

    if (duplicated) {
      onSelect(duplicated);
      return;
    }

    setCreating(true);
    try {
      const created = await onCreate({
        nombre: toTitleCase(form.nombre),
        ruc: form.ruc.trim() || undefined,
        telefono: form.telefono.trim() || undefined,
        whatsapp: form.whatsapp.trim() || undefined,
        email: form.email.trim() || undefined,
        direccion: form.direccion.trim() || undefined,
        categoriaPrincipal: form.categoriaPrincipal,
        contactoPrincipal: form.contactoPrincipal ? toTitleCase(form.contactoPrincipal) : undefined,
        observaciones: form.observaciones.trim() || undefined
      });
      onSelect(created);
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-4xl rounded-lg bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Proveedor de compra</p>
            <h3 className="mt-1 text-xl font-black text-next-text">Seleccionar o crear proveedor</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
          <div className="min-w-0">
            <input className="field" placeholder="Buscar proveedor por nombre, RUC o categoria" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="mt-3 max-h-96 space-y-2 overflow-y-auto pr-1">
              {filtered.map((proveedor) => (
                <button key={proveedor.id} className="w-full rounded-md border border-slate-100 bg-next-bg px-3 py-3 text-left transition hover:border-next-blue hover:bg-white" type="button" onClick={() => onSelect(proveedor)}>
                  <p className="text-sm font-black text-next-text">{proveedor.nombre}</p>
                  <p className="mt-1 text-xs font-semibold text-next-muted">
                    {[proveedor.categoriaPrincipal, proveedor.ruc, proveedor.telefono].filter(Boolean).join(" · ")}
                  </p>
                </button>
              ))}
              {!filtered.length ? <EmptyState text="No hay proveedores con esa busqueda." /> : null}
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-next-bg p-3">
            <p className="text-sm font-black text-next-text">Crear nuevo proveedor</p>
            <div className="mt-3 grid gap-2">
              <input className="field" placeholder="Nombre / razon social" value={form.nombre} onBlur={() => setForm({ ...form, nombre: toTitleCase(form.nombre) })} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
              <input className="field" placeholder="RUC opcional" value={form.ruc} onChange={(event) => setForm({ ...form, ruc: event.target.value })} />
              <select className="field" value={form.categoriaPrincipal} onChange={(event) => setForm({ ...form, categoriaPrincipal: event.target.value as SupplierCategory })}>
                {supplierCategories.map((category) => <option key={category}>{category}</option>)}
              </select>
              <input className="field" placeholder="Telefono" value={form.telefono} onChange={(event) => setForm({ ...form, telefono: event.target.value })} />
              <input className="field" placeholder="WhatsApp" value={form.whatsapp} onChange={(event) => setForm({ ...form, whatsapp: event.target.value })} />
              <input className="field" placeholder="Email" type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <input className="field" placeholder="Direccion" value={form.direccion} onChange={(event) => setForm({ ...form, direccion: event.target.value })} />
              <input className="field" placeholder="Contacto principal" value={form.contactoPrincipal} onBlur={() => setForm({ ...form, contactoPrincipal: toTitleCase(form.contactoPrincipal) })} onChange={(event) => setForm({ ...form, contactoPrincipal: event.target.value })} />
              <input className="field" placeholder="Observaciones" value={form.observaciones} onChange={(event) => setForm({ ...form, observaciones: event.target.value })} />
            </div>
            <button className="mt-3 h-10 w-full rounded-md bg-next-blue px-3 text-xs font-black text-white disabled:opacity-60" type="button" disabled={creating} onClick={() => void create()}>
              {creating ? "Creando..." : "Crear y seleccionar"}
            </button>
          </div>
        </div>
      </section>
    </div>
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
  emptyText,
  title,
  groups,
  total
}: {
  emptyText: string;
  title: string;
  groups: Record<string, number>;
  total: number;
}) {
  const entries = Object.entries(groups).filter(([, value]) => value > 0);

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-5 shadow-soft">
      <h2 className="text-base font-black text-next-text">{title}</h2>
      {entries.length ? (
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
      ) : (
        <EmptyState text={emptyText} />
      )}
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

function isAllowedRenderImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`La conexion tardo demasiado al ${label}. Intenta nuevamente.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
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
function buildFinanceWorkbookSheets(obra: Obra, movements: FinancialMovement[], cheques: Cheque[]): ExcelSheet[] {
  const totalContratado = getTotalContratado(obra);
  const totalIngresos = calculateTotalIngresos(movements);
  const totalCompras = movements
    .filter((movement) => movement.tipo === "compra")
    .reduce((sum, movement) => sum + movement.monto, 0);
  const totalEgresosOperativos = movements
    .filter((movement) => movement.tipo === "egreso")
    .reduce((sum, movement) => sum + movement.monto, 0);
  const totalEgresos = calculateTotalEgresos(movements);
  const resultado = calculateResultadoActual(obra, movements);
  const saldo = calculateSaldoPendiente(obra, movements);
  const margen = calculateMargenActual(obra, movements);
  const egresosByCategory = groupEgresosByCategoria(movements);
  const ingresosByCategory = groupIngresosByCategoria(movements);
  const egresosEntries = Object.entries(egresosByCategory).filter(([, value]) => value > 0);
  const ingresosEntries = Object.entries(ingresosByCategory).filter(([, value]) => value > 0);

  return [
    {
      name: "Resumen",
      rows: [
        { Dato: "Nombre de obra", Valor: obra.nombre },
        { Dato: "Cliente", Valor: obra.clienteNombre ?? obra.cliente },
        { Dato: "Arquitecto", Valor: obra.arquitecto ?? "" },
        { Dato: "Direccion", Valor: obra.direccion ?? obra.ubicacion ?? "" },
        { Dato: "Fecha de inicio", Valor: obra.fechaInicio ?? "" },
        { Dato: "Fecha comprometida", Valor: obra.fechaComprometida ?? obra.fechaEntrega ?? "" },
        { Dato: "Estado", Valor: obra.estado },
        { Dato: "Presupuesto aprobado", Valor: obra.presupuestoAprobado ?? obra.montoAprobado ?? 0 },
        { Dato: "Adicionales", Valor: obra.adicionalesAprobados ?? 0 },
        { Dato: "Descuentos", Valor: obra.descuentos ?? 0 },
        { Dato: "Total contratado", Valor: totalContratado },
        { Dato: "Total ingresado", Valor: totalIngresos },
        { Dato: "Total compras", Valor: totalCompras },
        { Dato: "Egresos operativos", Valor: totalEgresosOperativos },
        { Dato: "Total egresado", Valor: totalEgresos },
        { Dato: "Resultado actual", Valor: resultado },
        { Dato: "Saldo pendiente", Valor: saldo },
        { Dato: "Margen actual", Valor: `${margen}%` }
      ]
    },
    movements.length
      ? {
          name: "Movimientos",
          rows: movements.map((movement) => ({
            Fecha: movement.fecha,
            Tipo: movement.tipo,
            Concepto: movement.concepto,
            Categoria: movement.categoria,
            "Proveedor / Cliente": getMovementPartyForExport(movement, obra),
            "Metodo de pago": movement.metodoPago ?? "",
            Banco: movement.bancoCheque ?? "",
            "Nro cheque": movement.numeroCheque ?? "",
            "Fecha emision cheque": movement.fechaEmisionCheque ?? "",
            "Fecha cobro cheque": movement.fechaCobroCheque ?? "",
            Cantidad: movement.cantidad ?? null,
            Unidad: movement.unidad ? formatUnitLabel(normalizeUnit(movement.unidad), movement.cantidad ?? 0) : "",
            Ingreso: movement.tipo === "ingreso" ? movement.monto : null,
            Egreso: movement.tipo === "compra" || movement.tipo === "egreso" ? movement.monto : null,
            Observacion: movement.observacion ?? ""
          }))
        }
      : {
          name: "Movimientos",
          aoa: [["Todavia no hay movimientos cargados."]]
        },
    egresosEntries.length
      ? {
          name: "Categorias",
          rows: egresosEntries.map(([categoria, total]) => ({
            Categoria: categoria,
            Total: total
          }))
        }
      : {
          name: "Categorias",
          aoa: [["Todavia no hay compras cargadas."]]
        },
    ingresosEntries.length
      ? {
          name: "Ingresos",
          rows: ingresosEntries.map(([categoria, total]) => ({
            "Tipo de ingreso": categoria,
            Total: total
          }))
        }
      : {
          name: "Ingresos",
          aoa: [["Todavia no hay ingresos cargados."]]
        },
    cheques.length
      ? {
          name: "Cheques",
          rows: cheques.map((cheque) => ({
            Tipo: cheque.tipo,
            Estado: cheque.estado,
            "Cliente / Proveedor": cheque.terceroNombre,
            Banco: cheque.bancoCheque ?? "",
            "Nro cheque": cheque.numeroCheque,
            "Fecha emision": cheque.fechaEmisionCheque,
            "Fecha cobro/vencimiento": getFinanceChequeDueDate(cheque),
            Monto: cheque.monto,
            Observacion: cheque.observacion ?? ""
          }))
        }
      : {
          name: "Cheques",
          aoa: [["No hay cheques vinculados a esta obra."]]
        }
  ];
}

function buildFinanceExportFileName(obra: Obra): string {
  const normalizedName = sanitizeStorageFileName(obra.nombre || "obra")
    .replace(/\.[^.]+$/, "")
    .toLowerCase();
  return `finanzas-${normalizedName || "obra"}-${getTodayInputDate()}.xlsx`;
}

function getMovementPartyForExport(movement: FinancialMovement, obra: Obra): string {
  if (movement.tipo === "ingreso") {
    return movement.pagadorNombre
      ?? movement.clienteNombre
      ?? movement.tercero
      ?? obra.clienteNombre
      ?? obra.cliente
      ?? "";
  }

  return movement.proveedorNombre
    ?? movement.tercero
    ?? movement.clienteNombre
    ?? "";
}

function getFinanceChequeDueDate(cheque: Cheque): string {
  return cheque.fechaCobroCheque || cheque.fechaVencimientoCheque || cheque.fechaEmisionCheque;
}

function getMovementThirdParty(values: ReturnType<typeof emptyMovementForm>): string | undefined {
  const name = values.proveedorNombre || values.tercero;
  return name ? toTitleCase(name) : undefined;
}

function getMovementParty(movement: FinancialMovement): string {
  return movement.proveedorNombre
    ?? movement.clienteNombre
    ?? movement.tercero
    ?? "-";
}
