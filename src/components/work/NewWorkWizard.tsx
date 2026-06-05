import { ArrowLeft, ArrowRight, Check, Image as ImageIcon, Plus, Trash2, Upload, X } from "lucide-react";
import type { MutableRefObject, ReactNode } from "react";
import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { firebaseStorage, isFirebaseConfigured } from "../../lib/firebase";
import {
  createActividad,
  createObra,
  createProgressRubric,
  updateObra
} from "../../lib/firestore";
import { uploadFile } from "../../lib/storageUpload";
import type { Obra, ProgressCalculationMode, WorkStatus } from "../../types";
import { formatCurrencyPYG, getTodayInputDate } from "../../utils/formatters";

type WizardDestination = "avance" | "finanzas" | "control";

type NewWorkWizardProps = {
  defaultDestination: WizardDestination;
  onClose: () => void;
  onCreated: (obra: Obra, destination: WizardDestination) => void;
};

type RubricDraft = {
  nombre: string;
  cantidadTotalPrevista: string;
  unidad: string;
  pesoOperativo: string;
  modoCalculo: ProgressCalculationMode;
};

const statuses: WorkStatus[] = [
  "Aprobado",
  "Produccion",
  "Instalacion",
  "Pausada",
  "Atrasada",
  "Finalizada"
];

