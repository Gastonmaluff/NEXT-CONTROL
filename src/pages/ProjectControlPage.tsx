import { Building2, CalendarDays, CircleDollarSign, UserRound } from "lucide-react";
import MaterialsTable from "../components/project/MaterialsTable";
import ProductionChecklist from "../components/project/ProductionChecklist";
import ProjectProgress from "../components/project/ProjectProgress";
import DataCard from "../components/ui/DataCard";
import ProgressBar from "../components/ui/ProgressBar";
import StatusBadge from "../components/ui/StatusBadge";
import {
  missingMaterials,
  productionChecklist,
  projectProgressItems,
  recentActivity
} from "../data/mockData";
import { calculateWeightedProgress } from "../utils/progress";

const overallProgress = calculateWeightedProgress(projectProgressItems);

export default function ProjectControlPage() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase text-next-blue">Operaciones</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal">CONTROL DE OBRA</h1>
      </div>

      <section className="grid gap-5 rounded-lg border border-slate-200 bg-white p-5 shadow-soft lg:grid-cols-[300px_1fr]">
        <div className="flex min-h-56 items-center justify-center rounded-lg bg-gradient-to-br from-next-light via-white to-slate-200">
          <Building2 className="h-24 w-24 text-next-blue/70" aria-hidden="true" />
        </div>
        <div className="space-y-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
            <div>
              <h2 className="text-3xl font-black text-next-text">Palmanova</h2>
              <p className="mt-1 text-sm font-semibold text-next-muted">
                Cliente: Inversora del Este S.A.
              </p>
            </div>
            <StatusBadge label="En ejecución" status="info" />
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <InfoItem icon={CircleDollarSign} label="Monto aprobado" value="₲ 1.245.680.000" />
            <InfoItem icon={CalendarDays} label="Fecha de entrega" value="30 Jun 2025" />
            <InfoItem icon={UserRound} label="Responsable" value="Juan Martínez" />
            <InfoItem icon={CircleDollarSign} label="Saldo pendiente" value="₲ 215.680.000" />
          </div>

          <div className="rounded-lg bg-next-bg p-4">
            <div className="mb-2 flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-black text-next-text">Avance general</p>
                <p className="text-xs font-semibold text-next-muted">
                  Calculado por avance físico ponderado de rubros
                </p>
              </div>
              <p className="text-3xl font-black text-next-blue">{overallProgress}%</p>
            </div>
            <ProgressBar value={overallProgress} />
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-2">
        <DataCard title="Avance por rubro">
          <ProjectProgress items={projectProgressItems} />
        </DataCard>

        <DataCard title="Producción">
          <ProductionChecklist items={productionChecklist} />
        </DataCard>

        <DataCard title="Materiales faltantes">
          <MaterialsTable items={missingMaterials} />
        </DataCard>

        <DataCard title="Actividad reciente">
          <ul className="space-y-3">
            {recentActivity.map((activity) => (
              <li
                key={activity}
                className="rounded-md border border-slate-100 px-3 py-3 text-sm font-semibold leading-6 text-next-muted"
              >
                {activity}
              </li>
            ))}
          </ul>
        </DataCard>
      </section>
    </div>
  );
}

function InfoItem({
  icon: Icon,
  label,
  value
}: {
  icon: typeof CircleDollarSign;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border border-slate-100 bg-next-bg px-3 py-3">
      <Icon className="mb-3 h-5 w-5 text-next-blue" aria-hidden="true" />
      <p className="text-xs font-bold uppercase text-next-muted">{label}</p>
      <p className="mt-1 break-words text-sm font-black text-next-text">{value}</p>
    </div>
  );
}
