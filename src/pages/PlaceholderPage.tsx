import { Wrench } from "lucide-react";
import DataCard from "../components/ui/DataCard";

export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-black uppercase text-next-blue">Módulo</p>
        <h1 className="mt-1 text-3xl font-black tracking-normal">{title}</h1>
      </div>
      <DataCard title={`${title} en preparación`}>
        <div className="flex items-center gap-4 rounded-lg bg-next-light p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white text-next-blue">
            <Wrench className="h-6 w-6" aria-hidden="true" />
          </div>
          <div>
            <p className="font-black text-next-text">Vista reservada para la próxima iteración.</p>
            <p className="mt-1 text-sm font-semibold text-next-muted">
              La navegación ya está lista para conectar datos reales y flujos del módulo.
            </p>
          </div>
        </div>
      </DataCard>
    </div>
  );
}
