import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import type { MutableRefObject, ReactNode } from "react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import CurrencyInput from "../ui/CurrencyInput";
import { firebaseStorage, isFirebaseConfigured } from "../../lib/firebase";
import {
  createActividad,
  createObra,
  createProgressRubric,
  updateObra
} from "../../lib/firestore";
import { buildWorkRenderPath, sanitizeStorageFileName, uploadFile } from "../../lib/storageUpload";
import type { Obra, ProgressCalculationMode, WorkStatus } from "../../types";
import { formatCurrencyPYG, getTodayInputDate } from "../../utils/formatters";
import { toTitleCase } from "../../utils/text";
import { normalizeUnit, type OperationalUnit } from "../../utils/units";

type WizardDestination = "avance" | "finanzas" | "control";

type NewWorkWizardProps = {
  defaultDestination: WizardDestination;
  onClose: () => void;
  onCreated: (obra: Obra, destination: WizardDestination, notice?: string) => void;
};

const maxRenderFileSize = 8 * 1024 * 1024;

type RubricDraft = {
  nombre: string;
  cantidadTotalPrevista: string;
  unidad: OperationalUnit | "";
  pesoOperativo: string;
  modoCalculo: ProgressCalculationMode;
  avanceManualPermitido: boolean;
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
  const { profile } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [dirty, setDirty] = useState(false);
  const [destination, setDestination] = useState<WizardDestination>(defaultDestination);
  const [configureProgressNow, setConfigureProgressNow] = useState(false);
  const [general, setGeneral] = useState({
    nombre: "",
    cliente: "",
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
      if (rubrics.some((rubro) => !rubro.nombre.trim() || !rubro.unidad.trim())) {
        return "Todos los rubros necesitan nombre y unidad.";
      }
      if (rubrics.some((rubro) => rubro.cantidadTotalPrevista === "" || Number(rubro.cantidadTotalPrevista) <= 0)) {
        return "Todos los rubros necesitan una cantidad total prevista mayor a cero.";
      }
      if (rubrics.some((rubro) => rubro.pesoOperativo === "" || Number(rubro.pesoOperativo) < 0 || Number(rubro.pesoOperativo) > 100)) {
        return "Todos los rubros necesitan un peso entre 0 y 100.";
      }
      if (rubrics.some((rubro) => Number(rubro.cantidadTotalPrevista || 0) < 0 || Number.isNaN(Number(rubro.cantidadTotalPrevista)) || Number.isNaN(Number(rubro.pesoOperativo)))) {
        return "Revisa cantidades y pesos. No pueden ser negativos ni invalidos.";
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
      unidad: normalizeUnit(rubro.unidad) || rubro.unidad.trim(),
      cantidad: Number(rubro.cantidadTotalPrevista || 0),
      peso: Number(rubro.pesoOperativo || 0)
    }));

    try {
      logNewWorkStep("Creando documento de obra");
      const created = await withTimeout(createObra({
        nombre: normalizedGeneral.nombre,
        cliente: normalizedGeneral.cliente,
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
        createdBy: profile?.uid ?? "unknown"
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
            renderUploadedBy: profile?.uid ?? "unknown"
          }), 15000, "guardar la URL del render");
          logNewWorkStep("Upload success", { obraId: created.id, uploadPath });
        } catch (uploadError) {
          logNewWorkStep("Upload failed", getErrorDetails(uploadError));
          console.error("No se pudo subir la imagen principal de la obra.", uploadError);
          completionNotice = "Obra creada. La imagen no pudo subirse, pero podes cargarla despues desde Editar obra.";
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
                cantidadTotalPrevista: rubro.cantidad,
                pesoOperativo: rubro.peso,
                modoCalculo: rubro.modoCalculo,
                avanceManualPermitido: rubro.avanceManualPermitido,
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
                  <input className="field" required value={general.cliente} onBlur={() => setGeneral((current) => ({ ...current, cliente: toTitleCase(current.cliente) }))} onChange={(event) => { markDirty(); setGeneral({ ...general, cliente: event.target.value }); }} />
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
                    {rubrics.map((rubro, index) => (
                      <div key={index} className="rounded-lg border border-slate-200 p-3">
                        <div className="grid items-start gap-2 lg:grid-cols-[minmax(180px,34%)_minmax(100px,14%)_minmax(150px,22%)_minmax(120px,18%)_minmax(44px,7%)]">
                        <RubricField label="Rubro">
                          <input className="field h-9 px-2 text-xs" value={rubro.nombre} onBlur={() => updateRubric(index, { nombre: toTitleCase(rubro.nombre) })} onChange={(event) => updateRubric(index, { nombre: event.target.value })} />
                        </RubricField>
                        <RubricField label="Unidad">
                          <select className="field h-9 px-2 text-xs" value={rubro.unidad} onChange={(event) => updateRubricUnit(index, normalizeUnit(event.target.value))}>
                            <option value="" disabled>Seleccionar unidad</option>
                            <option value="m2">m²</option>
                            <option value="unidad">unidad</option>
                          </select>
                        </RubricField>
                        <RubricField label="Cantidad total prevista">
                          <input className="field h-9 px-2 text-xs" min={0} type="number" value={rubro.cantidadTotalPrevista} onChange={(event) => updateRubric(index, { cantidadTotalPrevista: event.target.value })} />
                        </RubricField>
                        <RubricField label="Peso del rubro">
                          <input className="field h-9 px-2 text-right text-xs" max={100} min={0} type="number" value={rubro.pesoOperativo} onChange={(event) => updateRubric(index, { pesoOperativo: event.target.value })} />
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
                        <label className="mt-3 inline-flex items-center gap-2 text-xs font-black text-next-muted">
                          <input
                            type="checkbox"
                            checked={rubro.avanceManualPermitido}
                            onChange={(event) => updateRubric(index, {
                              avanceManualPermitido: event.target.checked,
                              modoCalculo: event.target.checked ? "manual" : "cantidad"
                            })}
                          />
                          Usar avance manual
                        </label>
                      </div>
                    ))}
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
      </section>
    </div>
  );

  function updateRubric(index: number, data: Partial<RubricDraft>) {
    markDirty();
    setRubrics((current) => current.map((rubro, rowIndex) => rowIndex === index ? { ...rubro, ...data } : rubro));
  }

  function updateRubricUnit(index: number, unidad: OperationalUnit | "") {
    updateRubric(index, {
      unidad
    });
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
        cantidadTotalPrevista: "",
        unidad: "",
        pesoOperativo: "",
        modoCalculo: "cantidad",
        avanceManualPermitido: false
      }
    ]));
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