const defaultRubrics: RubricDraft[] = [
  { nombre: "Carpinteria instalada", cantidadTotalPrevista: "500", unidad: "m2", pesoOperativo: "35", modoCalculo: "cantidad" },
  { nombre: "Vidrios instalados", cantidadTotalPrevista: "650", unidad: "m2", pesoOperativo: "40", modoCalculo: "cantidad" },
  { nombre: "Contramarcos", cantidadTotalPrevista: "180", unidad: "unidades", pesoOperativo: "15", modoCalculo: "cantidad" },
  { nombre: "Sellado final", cantidadTotalPrevista: "650", unidad: "m2", pesoOperativo: "10", modoCalculo: "manual" }
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
  const [uploadStatus, setUploadStatus] = useState("");
  const [dirty, setDirty] = useState(false);
  const [destination, setDestination] = useState<WizardDestination>(defaultDestination);
  const [configureProgressNow, setConfigureProgressNow] = useState(true);
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
    presupuestoAprobado: "",
    adicionalesAprobados: "0",
    descuentos: "0",
    observacionInicial: ""
  });
  const [rubrics, setRubrics] = useState<RubricDraft[]>(defaultRubrics);
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
      Number(financial.presupuestoAprobado || 0)
      + Number(financial.adicionalesAprobados || 0)
      - Number(financial.descuentos || 0),
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
    }

    if (currentStep === 1) {
      if (!responsibles.encargado.trim()) {
        return "Carga el encargado de obra.";
      }
    }

    if (currentStep === 2) {
      if (Number(financial.presupuestoAprobado || 0) <= 0) {
        return "Carga un presupuesto aprobado mayor a cero.";
      }
    }

    if (currentStep === 3 && configureProgressNow) {
      if (!rubrics.length) return "Agrega al menos un rubro o elegi configurar despues.";
      if (rubrics.some((rubro) => !rubro.nombre.trim() || !rubro.unidad.trim())) {
        return "Todos los rubros necesitan nombre y unidad.";
      }
      if (rubrics.some((rubro) => Number(rubro.cantidadTotalPrevista || 0) < 0 || Number(rubro.pesoOperativo || 0) < 0 || Number(rubro.pesoOperativo || 0) > 100)) {
        return "Revisa cantidades y pesos. Los pesos deben estar entre 0 y 100.";
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
    const validation = [0, 1, 2, 3].map((item) => validateStep(item)).find(Boolean);
    if (validation) {
      setError(validation);
      setStep(Math.max(0, [0, 1, 2, 3].find((item) => validateStep(item)) ?? 0));
      return;
    }

    if (configureProgressNow && totalWeight !== 100 && !window.confirm(`La suma de pesos es ${totalWeight}%. Crear obra igualmente?`)) {
      return;
    }

    setSaving(true);
    setError("");
    setUploadStatus("");
    try {
      const created = await createObra({
        nombre: general.nombre.trim(),
        cliente: general.cliente.trim(),
        arquitecto: general.arquitecto.trim(),
        ubicacion: general.direccion.trim(),
        direccion: general.direccion.trim(),
        montoAprobado: totalContratado,
        fechaInicio: general.fechaInicio,
        fechaEntrega: general.fechaComprometida,
        fechaComprometida: general.fechaComprometida,
        responsable: responsibles.encargado.trim(),
        encargado: responsibles.encargado.trim(),
        supervisor: responsibles.supervisor.trim() || undefined,
        fiscalizador: responsibles.fiscalizador.trim() || undefined,
        cuadrillaAsignadaId: responsibles.cuadrillaAsignadaId.trim() || undefined,
        estado: general.estado,
        saldoPendienteCobro: totalContratado,
        presupuestoAprobado: Number(financial.presupuestoAprobado || 0),
        adicionalesAprobados: Number(financial.adicionalesAprobados || 0),
        descuentos: Number(financial.descuentos || 0),
        totalContratado,
        valorFinalContratado: totalContratado,
        observacionInicial: financial.observacionInicial.trim() || undefined,
        progressConfigured: configureProgressNow,
        rubrosAvance: [],
        etapasProduccion: [],
        materialesFaltantes: [],
        createdBy: profile?.uid ?? "unknown"
      });

      let createdWithImage = created;
      if (renderFile && storageReady) {
        try {
          setUploadStatus("Subiendo imagen...");
          const extension = getFileExtension(renderFile);
          const url = await uploadFile(
            `obras/${created.id}/render/${Date.now()}-${sanitizeFileName(renderFile.name || `render.${extension}`)}`,
            renderFile
          );
          createdWithImage = await updateObra(created.id, { renderUrl: url });
        } catch (uploadError) {
          console.error("No se pudo subir la imagen principal de la obra.", uploadError);
          window.alert("La obra fue creada, pero no se pudo subir la imagen. Podes volver a cargarla cuando Firebase Storage este disponible.");
        } finally {
          setUploadStatus("");
        }
      }

      if (configureProgressNow) {
        const createdRubrics = await Promise.all(
          rubrics.map((rubro, index) =>
            createProgressRubric({
              obraId: created.id,
              nombre: rubro.nombre.trim(),
              unidad: rubro.unidad.trim(),
              cantidadTotalPrevista: Number(rubro.cantidadTotalPrevista || 0),
              pesoOperativo: Number(rubro.pesoOperativo || 0),
              modoCalculo: rubro.modoCalculo,
              avanceManualPermitido: rubro.modoCalculo === "manual",
              orden: index + 1
            })
          )
        );
        createdWithImage = await updateObra(created.id, {
          rubrosAvance: createdRubrics.map((rubro) => ({
            id: rubro.id,
            nombre: rubro.nombre,
            peso: rubro.pesoOperativo,
            avance: 0
          })),
          progressConfigured: true
        });
      }

      await createActividad({
        obraId: createdWithImage.id,
        tipo: "obra",
        descripcion: configureProgressNow
          ? "Obra creada con desglose operativo inicial."
          : "Obra creada. Avance pendiente de configurar.",
        usuario: profile?.nombre ?? "Administrador",
        fecha: new Date().toISOString()
      });

      onCreated(createdWithImage, destination);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "No se pudo crear la obra.");
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

          {step === 0 ? (
            <Section title="Datos generales" description="Identificacion principal de la obra y fechas de referencia.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nombre de obra" required>
                  <input className="field" required value={general.nombre} onChange={(event) => { markDirty(); setGeneral({ ...general, nombre: event.target.value }); }} />
                </Field>
                <Field label="Cliente" required>
                  <input className="field" required value={general.cliente} onChange={(event) => { markDirty(); setGeneral({ ...general, cliente: event.target.value }); }} />
                </Field>
                <Field label="Arquitecto opcional">
                  <input className="field" value={general.arquitecto} onChange={(event) => { markDirty(); setGeneral({ ...general, arquitecto: event.target.value }); }} />
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
                <Field label="Estado inicial">
                  <select className="field" value={general.estado} onChange={(event) => { markDirty(); setGeneral({ ...general, estado: event.target.value as WorkStatus }); }}>
                    {statuses.map((status) => <option key={status}>{status}</option>)}
                  </select>
                </Field>
                <Field label="Fecha de inicio" required>
                  <input className="field" required type="date" value={general.fechaInicio} onChange={(event) => { markDirty(); setGeneral({ ...general, fechaInicio: event.target.value }); }} />
                </Field>
                <Field label="Fecha comprometida de entrega" required>
                  <input className="field" required type="date" value={general.fechaComprometida} onChange={(event) => { markDirty(); setGeneral({ ...general, fechaComprometida: event.target.value }); }} />
                </Field>
              </div>
            </Section>
          ) : null}

          {step === 1 ? (
            <Section title="Responsables" description="Equipo responsable del seguimiento operativo.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Encargado de obra" required>
                  <input className="field" required value={responsibles.encargado} onChange={(event) => { markDirty(); setResponsibles({ ...responsibles, encargado: event.target.value }); }} />
                </Field>
                <Field label="Supervisor">
                  <input className="field" value={responsibles.supervisor} onChange={(event) => { markDirty(); setResponsibles({ ...responsibles, supervisor: event.target.value }); }} />
                </Field>
                <Field label="Fiscalizador">
                  <input className="field" value={responsibles.fiscalizador} onChange={(event) => { markDirty(); setResponsibles({ ...responsibles, fiscalizador: event.target.value }); }} />
                </Field>
                <Field label="Cuadrilla asignada opcional">
                  <input className="field" placeholder="Nombre o ID de cuadrilla" value={responsibles.cuadrillaAsignadaId} onChange={(event) => { markDirty(); setResponsibles({ ...responsibles, cuadrillaAsignadaId: event.target.value }); }} />
                </Field>
              </div>
            </Section>
          ) : null}

          {step === 2 ? (
            <Section title="Datos financieros" description="Base contractual de la obra. El total se calcula automaticamente.">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Presupuesto aprobado" required>
                  <input className="field" min={0} required type="number" value={financial.presupuestoAprobado} onChange={(event) => { markDirty(); setFinancial({ ...financial, presupuestoAprobado: event.target.value }); }} />
                </Field>
                <Field label="Adicionales aprobados">
                  <input className="field" min={0} type="number" value={financial.adicionalesAprobados} onChange={(event) => { markDirty(); setFinancial({ ...financial, adicionalesAprobados: event.target.value }); }} />
                </Field>
                <Field label="Descuentos">
                  <input className="field" min={0} type="number" value={financial.descuentos} onChange={(event) => { markDirty(); setFinancial({ ...financial, descuentos: event.target.value }); }} />
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

              {configureProgressNow ? (
                <>
                  <div className={`rounded-md px-3 py-2 text-xs font-black ${totalWeight === 100 ? "bg-green-50 text-next-green" : "bg-orange-50 text-next-orange"}`}>
                    Suma de pesos: {totalWeight}%. {totalWeight === 100 ? "Correcto." : "Lo recomendado es 100%."}
                  </div>
                  <div className="space-y-3">
                    {rubrics.map((rubro, index) => (
                      <div key={`${rubro.nombre}-${index}`} className="grid gap-2 rounded-lg border border-slate-200 p-3 lg:grid-cols-[1.25fr_140px_100px_100px_130px_auto]">
                        <Field label="Rubro">
                          <input className="field" value={rubro.nombre} onChange={(event) => updateRubric(index, { nombre: event.target.value })} />
                        </Field>
                        <Field label="Cantidad total prevista">
                          <input className="field" min={0} type="number" value={rubro.cantidadTotalPrevista} onChange={(event) => updateRubric(index, { cantidadTotalPrevista: event.target.value })} />
                        </Field>
                        <Field label="Unidad">
                          <input className="field" value={rubro.unidad} onChange={(event) => updateRubric(index, { unidad: event.target.value })} />
                        </Field>
                        <Field label="Peso operativo">
                          <input className="field" max={100} min={0} type="number" value={rubro.pesoOperativo} onChange={(event) => updateRubric(index, { pesoOperativo: event.target.value })} />
                        </Field>
                        <Field label="Modo de calculo">
                          <select className="field" value={rubro.modoCalculo} onChange={(event) => updateRubric(index, { modoCalculo: event.target.value as ProgressCalculationMode })}>
                            <option value="cantidad">cantidad</option>
                            <option value="manual">manual</option>
                          </select>
                        </Field>
                        <button className="mt-5 inline-flex h-10 items-center justify-center rounded-md border border-red-100 px-3 text-xs font-black text-next-red" type="button" onClick={() => removeRubric(index)}>
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
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
                <SummaryItem label="Encargado" value={responsibles.encargado || "-"} />
                <SummaryItem label="Supervisor" value={responsibles.supervisor || "-"} />
                <SummaryItem label="Fiscalizador" value={responsibles.fiscalizador || "-"} />
                <SummaryItem label="Total contratado" value={formatCurrencyPYG(totalContratado)} />
                <SummaryItem label="Avance" value={configureProgressNow ? `${rubrics.length} rubro(s), ${totalWeight}% de peso` : "Se configurara despues"} />
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
                {saving ? "Creando..." : "Crear obra"}
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

  function removeRubric(index: number) {
    markDirty();
    setRubrics((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function addRubric() {
    markDirty();
    setRubrics((current) => [
      ...current,
      {
        nombre: "Nuevo rubro",
        cantidadTotalPrevista: "0",
        unidad: "unidades",
        pesoOperativo: "0",
        modoCalculo: "cantidad"
      }
    ]);
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
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <div className="flex min-h-36 flex-1 items-center justify-center overflow-hidden rounded-md bg-white ring-1 ring-slate-100">
            {previewUrl ? (
              <img className="max-h-56 w-full object-contain" src={previewUrl} alt="Vista previa del render de obra" />
            ) : (
              <div className="flex flex-col items-center justify-center px-4 py-8 text-center">
                <ImageIcon className="h-8 w-8 text-next-blue/60" aria-hidden="true" />
                <p className="mt-2 text-sm font-black text-next-text">Subi un render o foto principal de la obra</p>
                <p className="mt-1 text-xs font-semibold text-next-muted">JPG, PNG o WebP</p>
              </div>
            )}
          </div>

          <div className="min-w-0 md:w-64">
            <input
              ref={inputRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={onChange}
            />
            <button
              className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white transition hover:bg-next-navy"
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

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-next-bg px-3 py-3">
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-next-text">{value}</p>
    </div>
  );
}

function Notice({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-next-red">
      {text}
    </div>
  );
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

function sanitizeFileName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
}

function formatFileSize(bytes: number) {
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
