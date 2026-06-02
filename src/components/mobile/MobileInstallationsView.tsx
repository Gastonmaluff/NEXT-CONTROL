import { Camera, CheckCircle2, Clock3, MapPin, UploadCloud } from "lucide-react";
import { mobileTasks, mobileTimeline } from "../../data/mockData";
import StatusBadge from "../ui/StatusBadge";

export default function MobileInstallationsView() {
  return (
    <main className="min-h-screen bg-next-navy px-4 py-6 text-next-text">
      <div className="mx-auto max-w-[430px] overflow-hidden rounded-[28px] bg-next-bg shadow-2xl">
        <header className="bg-next-navy px-5 pb-7 pt-6 text-white">
          <p className="text-sm font-black tracking-wide">NEXT GLASS</p>
          <h1 className="mt-5 text-3xl font-black tracking-normal">NEXT CONTROL</h1>
          <p className="mt-1 text-sm font-semibold text-white/72">Cuadrilla en obra</p>
        </header>

        <div className="-mt-4 space-y-4 px-4 pb-5">
          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase text-next-muted">Obra</p>
                <h2 className="mt-1 text-xl font-black">Edificio Aurora</h2>
              </div>
              <StatusBadge label="En instalación" status="info" />
            </div>
            <div className="mt-4 flex items-center gap-2 text-sm font-semibold text-next-muted">
              <MapPin className="h-4 w-4" aria-hidden="true" />
              <span>Palmanova 1234, Asunción</span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                className="h-11 rounded-md bg-next-blue px-3 text-sm font-black text-white shadow-sm"
                type="button"
              >
                Inicié jornada
              </button>
              <button
                className="h-11 rounded-md border border-next-blue bg-white px-3 text-sm font-black text-next-blue"
                type="button"
              >
                Finalizar jornada
              </button>
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-base font-black">Tareas de hoy</h2>
            <ul className="mt-4 space-y-3">
              {mobileTasks.map((task) => (
                <li key={task} className="flex gap-3 text-sm font-semibold">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-next-blue" />
                  <span>{task}</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-black">Fotos de avance</h2>
              <Camera className="h-5 w-5 text-next-blue" aria-hidden="true" />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              {[1, 2, 3].map((item) => (
                <div
                  key={item}
                  className="aspect-square rounded-md bg-gradient-to-br from-next-light via-white to-slate-200 ring-1 ring-slate-200"
                />
              ))}
            </div>
            <button
              className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-md bg-next-blue px-4 text-sm font-black text-white"
              type="button"
            >
              <UploadCloud className="h-5 w-5" aria-hidden="true" />
              Subir fotos
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-base font-black">Observación</h2>
            <p className="mt-3 text-sm font-semibold leading-6 text-next-muted">
              Faltan 4 cerraduras en sector B. Se coordinó entrega para mañana.
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-soft">
            <h2 className="text-base font-black">Línea de tiempo</h2>
            <ol className="mt-4 space-y-4">
              {mobileTimeline.map((item) => (
                <li key={`${item.time}-${item.event}`} className="flex gap-3">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-next-blue" />
                  <div>
                    <p className="text-xs font-black text-next-blue">{item.time}</p>
                    <p className="text-sm font-semibold text-next-text">{item.event}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
