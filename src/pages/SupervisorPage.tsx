import { ClipboardCheck, Clock3, UserRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import ProgressReportModal from "../components/progress/ProgressReportModal";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import { useAuth } from "../context/AuthContext";
import {
  createProgressReport,
  getCuadrillas,
  getObras,
  getPendingMaterialsByWork,
  getProgressReportsByWork,
  getProgressRubricsByWork
} from "../lib/firestore";
import { canViewAllWorksForUser } from "../lib/roles";
import type {
  Cuadrilla,
  Obra,
  ProgressMaterialReport,
  ProgressReport,
  WorkProgressRubric
} from "../types";
import { formatDateShort } from "../utils/formatters";
import { calculateWeightedProgressFromReports } from "../utils/progress";

export default function SupervisorPage() {
  const { profile } = useAuth();
  const [obras, setObras] = useState<Obra[]>([]);
  const [rubrics, setRubrics] = useState<WorkProgressRubric[]>([]);
  const [reports, setReports] = useState<ProgressReport[]>([]);
  const [materials, setMaterials] = useState<ProgressMaterialReport[]>([]);
  const [cuadrillas, setCuadrillas] = useState<Cuadrilla[]>([]);
  const [selectedObra, setSelectedObra] = useState<Obra | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setError("");
    try {
      const loadedObras = await getObras();
      const visibleObras = canViewAllWorksForUser(profile)
        ? loadedObras
        : loadedObras.filter((obra) =>
            obra.assignedUserIds?.includes(profile?.uid ?? "") ||
            obra.supervisor?.toLowerCase().includes((profile?.nombre ?? "").toLowerCase()) ||
            obra.responsable.toLowerCase().includes((profile?.nombre ?? "").toLowerCase())
          );
      const [allRubrics, allReports, allMaterials, crews] = await Promise.all([
        Promise.all(visibleObras.map((obra) => getProgressRubricsByWork(obra.id))).then((items) => items.flat()),
        Promise.all(visibleObras.map((obra) => getProgressReportsByWork(obra.id))).then((items) => items.flat()),
        Promise.all(visibleObras.map((obra) => getPendingMaterialsByWork(obra.id))).then((items) => items.flat()),
        getCuadrillas()
      ]);
      setObras(visibleObras);
      setRubrics(allRubrics);
      setReports(allReports);
      setMaterials(allMaterials);
      setCuadrillas(crews);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudo cargar la vista supervisor.");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateReport(report: Omit<ProgressReport, "id" | "createdAt" | "updatedAt">) {
    await createProgressReport(report);
    setSelectedObra(null);
    setMessage("Parte de avance registrado.");
    await load();
  }

  const assignedCount = useMemo(() => obras.length, [obras.length]);

  if (loading) {
    return <main className="min-h-screen bg-next-bg px-4 py-6 text-sm font-bold text-next-muted">Cargando supervisor...</main>;
  }

  return (
    <main className="min-h-screen bg-next-bg px-4 py-5 text-next-text">
      <div className="mx-auto max-w-3xl space-y-4">
        <header className="rounded-lg bg-next-navy px-5 py-5 text-white shadow-soft">
          <p className="text-xs font-black uppercase text-white/65">NEXT CONTROL CAMPO</p>
          <h1 className="mt-2 text-2xl font-black">Hola, {profile?.nombre ?? "Usuario"}</h1>
          <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md bg-white/10 px-3 py-3">
              <p className="text-xs font-bold uppercase text-white/60">Rol</p>
              <p className="mt-1 font-black capitalize">{profile?.role ?? "sin rol"}</p>
            </div>
            <div className="rounded-md bg-white/10 px-3 py-3">
              <p className="text-xs font-bold uppercase text-white/60">Obras</p>
              <p className="mt-1 font-black">{assignedCount}</p>
            </div>
          </div>
        </header>

        {message ? <Notice tone="success" text={message} /> : null}
        {error ? <Notice tone="error" text={error} /> : null}

        <section className="space-y-3">
          {obras.length ? obras.map((obra) => {
            const obraRubrics = rubrics.filter((rubro) => rubro.obraId === obra.id);
            const obraReports = reports.filter((report) => report.obraId === obra.id);
            const progress = calculateWeightedProgressFromReports(obraRubrics, obraReports);
            const activeCrew = cuadrillas.find((crew) => crew.obraId === obra.id && crew.estado === "En obra" && !crew.horaFin);
            const latest = obraReports[0];
            const pending = materials.filter((material) => material.obraId === obra.id && material.estado !== "Resuelto").length;

            return (
              <article key={obra.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg font-black leading-tight">{obra.nombre}</h2>
                    <p className="mt-1 text-sm font-semibold text-next-muted">{obra.cliente}</p>
                  </div>
                  <StatusBadge label={obra.estado} status={obra.estado === "Atrasada" ? "critical" : "info"} />
                </div>

                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs font-black uppercase text-next-muted">Avance general</p>
                    <p className="text-xl font-black text-next-blue">{progress}%</p>
                  </div>
                  <ProgressBar value={progress} />
                </div>

                <div className="mt-4 grid gap-2 text-sm font-semibold text-next-muted">
                  <Line icon={Clock3} label="Ultima actualizacion" value={latest ? `${formatDateShort(latest.fecha)} ${latest.hora}` : "Sin reportes"} />
                  <Line icon={UserRound} label="Cuadrilla activa" value={activeCrew ? `${activeCrew.nombre} desde ${activeCrew.horaInicio || "--:--"}` : "Sin cuadrilla activa"} />
                  <Line icon={ClipboardCheck} label="Materiales pendientes" value={`${pending}`} />
                </div>

                <button className="mt-4 h-11 w-full rounded-md bg-next-blue px-4 text-sm font-black text-white" type="button" onClick={() => setSelectedObra(obra)}>
                  Registrar avance
                </button>
              </article>
            );
          }) : <EmptyState text="No hay obras asignadas." />}
        </section>
      </div>

      {selectedObra ? (
        <ProgressReportModal
          obra={selectedObra}
          rubrics={rubrics.filter((rubro) => rubro.obraId === selectedObra.id)}
          reports={reports.filter((report) => report.obraId === selectedObra.id)}
          cuadrillas={cuadrillas}
          user={profile ?? undefined}
          onClose={() => setSelectedObra(null)}
          onSubmit={handleCreateReport}
        />
      ) : null}
    </main>
  );
}

function Line({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-next-blue" aria-hidden="true" />
      <span className="font-black text-next-text">{label}:</span>
      <span>{value}</span>
    </div>
  );
}

function Notice({ tone, text }: { tone: "success" | "error"; text: string }) {
  const classes = tone === "success"
    ? "border-green-100 bg-green-50 text-next-green"
    : "border-red-100 bg-red-50 text-next-red";
  return <div className={`rounded-lg border px-4 py-3 text-sm font-semibold ${classes}`}>{text}</div>;
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm font-semibold text-next-muted">
      {text}
    </div>
  );
}
