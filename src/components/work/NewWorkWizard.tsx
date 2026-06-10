import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import type { MutableRefObject, ReactNode } from "react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import CurrencyInput from "../ui/CurrencyInput";
import { firebaseStorage, isFirebaseConfigured } from "../../lib/firebase";
import {
  createActividad,
  createCliente,
  createObra,
  createProgressRubric,
  getClientes,
  updateObra
} from "../../lib/firestore";
import { buildWorkRenderPath, sanitizeStorageFileName, uploadFile } from "../../lib/storageUpload";
import type { Cliente, Obra, ProgressCalculationMode, WorkBreakdownLoadMode, WorkBreakdownUnit, WorkStatus } from "../../types";
import { formatCurrencyPYG, getTodayInputDate } from "../../utils/formatters";
import { toTitleCase } from "../../utils/text";
import { normalizeUnit, type OperationalUnit } from "../../utils/units";
import { calculateM2Total, calculateM2Unitario, calculateRubricQuantityFromItems, roundMeasure } from "../../utils/workBreakdown";

type WizardDestination = "avance" | "finanzas" | "control";

type NewWorkWizardProps = {
  defaultDestination: WizardDestination;
  onClose: () => void;
  onCreated: (obra: Obra, destination: WizardDestination, notice?: string) => void;
};

const maxRenderFileSize = 8 * 1024 * 1024;

type RubricDraft = {
  nombre: string;
  unidadPrincipal: WorkBreakdownUnit | "";
  modoCarga: WorkBreakdownLoadMode;
  cantidadTotalPrevista: string;
  unidad: OperationalUnit | "";
  pesoOperativo: string;
  modoCalculo: ProgressCalculationMode;
  avanceManualPermitido: boolean;
  requiereProduccion: boolean;
  items: RubricItemDraft[];
};

type RubricItemDraft = {
  id: string;
  descripcion: string;
  ancho: string;
  alto: string;
  cantidad: string;
  unidad: WorkBreakdownUnit | "";
  fabricarEnTaller: boolean;
  observacion: string;
};

const statuses: WorkStatus[] = [
  "Aprobado",
  "Produccion",
  "Instalacion",
  "Pausada",
  "Atrasada",
  "Finalizada"
];

