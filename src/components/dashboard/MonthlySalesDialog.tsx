import { Link } from "react-router-dom";
import InstallationDialog from "../installations/InstallationDialog";
import type { Obra } from "../../types";
import { formatCurrencyPYG } from "../../utils/formatters";

type Props = { month: string; works: Obra[]; total: number; canOpenWork: boolean; error?: string; onClose: () => void };
const earlyStates = new Set(["Prospecto", "Presupuesto enviado", "Seguimiento"]);
function displayDate(value: string): string {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split("-").reverse().join("/");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value || "—";
  return new Intl.DateTimeFormat("es-PY", { timeZone: "America/Asuncion", day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}
function displayMonth(month: string): string {
  return new Intl.DateTimeFormat("es-PY", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
}
export default function MonthlySalesDialog({ month, works, total, canOpenWork, error, onClose }: Props) {
  const earlyCount = works.filter(work => earlyStates.has(work.estado)).length;
  return <InstallationDialog title="Detalle de ventas del mes" description={`Obras incluidas en el total de ${displayMonth(month)}.`} onClose={onClose} size="xl" footer={<button type="button" className="inline-flex min-h-11 items-center justify-center rounded-xl bg-next-blue px-5 text-sm font-bold text-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-blue-200" onClick={onClose}>Cerrar</button>}>
    <div className="space-y-5">
      <div className="rounded-2xl bg-slate-50 p-4 sm:p-5"><p className="text-sm font-semibold text-next-muted">Total mostrado en Control</p><p className="mt-1 break-words text-2xl font-black text-next-text sm:text-3xl">{formatCurrencyPYG(total)}</p><p className="mt-2 text-sm text-next-muted">{works.length} {works.length === 1 ? "obra incluida" : "obras incluidas"} · {displayMonth(month)}</p></div>
      {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">No se pudieron cargar todos los datos del panel. Revisá el error antes de interpretar este total.</p>}
      <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-slate-700"><p className="font-bold text-slate-900">¿Cómo se calcula?</p><p className="mt-1">Se suma el importe registrado en cada obra cuya fecha de inicio corresponde al mes elegido. Si falta esa fecha, se usa la creación. En obras nuevas el importe suele incluir adicionales y descuentos. Se incluyen todos los estados, incluso los que no son ventas cerradas.</p></div>
      {earlyCount > 0 && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-900">El total incluye {earlyCount} {earlyCount === 1 ? "obra en estado de prospecto, presupuesto enviado o seguimiento" : "obras en estados de prospecto, presupuesto enviado o seguimiento"}. Conviene revisar si corresponden a ventas cerradas.</p>}
      <div className="space-y-3"><div><h3 className="text-base font-bold text-next-text">Obras que forman el total</h3><p className="mt-1 text-sm text-next-muted">Cada importe corresponde al valor de la obra usado en la suma de Control.</p></div>
        {!works.length ? <p className="rounded-xl border border-dashed border-slate-300 p-5 text-sm text-next-muted">{error ? "No hay datos disponibles para mostrar." : "No hay obras incluidas para este mes."}</p> : <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">{works.map(work => <article key={work.id} className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
          <div className="min-w-0"><h4 className="break-words font-bold text-next-text">{work.nombre || "Obra sin nombre"}</h4><p className="mt-1 break-words text-sm text-next-muted">Cliente: {work.clienteNombre || work.cliente || "Sin indicar"}</p><p className="mt-2 text-sm text-slate-600">{work.fechaInicio ? "Inicio" : "Creación"}: {displayDate(work.fechaInicio || work.createdAt)} <span aria-hidden="true">·</span> Estado: {work.estado || "Sin indicar"}</p>{canOpenWork && <Link className="mt-2 inline-flex min-h-10 items-center text-sm font-bold text-next-blue underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300" to={`/finanzas-obras/${encodeURIComponent(work.id)}`}>Ver obra<span className="sr-only"> {work.nombre}</span></Link>}</div>
          <div className="sm:text-right"><p className="text-xs font-semibold text-next-muted">Importe registrado</p><p className="mt-1 font-bold tabular-nums text-next-text">{formatCurrencyPYG(work.montoAprobado)}</p></div>
        </article>)}</div>}
      </div>
    </div>
  </InstallationDialog>;
}