export default function NewWorkWizard({
  defaultDestination,
  onClose,
  onCreated
}: NewWorkWizardProps) {
  const { authUser, profile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [dirty, setDirty] = useState(false);
  const [destination, setDestination] = useState<WizardDestination>(defaultDestination);
  const [configureProgressNow, setConfigureProgressNow] = useState(false);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteModalOpen, setClienteModalOpen] = useState(false);
  const [clienteQuery, setClienteQuery] = useState("");
  const [clienteForm, setClienteForm] = useState({
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
  const [general, setGeneral] = useState({
    nombre: "",
    cliente: "",
    clienteId: "",
    arquitecto: "",
    direccion: "",
    fechaInicio: getTodayInputDate(),
    fechaComprometida: getTodayInputDate(),
    estado: "Aprobado" as WorkStatus
  });
  const [responsibles, setResponsibles] = useState({
    encargado: "",
    supervisor: "",
    fiscalizador: "",
    cuadrillaAsignadaId: ""
  });
  const [financial, setFinancial] = useState({
    presupuestoAprobado: 0,
    adicionalesAprobados: 0,
    descuentos: 0,
    observacionInicial: ""
  });
  const [rubrics, setRubrics] = useState<RubricDraft[]>([]);
  const [renderFile, setRenderFile] = useState<File | null>(null);
  const [renderPreviewUrl, setRenderPreviewUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const storageReady = isFirebaseConfigured() && Boolean(firebaseStorage);

  useEffect(() => {
    getClientes()
      .then(setClientes)
      .catch((loadError) => console.error("No se pudieron cargar clientes.", loadError));
  }, []);

  useEffect(() => {
    if (!renderFile) {
      setRenderPreviewUrl("");
      return undefined;
    }

    const objectUrl = URL.createObjectURL(renderFile);
    setRenderPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [renderFile]);

  const totalContratado = useMemo(
    () =>
      financial.presupuestoAprobado
      + financial.adicionalesAprobados
      - financial.descuentos,
    [financial]
  );
  const totalWeight = rubrics.reduce((sum, rubro) => sum + Number(rubro.pesoOperativo || 0), 0);
  const productionCount = rubrics.reduce((sum, rubro) =>
    sum + (rubro.modoCarga === "detalle"
      ? rubro.items.filter((item) => item.fabricarEnTaller).length
      : rubro.requiereProduccion ? 1 : 0), 0);

  function closeSafely() {
    if (dirty && !window.confirm("Cerrar sin guardar la nueva obra?")) {
      return;
    }

    onClose();
  }

  function markDirty() {
    if (!dirty) setDirty(true);
  }

  function validateStep(currentStep = step) {
    if (currentStep === 0) {
      if (!general.nombre.trim() || !general.cliente.trim() || !general.direccion.trim()) {
        return "Completa nombre de obra, cliente y direccion.";
      }
      if (!general.fechaInicio || !general.fechaComprometida) {
        return "Carga fecha de inicio y fecha comprometida de entrega.";
      }
      if (general.fechaComprometida < general.fechaInicio) {
        return "La fecha comprometida no puede ser anterior a la fecha de inicio.";
      }
    }

    if (currentStep === 1) {
      if (!responsibles.encargado.trim()) {
        return "Carga el encargado de obra.";
      }
    }

    if (currentStep === 2) {
      if (financial.presupuestoAprobado <= 0) {
        return "Carga un presupuesto aprobado mayor a cero.";
      }
      if (financial.presupuestoAprobado < 0 || financial.adicionalesAprobados < 0 || financial.descuentos < 0) {
        return "Los montos no pueden ser negativos.";
      }
    }

    if (currentStep === 3 && configureProgressNow) {
      if (!rubrics.length) return "Agrega al menos un rubro o elegi configurar despues.";
      if (rubrics.some((rubro) => !rubro.nombre.trim() || !rubro.unidadPrincipal.trim())) {
        return "Todos los rubros necesitan nombre y unidad.";
      }
      if (rubrics.some((rubro) => getRubricQuantity(rubro) <= 0)) {
        return "Todos los rubros necesitan una cantidad total prevista mayor a cero.";
      }
      if (rubrics.some((rubro) => rubro.pesoOperativo === "" || Number(rubro.pesoOperativo) < 0 || Number(rubro.pesoOperativo) > 100)) {
        return "Todos los rubros necesitan un peso entre 0 y 100.";
      }
      if (rubrics.some((rubro) => Number.isNaN(getRubricQuantity(rubro)) || Number.isNaN(Number(rubro.pesoOperativo)))) {
        return "Revisa cantidades y pesos. No pueden ser negativos ni invalidos.";
      }
      const invalidDetailed = rubrics.some((rubro) =>
        rubro.modoCarga === "detalle" && (
          !rubro.items.length ||
          rubro.items.some((item) =>
            !item.descripcion.trim() ||
            !item.unidad ||
            Number(item.cantidad || 0) <= 0 ||
            (item.unidad === "m2" && (Number(item.ancho || 0) <= 0 || Number(item.alto || 0) <= 0))
          )
        )
      );
      if (invalidDetailed) {
        return "En carga detallada, cada item necesita descripcion, unidad, cantidad y medidas cuando se mide en m2.";
      }
      if (Math.abs(totalWeight - 100) > 0.01) {
        return "La suma de pesos debe dar 100%.";
      }
    }

    return "";
  }

  function nextStep() {
    const validation = validateStep();
    if (validation) {
      setError(validation);
      return;
    }

    setError("");
    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  async function handleCreate() {
    if (saving) return;

    const validation = [0, 1, 2, 3].map((item) => validateStep(item)).find(Boolean);
    if (validation) {
      setError(validation);
      setStep(Math.max(0, [0, 1, 2, 3].find((item) => validateStep(item)) ?? 0));
      return;
    }

    setSaving(true);
    setError("");
    setWarning("");
    setUploadStatus("");
    logNewWorkStep("Validacion terminada");
    let completionNotice = "Obra creada correctamente.";

    const normalizedGeneral = {
      ...general,
      nombre: toTitleCase(general.nombre),
      cliente: toTitleCase(general.cliente),
      arquitecto: general.arquitecto ? toTitleCase(general.arquitecto) : "",
      direccion: general.direccion.trim()
    };
    const normalizedResponsibles = {
      encargado: toTitleCase(responsibles.encargado),
      supervisor: responsibles.supervisor ? toTitleCase(responsibles.supervisor) : "",
      fiscalizador: responsibles.fiscalizador ? toTitleCase(responsibles.fiscalizador) : "",
      cuadrillaAsignadaId: responsibles.cuadrillaAsignadaId ? toTitleCase(responsibles.cuadrillaAsignadaId) : ""
    };
    const normalizedRubrics = rubrics.map((rubro) => ({
      ...rubro,
      nombre: toTitleCase(rubro.nombre),
      unidad: normalizeUnit(rubro.unidadPrincipal || rubro.unidad) || "unidad",
      cantidad: getRubricQuantity(rubro),
      peso: Number(rubro.pesoOperativo || 0),
      items: rubro.items.map((item) => {
        const unit = normalizeUnit(item.unidad) || "unidad";
        const quantity = Number(item.cantidad || 0);
        const width = item.ancho === "" ? undefined : Number(item.ancho);
        const height = item.alto === "" ? undefined : Number(item.alto);
        return {
          id: item.id,
          descripcion: toTitleCase(item.descripcion),
          ancho: width,
          alto: height,
          cantidad: quantity,
          unidad: unit,
          m2Unitario: unit === "m2" ? calculateM2Unitario(width, height) : undefined,
          m2Total: unit === "m2" ? calculateM2Total(width, height, quantity) : undefined,
          fabricarEnTaller: item.fabricarEnTaller,
          estadoProduccion: "pendiente" as const,
          cantidadProducida: 0,
          observacion: item.observacion.trim() || undefined
        };
      })
    }));

    try {
      logNewWorkStep("Creando documento de obra");
      const created = await withTimeout(createObra({
        nombre: normalizedGeneral.nombre,
        cliente: normalizedGeneral.cliente,
        clienteId: normalizedGeneral.clienteId || undefined,
        clienteNombre: normalizedGeneral.cliente,
        arquitecto: normalizedGeneral.arquitecto,
        ubicacion: normalizedGeneral.direccion,
        direccion: normalizedGeneral.direccion,
        montoAprobado: totalContratado,
        fechaInicio: normalizedGeneral.fechaInicio,
        fechaEntrega: normalizedGeneral.fechaComprometida,
        fechaComprometida: normalizedGeneral.fechaComprometida,
        responsable: normalizedResponsibles.encargado,
        encargado: normalizedResponsibles.encargado,
        supervisor: normalizedResponsibles.supervisor || undefined,
        fiscalizador: normalizedResponsibles.fiscalizador || undefined,
        cuadrillaAsignadaId: normalizedResponsibles.cuadrillaAsignadaId || undefined,
        estado: normalizedGeneral.estado,
        saldoPendienteCobro: totalContratado,
        presupuestoAprobado: financial.presupuestoAprobado,
        adicionalesAprobados: financial.adicionalesAprobados,
        descuentos: financial.descuentos,
        totalContratado,
        valorFinalContratado: totalContratado,
        observacionInicial: financial.observacionInicial.trim() || undefined,
        progressConfigured: configureProgressNow && normalizedRubrics.length > 0,
        rubrosAvance: [],
        etapasProduccion: [],
        materialesFaltantes: [],
        createdBy: authUser?.uid ?? profile?.uid ?? "unknown"
      }), 20000, "crear el documento principal de la obra");
      logNewWorkStep("Documento creado", { obraId: created.id });

      let createdWithImage = created;
      if (renderFile && storageReady) {
        try {
          setUploadStatus("Subiendo imagen...");
          const uploadPath = buildWorkRenderPath(created.id, renderFile);
          logNewWorkStep("Starting render upload", {
            storageBucket: firebaseStorage?.app.options.storageBucket,
            uploadPath,
            contentType: renderFile.type,
            size: renderFile.size
          });
          const extension = getFileExtension(renderFile);
          const url = await withTimeout(
            uploadFile(uploadPath, renderFile),
            25000,
            "subir la imagen de la obra"
          );
          createdWithImage = await withTimeout(updateObra(created.id, {
            renderUrl: url,
            renderStoragePath: uploadPath,
            renderFileName: sanitizeStorageFileName(renderFile.name || `render.${extension}`),
            renderUploadedAt: new Date().toISOString(),
            renderUploadedBy: authUser?.uid ?? profile?.uid ?? "unknown"
          }), 15000, "guardar la URL del render");
          logNewWorkStep("Upload success", { obraId: created.id, uploadPath });
        } catch (uploadError) {
          const uploadDetails = getErrorDetails(uploadError);
          logNewWorkStep("Upload failed", uploadDetails);
          console.error("No se pudo subir la imagen principal de la obra.", uploadError);
          completionNotice = `Obra creada. La imagen no pudo subirse${uploadDetails.code ? ` (${uploadDetails.code})` : ""}, pero podes cargarla despues desde Editar obra.`;
          setWarning(completionNotice);
        } finally {
          setUploadStatus("");
        }
      } else if (renderFile && !storageReady) {
        completionNotice = "Obra creada. La imagen se podra cargar cuando Firebase Storage este disponible.";
        setWarning(completionNotice);
      }

      if (configureProgressNow && normalizedRubrics.length) {
        try {
          logNewWorkStep("Guardando rubros");
          const createdRubrics = await withTimeout(Promise.all(
            normalizedRubrics.map((rubro, index) =>
              createProgressRubric({
                obraId: created.id,
                nombre: rubro.nombre,
                unidad: rubro.unidad,
                unidadPrincipal: rubro.unidad,
                modoCarga: rubro.modoCarga,
                cantidadTotalPrevista: rubro.cantidad,
                pesoOperativo: rubro.peso,
                modoCalculo: rubro.modoCalculo,
                avanceManual: rubro.avanceManualPermitido,
                avanceManualPermitido: rubro.avanceManualPermitido,
                requiereProduccion: rubro.requiereProduccion,
                items: rubro.items,
                cantidadProducida: 0,
                estadoProduccion: "pendiente",
                orden: index + 1
              })
            )
          ), 25000, "guardar los rubros operativos");
          createdWithImage = await withTimeout(updateObra(created.id, {
            rubrosAvance: createdRubrics.map((rubro) => ({
              id: rubro.id,
              nombre: rubro.nombre,
              peso: rubro.pesoOperativo,
              avance: 0
            })),
            progressConfigured: true
          }), 15000, "actualizar el resumen de avance de la obra");
          logNewWorkStep("Rubros guardados");
        } catch (rubricError) {
          console.error("No se pudieron guardar los rubros operativos.", rubricError);
          completionNotice = completionNotice === "Obra creada correctamente."
            ? "La obra fue creada, pero no se pudieron guardar los rubros. Configura el avance despues desde Avance de obras."
            : `${completionNotice} Ademas, no se pudieron guardar los rubros.`;
          setWarning(completionNotice);
          try {
            createdWithImage = await withTimeout(updateObra(created.id, { progressConfigured: false, rubrosAvance: [] }), 15000, "marcar avance sin configurar");
          } catch (updateError) {
            console.error("No se pudo marcar la obra como avance sin configurar.", updateError);
          }
        }
      }

      try {
        logNewWorkStep("Registrando actividad");
        await withTimeout(createActividad({
              obraId: created.id,
              tipo: "obra",
              descripcion: configureProgressNow && normalizedRubrics.length
                ? "Obra creada con desglose operativo inicial."
                : "Obra creada. Avance pendiente de configurar.",
              usuario: profile?.nombre ?? "Administrador",
              fecha: new Date().toISOString()
            }), 15000, "registrar la actividad de creacion");
      } catch (activityError) {
        console.error("No se pudo registrar la actividad de creacion.", activityError);
      }

      logNewWorkStep("Creacion finalizada", { obraId: createdWithImage.id });
      setSaving(false);
      onCreated(createdWithImage, destination, completionNotice);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear la obra.");
      console.error("No se pudo crear la obra.", saveError);
    } finally {
      setSaving(false);
    }
  }

  const steps = [
    "Datos generales",
    "Responsables",
    "Datos financieros",
    "Desglose operativo",
    "Confirmacion"
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-5xl rounded-lg bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-4 sm:p-5">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Obra unica compartida</p>
            <h2 className="mt-1 text-xl font-black text-next-text">Nueva obra</h2>
            <p className="mt-1 text-sm font-semibold text-next-muted">
              Esta obra aparecera en Finanzas, Avance, Produccion e Instalaciones.
            </p>
          </div>
          <button className="icon-button" type="button" onClick={closeSafely} title="Cerrar">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <form className="space-y-5 p-4 sm:p-5" onSubmit={(event) => event.preventDefault()}>
          <ol className="grid gap-2 md:grid-cols-5">
            {steps.map((label, index) => (
              <li
                key={label}
                className={`rounded-md px-3 py-2 text-xs font-black ${
                  index === step
                    ? "bg-next-blue text-white"
                    : index < step
                      ? "bg-next-light text-next-blue"
                      : "bg-next-bg text-next-muted"
                }`}
              >
                {index + 1}. {label}
              </li>
            ))}
          </ol>

          {error ? <Notice text={error} /> : null}
          {warning ? <Notice tone="warning" text={warning} /> : null}

          {step === 0 ? (
            <Section title="Datos generales" description="Identificacion principal de la obra y fechas de referencia.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre de obra" required>
                  <input className="field" required value={general.nombre} onBlur={() => setGeneral((current) => ({ ...current, nombre: toTitleCase(current.nombre) }))} onChange={(event) => { markDirty(); setGeneral({ ...general, nombre: event.target.value }); }} />
                </Field>
                <Field label="Cliente" required>
                  <button
                    className="field flex items-center justify-between text-left"
                    type="button"
                    onClick={() => setClienteModalOpen(true)}
                  >
                    <span className={general.cliente ? "text-next-text" : "text-next-muted"}>
                      {general.cliente || "Seleccionar o crear cliente"}
                    </span>
                    <Plus className="h-4 w-4 text-next-blue" aria-hidden="true" />
                  </button>
                </Field>
                <Field label="Arquitecto opcional">
                  <input className="field" value={general.arquitecto} onBlur={() => setGeneral((current) => ({ ...current, arquitecto: toTitleCase(current.arquitecto) }))} onChange={(event) => { markDirty(); setGeneral({ ...general, arquitecto: event.target.value }); }} />
                </Field>
                <Field label="Direccion" required>
                  <input className="field" required value={general.direccion} onChange={(event) => { markDirty(); setGeneral({ ...general, direccion: event.target.value }); }} />
                </Field>
                <ImageUploadField
                  file={renderFile}
                  inputRef={fileInputRef}
                  previewUrl={renderPreviewUrl}
                  storageReady={storageReady}
                  uploadStatus={uploadStatus}
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    if (!file) return;
                    if (!isAllowedImage(file)) {
                      setError("Formato no valido. Usa JPG, PNG o WebP.");
                      event.target.value = "";
                      return;
                    }
                    if (file.size > maxRenderFileSize) {
                      setError("La imagen no puede superar 8 MB.");
                      event.target.value = "";
                      return;
                    }
                    markDirty();
                    setError("");
                    setRenderFile(file);
                  }}
                  onClear={() => {
                    markDirty();
                    setRenderFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                />
                <Field label="Fecha de inicio" required>
                  <input className="field" required type="date" value={general.fechaInicio} onChange={(event) => { markDirty(); setGeneral({ ...general, fechaInicio: event.target.value }); }} />
                </Field>
                <Field label="Fecha comprometida de entrega" required>
                  <input className="field" required type="date" value={general.fechaComprometida} onChange={(event) => { markDirty(); setGeneral({ ...general, fechaComprometida: event.target.value }); }} />
                </Field>
                <Field label="Estado inicial">
                  <select className="field" value={general.estado} onChange={(event) => { markDirty(); setGeneral({ ...general, estado: event.target.value as WorkStatus }); }}>
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </Field>
              </div>
            </Section>
          ) : null}

          {step === 1 ? (
            <Section title="Responsables" description="Equipo responsable del seguimiento operativo.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Encargado de obra" required>
                  <input className="field" required value={responsibles.encargado} onBlur={() => setResponsibles((current) => ({ ...current, encargado: toTitleCase(current.encargado) }))} onChange={(event) => { markDirty(); setResponsibles({ ...responsibles, encargado: event.target.value }); }} />
                </Field>
                <Field label="Supervisor">
                  <input className="field" value={responsibles.supervisor} onBlur={() => setResponsibles((current) => ({ ...current, supervisor: toTitleCase(current.supervisor) }))} onChange={(event) => { markDirty(); setResponsibles({ ...responsibles, supervisor: event.target.value }); }} />
                </Field>
                <Field label="Fiscalizador">
                  <input className="field" value={responsibles.fiscalizador} onBlur={() => setResponsibles((current) => ({ ...current, fiscalizador: toTitleCase(current.fiscalizador) }))} onChange={(event) => { markDirty(); setResponsibles({ ...responsibles, fiscalizador: event.target.value }); }} />
                </Field>
                <Field label="Cuadrilla asignada opcional">
                  <input className="field" placeholder="Nombre o ID de cuadrilla" value={responsibles.cuadrillaAsignadaId} onBlur={() => setResponsibles((current) => ({ ...current, cuadrillaAsignadaId: toTitleCase(current.cuadrillaAsignadaId) }))} onChange={(event) => { markDirty(); setResponsibles({ ...responsibles, cuadrillaAsignadaId: event.target.value }); }} />
                </Field>
              </div>
            </Section>
          ) : null}

          {step === 2 ? (
            <Section title="Datos financieros" description="Base contractual de la obra. El total se calcula automaticamente.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Presupuesto aprobado" required>
                  <CurrencyInput required value={financial.presupuestoAprobado} onValueChange={(value) => { markDirty(); setFinancial({ ...financial, presupuestoAprobado: value }); }} />
                </Field>
                <Field label="Adicionales aprobados">
                  <CurrencyInput value={financial.adicionalesAprobados} onValueChange={(value) => { markDirty(); setFinancial({ ...financial, adicionalesAprobados: value }); }} />
                </Field>
                <Field label="Descuentos">
                  <CurrencyInput value={financial.descuentos} onValueChange={(value) => { markDirty(); setFinancial({ ...financial, descuentos: value }); }} />
                </Field>
                <Field label="Observacion inicial">
                  <input className="field" value={financial.observacionInicial} onChange={(event) => { markDirty(); setFinancial({ ...financial, observacionInicial: event.target.value }); }} />
                </Field>
              </div>
              <div className="rounded-lg bg-next-bg p-4">
                <p className="text-xs font-bold uppercase text-next-muted">Total contratado calculado</p>
                <p className="mt-1 text-2xl font-black text-next-blue">{formatCurrencyPYG(totalContratado)}</p>
              </div>
            </Section>
          ) : null}

          {step === 3 ? (
            <Section title="Desglose operativo" description="Rubros que van a generar el avance fisico real. Tambien podes configurarlo despues.">
              <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-next-bg p-3">
                <input
                  className="mt-1"
                  type="checkbox"
                  checked={!configureProgressNow}
                  onChange={(event) => { markDirty(); setConfigureProgressNow(!event.target.checked); }}
                />
                <span>
                  <span className="block text-sm font-black text-next-text">Guardar obra y configurar avance despues</span>
                  <span className="mt-1 block text-xs font-semibold text-next-muted">
                    La obra se creara normalmente y quedara como Avance sin configurar.
                  </span>
                </span>
              </label>

              {!configureProgressNow ? (
                <button className="inline-flex h-10 items-center gap-2 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={addRubric}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Agregar rubro
                </button>
              ) : null}

              {configureProgressNow ? (
                <>
                  <div className={`rounded-md px-3 py-2 text-xs font-black ${Math.abs(totalWeight - 100) <= 0.01 ? "bg-green-50 text-next-green" : "bg-orange-50 text-next-orange"}`}>
                    Suma de pesos: {formatWeight(totalWeight)}%. {Math.abs(totalWeight - 100) <= 0.01 ? "Correcto." : "Debe dar 100%."}
                  </div>
                  <div className="space-y-3">
                    {rubrics.map((rubro, index) => {
                      const unit = normalizeUnit(rubro.unidadPrincipal || rubro.unidad);
                      const calculatedQuantity = getRubricQuantity(rubro);
                      return (
                        <div key={index} className="rounded-lg border border-slate-200 p-3">
                          <div className="grid items-start gap-2 xl:grid-cols-[minmax(180px,25%)_130px_120px_minmax(150px,18%)_120px_44px]">
                            <RubricField label="Rubro">
                              <input className="field h-9 px-2 text-xs" value={rubro.nombre} onBlur={() => updateRubric(index, { nombre: toTitleCase(rubro.nombre) })} onChange={(event) => updateRubric(index, { nombre: event.target.value })} />
                            </RubricField>
                            <RubricField label="Modo">
                              <select className="field h-9 px-2 text-xs" value={rubro.modoCarga} onChange={(event) => updateRubricMode(index, event.target.value as WorkBreakdownLoadMode)}>
                                <option value="simple">Simple</option>
                                <option value="detalle">Detalle</option>
                              </select>
                            </RubricField>
                            <RubricField label="Unidad">
                              <select className="field h-9 px-2 text-xs" value={rubro.unidadPrincipal} onChange={(event) => updateRubricUnit(index, normalizeUnit(event.target.value))}>
                                <option value="" disabled>Seleccionar</option>
                                <option value="m2">m{String.fromCharCode(178)}</option>
                                <option value="unidad">unidad</option>
                              </select>
                            </RubricField>
                            <RubricField label={rubro.modoCarga === "detalle" ? "Total calculado" : "Cantidad total prevista"}>
                              {rubro.modoCarga === "detalle" ? (
                                <div className="flex h-9 items-center rounded-md bg-next-bg px-2 text-xs font-black text-next-text">
                                  {calculatedQuantity ? formatMeasure(calculatedQuantity) + " " + (unit === "m2" ? `m${String.fromCharCode(178)}` : "unidad") : "-"}
                                </div>
                              ) : (
                                <input className="field h-9 px-2 text-xs" min={0} step="0.01" type="number" value={rubro.cantidadTotalPrevista} onChange={(event) => updateRubric(index, { cantidadTotalPrevista: event.target.value })} />
                              )}
                            </RubricField>
                            <RubricField label="Peso del rubro">
                              <input className="field h-9 px-2 text-right text-xs" max={100} min={0} step="0.01" type="number" value={rubro.pesoOperativo} onChange={(event) => updateRubric(index, { pesoOperativo: event.target.value })} />
                            </RubricField>
                            <div className="min-w-0">
                              <div className="flex h-8 items-end text-[10px] font-black uppercase leading-tight text-next-muted">
                                <span>Eliminar</span>
                              </div>
                              <button className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-100 text-next-red transition hover:border-next-red hover:bg-red-50" type="button" onClick={() => removeRubric(index)} title="Eliminar rubro" aria-label="Eliminar rubro">
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </button>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-3">
                            <label className="inline-flex items-center gap-2 text-xs font-black text-next-muted">
                              <input
                                type="checkbox"
                                checked={rubro.avanceManualPermitido}
                                onChange={(event) => updateRubric(index, {
                                  avanceManualPermitido: event.target.checked,
                                  modoCalculo: event.target.checked ? "manual" : "cantidad"
                                })}
                              />
                              Avance manual (porcentaje directo)
                            </label>
                            <label className="inline-flex items-center gap-2 text-xs font-black text-next-muted">
                              <input
                                type="checkbox"
                                checked={rubro.requiereProduccion}
                                onChange={(event) => updateRubric(index, { requiereProduccion: event.target.checked })}
                              />
                              Fabricar en taller
                            </label>
                          </div>
                          {rubro.avanceManualPermitido ? (
                            <p className="mt-2 text-xs font-semibold text-next-muted">
                              Permite cargar un porcentaje justificado cuando no sea posible medir por cantidad instalada.
                            </p>
                          ) : null}

                          {rubro.modoCarga === "detalle" ? (
                            <div className="mt-3 rounded-md bg-next-bg p-3">
                              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <p className="text-xs font-black uppercase text-next-blue">Items por medida</p>
                                  <p className="text-xs font-semibold text-next-muted">Carga ancho, alto y cantidad para calcular m? automaticamente.</p>
                                </div>
                                <button className="inline-flex h-9 items-center gap-2 rounded-md border border-next-blue bg-white px-3 text-xs font-black text-next-blue" type="button" onClick={() => addRubricItem(index)}>
                                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                                  Agregar item
                                </button>
                              </div>
                              <div className="space-y-2">
                                {rubro.items.map((item, itemIndex) => (
                                  <RubricItemRow
                                    key={item.id}
                                    item={item}
                                    onRemove={() => removeRubricItem(index, itemIndex)}
                                    onUpdate={(data) => updateRubricItem(index, itemIndex, data)}
                                  />
                                ))}
                                {!rubro.items.length ? <EmptyState text="Todavia no hay items cargados en este rubro." /> : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                  <button className="inline-flex h-10 items-center gap-2 rounded-md border border-next-blue px-3 text-xs font-black text-next-blue" type="button" onClick={addRubric}>
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    Agregar rubro
                  </button>
                </>
              ) : null}
            </Section>
          ) : null}

          {step === 4 ? (
            <Section title="Confirmacion" description="Revisa los datos antes de crear la obra unica.">
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <SummaryItem label="Obra" value={general.nombre || "-"} />
                <SummaryItem label="Cliente" value={general.cliente || "-"} />
                <SummaryItem label="Estado inicial" value={general.estado} />
                <SummaryItem label="Fecha de inicio" value={general.fechaInicio || "-"} />
                <SummaryItem label="Fecha comprometida" value={general.fechaComprometida || "-"} />
                <SummaryItem label="Encargado" value={responsibles.encargado || "-"} />
                <SummaryItem label="Supervisor" value={responsibles.supervisor || "-"} />
                <SummaryItem label="Fiscalizador" value={responsibles.fiscalizador || "-"} />
                <SummaryItem label="Total contratado" value={formatCurrencyPYG(totalContratado)} />
                <SummaryItem label="Imagen/render" value={renderFile ? `Tiene imagen: ${renderFile.name}` : "Sin imagen"} />
                <SummaryItem label="Rubros" value={configureProgressNow ? `${rubrics.length} rubro(s)` : "Se configurara despues"} />
                <SummaryItem label="Produccion taller" value={configureProgressNow ? `${productionCount} item(s)` : "-"} />
                <SummaryItem label="Suma de pesos" value={configureProgressNow ? `${formatWeight(totalWeight)}%` : "-"} />
              </div>
              <Field label="Despues de crear, abrir">
                <select className="field max-w-sm" value={destination} onChange={(event) => setDestination(event.target.value as WizardDestination)}>
                  <option value="avance">Detalle de avance</option>
                  <option value="finanzas">Detalle financiero</option>
                  <option value="control">Control</option>
                </select>
              </Field>
            </Section>
          ) : null}

          <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
            <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-slate-200 px-4 text-sm font-black text-next-muted" type="button" onClick={step === 0 ? closeSafely : () => setStep((current) => current - 1)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              {step === 0 ? "Cancelar" : "Anterior"}
            </button>
            {step < steps.length - 1 ? (
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={nextStep}>
                Siguiente
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : (
              <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white disabled:opacity-60" type="button" disabled={saving} onClick={handleCreate}>
                <Check className="h-4 w-4" aria-hidden="true" />
                {saving ? "Creando obra..." : "Crear obra"}
              </button>
            )}
          </div>
        </form>
        {clienteModalOpen ? (
          <ClienteSelectorModal
            clientes={clientes}
            form={clienteForm}
            query={clienteQuery}
            setForm={setClienteForm}
            setQuery={setClienteQuery}
            onClose={() => setClienteModalOpen(false)}
            onCreate={handleCreateCliente}
            onSelect={(cliente) => {
              markDirty();
              setGeneral((current) => ({
                ...current,
                cliente: cliente.nombre,
                clienteId: cliente.id,
                direccion: current.direccion || cliente.direccion || ""
              }));
              setClienteModalOpen(false);
            }}
          />
        ) : null}
      </section>
    </div>
  );

  function updateRubric(index: number, data: Partial<RubricDraft>) {
    markDirty();
    setRubrics((current) => current.map((rubro, rowIndex) => rowIndex === index ? { ...rubro, ...data } : rubro));
  }

  function updateRubricUnit(index: number, unidad: OperationalUnit | "") {
    updateRubric(index, {
      unidad,
      unidadPrincipal: unidad as WorkBreakdownUnit | ""
    });
  }

  function updateRubricMode(index: number, modoCarga: WorkBreakdownLoadMode) {
    markDirty();
    setRubrics((current) => current.map((rubro, rowIndex) => {
      if (rowIndex !== index) return rubro;
      return {
        ...rubro,
        modoCarga,
        items: modoCarga === "detalle" && !rubro.items.length ? [createEmptyItem()] : rubro.items
      };
    }));
  }

  function addRubricItem(rubricIndex: number) {
    markDirty();
    setRubrics((current) => current.map((rubro, rowIndex) =>
      rowIndex === rubricIndex
        ? { ...rubro, items: [...rubro.items, createEmptyItem(rubro.unidadPrincipal || "m2")] }
        : rubro
    ));
  }

  function updateRubricItem(rubricIndex: number, itemIndex: number, data: Partial<RubricItemDraft>) {
    markDirty();
    setRubrics((current) => current.map((rubro, rowIndex) =>
      rowIndex === rubricIndex
        ? {
            ...rubro,
            items: rubro.items.map((item, currentItemIndex) =>
              currentItemIndex === itemIndex ? { ...item, ...data } : item
            )
          }
        : rubro
    ));
  }

  function removeRubricItem(rubricIndex: number, itemIndex: number) {
    markDirty();
    setRubrics((current) => current.map((rubro, rowIndex) =>
      rowIndex === rubricIndex
        ? { ...rubro, items: rubro.items.filter((_, currentItemIndex) => currentItemIndex !== itemIndex) }
        : rubro
    ));
  }

  function removeRubric(index: number) {
    markDirty();
    setRubrics((current) => distributeRubricWeights(current.filter((_, rowIndex) => rowIndex !== index)));
  }

  function addRubric() {
    markDirty();
    setConfigureProgressNow(true);
    setRubrics((current) => distributeRubricWeights([
      ...current,
      {
        nombre: "",
        unidadPrincipal: "",
        modoCarga: "simple",
        cantidadTotalPrevista: "",
        unidad: "",
        pesoOperativo: "",
        modoCalculo: "cantidad",
        avanceManualPermitido: false,
        requiereProduccion: false,
        items: []
      }
    ]));
  }

  async function handleCreateCliente() {
    if (!clienteForm.nombre.trim()) {
      setError("Carga el nombre o razon social del cliente.");
      return;
    }

    const duplicated = clientes.find((cliente) =>
      cliente.nombre.trim().toLowerCase() === clienteForm.nombre.trim().toLowerCase()
      || (cliente.ruc && clienteForm.ruc && cliente.ruc.trim() === clienteForm.ruc.trim())
    );

    if (duplicated) {
      markDirty();
      setGeneral((current) => ({
        ...current,
        cliente: duplicated.nombre,
        clienteId: duplicated.id,
        direccion: current.direccion || duplicated.direccion || ""
      }));
      setClienteModalOpen(false);
      return;
    }

    const created = await createCliente({
      nombre: toTitleCase(clienteForm.nombre),
      ruc: clienteForm.ruc.trim() || undefined,
      telefono: clienteForm.telefono.trim() || undefined,
      whatsapp: clienteForm.whatsapp.trim() || undefined,
      email: clienteForm.email.trim() || undefined,
      direccion: clienteForm.direccion.trim() || undefined,
      ciudad: clienteForm.ciudad ? toTitleCase(clienteForm.ciudad) : undefined,
      contactoPrincipal: clienteForm.contactoPrincipal ? toTitleCase(clienteForm.contactoPrincipal) : undefined,
      observaciones: clienteForm.observaciones.trim() || undefined,
      createdBy: authUser?.uid ?? profile?.uid ?? "unknown"
    });
    setClientes((current) => [created, ...current]);
    setGeneral((current) => ({
      ...current,
      cliente: created.nombre,
      clienteId: created.id,
      direccion: current.direccion || created.direccion || ""
    }));
    setClienteForm({
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
    markDirty();
    setClienteModalOpen(false);
  }
}

function ImageUploadField({
  file,
  inputRef,
  onChange,
  onClear,
  previewUrl,
  storageReady,
  uploadStatus
}: {
  file: File | null;
  inputRef: MutableRefObject<HTMLInputElement | null>;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  previewUrl: string;
  storageReady: boolean;
  uploadStatus: string;
}) {
  return (
    <div className="sm:col-span-2">
      <p className="text-xs font-black uppercase text-next-muted">Imagen/render opcional</p>
      <div className="mt-1 rounded-lg border border-dashed border-slate-200 bg-next-bg p-3">
        <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)] md:items-center">
          <div className="flex h-36 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-slate-100 sm:h-40">
            {previewUrl ? (
              <img className="h-full w-full object-cover" src={previewUrl} alt="Vista previa del render de obra" />
            ) : (
              <div className="flex flex-col items-center justify-center px-3 py-5 text-center">
                <ImageIcon className="h-7 w-7 text-next-blue/60" aria-hidden="true" />
                <p className="mt-2 text-sm font-black text-next-text">Subi un render o foto principal de la obra</p>
                <p className="mt-1 text-xs font-semibold text-next-muted">JPG, PNG o WebP</p>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onChange}
            />
            <button
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy sm:w-auto"
              type="button"
              onClick={() => inputRef.current?.click()}
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              {file ? "Cambiar imagen" : "Subir imagen"}
            </button>

            {file ? (
              <div className="mt-3 rounded-md bg-white px-3 py-2 ring-1 ring-slate-100">
                <p className="truncate text-xs font-black text-next-text" title={file.name}>{file.name}</p>
                <p className="mt-1 text-xs font-semibold text-next-muted">{formatFileSize(file.size)}</p>
                <button className="mt-2 inline-flex h-8 items-center gap-2 rounded-md border border-red-100 px-2 text-xs font-black text-next-red" type="button" onClick={onClear}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Eliminar imagen
                </button>
              </div>
            ) : null}

            {uploadStatus ? <p className="mt-2 text-xs font-black text-next-blue">{uploadStatus}</p> : null}
            {!storageReady ? (
              <p className="mt-2 text-xs font-semibold leading-5 text-next-orange">
                La imagen se guardara cuando Firebase Storage este disponible.
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function ClienteSelectorModal({
  clientes,
  form,
  onClose,
  onCreate,
  onSelect,
  query,
  setForm,
  setQuery
}: {
  clientes: Cliente[];
  form: {
    nombre: string;
    ruc: string;
    telefono: string;
    whatsapp: string;
    email: string;
    direccion: string;
    ciudad: string;
    contactoPrincipal: string;
    observaciones: string;
  };
  onClose: () => void;
  onCreate: () => Promise<void>;
  onSelect: (cliente: Cliente) => void;
  query: string;
  setForm: (form: {
    nombre: string;
    ruc: string;
    telefono: string;
    whatsapp: string;
    email: string;
    direccion: string;
    ciudad: string;
    contactoPrincipal: string;
    observaciones: string;
  }) => void;
  setQuery: (query: string) => void;
}) {
  const [creating, setCreating] = useState(false);
  const filtered = clientes.filter((cliente) =>
    `${cliente.nombre} ${cliente.ruc ?? ""} ${cliente.email ?? ""}`.toLowerCase().includes(query.toLowerCase())
  );

  async function create() {
    setCreating(true);
    try {
      await onCreate();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950/55 px-3 py-4">
      <section className="mx-auto max-w-4xl rounded-lg bg-white p-4 shadow-2xl sm:p-5">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase text-next-blue">Cliente de la obra</p>
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
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
              <input className="field" required placeholder="Nombre / razon social" value={form.nombre} onBlur={() => setForm({ ...form, nombre: toTitleCase(form.nombre) })} onChange={(event) => setForm({ ...form, nombre: event.target.value })} />
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

function RubricItemRow({
  item,
  onRemove,
  onUpdate
}: {
  item: RubricItemDraft;
  onRemove: () => void;
  onUpdate: (data: Partial<RubricItemDraft>) => void;
}) {
  const unit = normalizeUnit(item.unidad);
  const quantity = Number(item.cantidad || 0);
  const width = item.ancho === "" ? undefined : Number(item.ancho);
  const height = item.alto === "" ? undefined : Number(item.alto);
  const m2Unitario = calculateM2Unitario(width, height);
  const m2Total = calculateM2Total(width, height, quantity);

  return (
    <div className="rounded-md border border-slate-200 bg-white p-2">
      <div className="grid gap-2 xl:grid-cols-[minmax(160px,1fr)_92px_82px_82px_82px_120px_44px]">
        <RubricField label="Detalle">
          <input className="field h-9 px-2 text-xs" value={item.descripcion} onBlur={() => onUpdate({ descripcion: toTitleCase(item.descripcion) })} onChange={(event) => onUpdate({ descripcion: event.target.value })} />
        </RubricField>
        <RubricField label="Unidad">
          <select className="field h-9 px-2 text-xs" value={item.unidad} onChange={(event) => onUpdate({ unidad: normalizeUnit(event.target.value) as WorkBreakdownUnit | "" })}>
            <option value="" disabled>Seleccionar</option>
            <option value="m2">m{String.fromCharCode(178)}</option>
            <option value="unidad">unidad</option>
          </select>
        </RubricField>
        <RubricField label="Ancho">
          <input className="field h-9 px-2 text-xs" min={0} step="0.01" type="number" value={item.ancho} onChange={(event) => onUpdate({ ancho: event.target.value })} />
        </RubricField>
        <RubricField label="Alto">
          <input className="field h-9 px-2 text-xs" min={0} step="0.01" type="number" value={item.alto} onChange={(event) => onUpdate({ alto: event.target.value })} />
        </RubricField>
        <RubricField label="Cantidad">
          <input className="field h-9 px-2 text-xs" min={0} step="0.01" type="number" value={item.cantidad} onChange={(event) => onUpdate({ cantidad: event.target.value })} />
        </RubricField>
        <RubricField label="Resultado">
          <div className="flex h-9 items-center rounded-md bg-next-bg px-2 text-[11px] font-black text-next-text">
            {unit === "m2" && m2Total ? `${formatMeasure(m2Total)} m${String.fromCharCode(178)}` : `${formatMeasure(quantity)} unidad`}
          </div>
        </RubricField>
        <div>
          <div className="flex h-8 items-end text-[10px] font-black uppercase leading-tight text-next-muted">Quitar</div>
          <button className="mt-1 inline-flex h-9 w-9 items-center justify-center rounded-md border border-red-100 text-next-red" type="button" onClick={onRemove} title="Eliminar item">
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs font-semibold text-next-muted">
        <span>m{String.fromCharCode(178)} unitario: {m2Unitario ? formatMeasure(m2Unitario) : "-"}</span>
        <label className="inline-flex items-center gap-2 font-black">
          <input type="checkbox" checked={item.fabricarEnTaller} onChange={(event) => onUpdate({ fabricarEnTaller: event.target.checked })} />
          Fabricar en taller / Enviar a produccion
        </label>
        <input className="field h-8 min-w-[180px] flex-1 px-2 text-xs" placeholder="Observacion opcional" value={item.observacion} onChange={(event) => onUpdate({ observacion: event.target.value })} />
      </div>
    </div>
  );
}

function Section({
  children,
  description,
  title
}: {
  children: ReactNode;
  description: string;
  title: string;
}) {
  return (
    <section className="space-y-4">
      <div>
        <h3 className="text-lg font-black text-next-text">{title}</h3>
        <p className="mt-1 text-sm font-semibold leading-6 text-next-muted">{description}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  children,
  label,
  required = false
}: {
  children: ReactNode;
  label: string;
  required?: boolean;
}) {
  return (
    <label className="block min-w-0 text-xs font-black uppercase text-next-muted">
      {label}{required ? " *" : ""}
      <div className="mt-1">{children}</div>
    </label>
  );
}

function RubricField({
  children,
  help,
  label
}: {
  children: ReactNode;
  help?: string;
  label: string;
}) {
  return (
    <label className="block min-w-0 text-xs font-black uppercase text-next-muted">
      <span className="flex h-8 items-end leading-tight">{label}</span>
      <div className="mt-1">{children}</div>
      {help ? <span className="mt-1 block text-[10px] font-semibold normal-case leading-3 text-next-muted">{help}</span> : null}
    </label>
  );
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-next-bg px-3 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-next-text">{value}</p>
    </div>
  );
}

function Notice({ text, tone = "error" }: { text: string; tone?: "error" | "warning" }) {
  const classes = tone === "warning"
    ? "border-orange-100 bg-orange-50 text-next-orange"
    : "border-red-100 bg-red-50 text-next-red";
  return (
    <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>
      {text}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-6 text-center text-xs font-semibold text-next-muted">
      {text}
    </div>
  );
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

function logNewWorkStep(message: string, data?: unknown) {
  if (import.meta.env.DEV) {
    console.info(`[Nueva obra] ${message}`, data ?? "");
  }
}

function getErrorDetails(error: unknown) {
  return {
    code: typeof error === "object" && error !== null && "code" in error
      ? String((error as { code?: unknown }).code)
      : undefined,
    message: error instanceof Error ? error.message : String(error)
  };
}

function isAllowedImage(file: File) {
  return ["image/jpeg", "image/png", "image/webp"].includes(file.type);
}

function getFileExtension(file: File) {
  const fromName = file.name.split(".").pop();
  if (fromName) return fromName.toLowerCase();
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  return "jpg";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function createEmptyItem(unit: WorkBreakdownUnit | "" = ""): RubricItemDraft {
  return {
    id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    descripcion: "",
    ancho: "",
    alto: "",
    cantidad: "",
    unidad: unit,
    fabricarEnTaller: false,
    observacion: ""
  };
}

function getRubricQuantity(rubro: RubricDraft): number {
  const unit = normalizeUnit(rubro.unidadPrincipal || rubro.unidad) || "unidad";
  if (rubro.modoCarga === "detalle") {
    return calculateRubricQuantityFromItems(unit, rubro.items.map((item) => ({
      id: item.id,
      descripcion: item.descripcion,
      ancho: item.ancho === "" ? undefined : Number(item.ancho),
      alto: item.alto === "" ? undefined : Number(item.alto),
      cantidad: Number(item.cantidad || 0),
      unidad: normalizeUnit(item.unidad) || "unidad",
      m2Unitario: calculateM2Unitario(Number(item.ancho || 0), Number(item.alto || 0)),
      m2Total: calculateM2Total(Number(item.ancho || 0), Number(item.alto || 0), Number(item.cantidad || 0)),
      fabricarEnTaller: item.fabricarEnTaller,
      estadoProduccion: "pendiente",
      cantidadProducida: 0,
      observacion: item.observacion
    })));
  }
  return roundMeasure(Number(rubro.cantidadTotalPrevista || 0));
}

function formatMeasure(value: number) {
  return new Intl.NumberFormat("es-PY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(Number.isFinite(value) ? value : 0);
}

function distributeRubricWeights(rubrics: RubricDraft[]): RubricDraft[] {
  if (!rubrics.length) {
    return rubrics;
  }

  const baseWeight = roundWeight(100 / rubrics.length);
  let accumulated = 0;
  return rubrics.map((rubro, index) => {
    const isLast = index === rubrics.length - 1;
    const nextWeight = isLast ? roundWeight(100 - accumulated) : baseWeight;
    accumulated += nextWeight;
    return {
      ...rubro,
      pesoOperativo: formatWeightValue(nextWeight)
    };
  });
}

function roundWeight(value: number) {
  return Math.max(0, Math.round(value * 100) / 100);
}

function formatWeightValue(value: number) {
  return String(value);
}

function formatWeight(value: number) {
  return new Intl.NumberFormat("es-PY", {
    maximumFractionDigits: 2,
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1
  }).format(value);
}
