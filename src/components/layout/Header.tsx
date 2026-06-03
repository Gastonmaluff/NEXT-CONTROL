import { Bell, Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { logout } from "../../lib/auth";

export default function Header() {
  const navigate = useNavigate();

  async function handleLogout() {
    await logout();
    navigate(0);
  }

  return (
    <header className="sticky top-[92px] z-20 min-w-0 border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:px-6 lg:top-0 lg:px-8">
      <div className="mx-auto flex w-full max-w-none min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative min-w-0 flex-1 sm:max-w-xl">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-next-muted"
            aria-hidden="true"
          />
          <input
            className="h-11 w-full rounded-md border border-slate-200 bg-next-bg pl-10 pr-4 text-sm text-next-text outline-none transition placeholder:text-next-muted focus:border-next-blue focus:bg-white focus:ring-4 focus:ring-next-blue/10"
            placeholder="Buscar obras, clientes, cobros o materiales"
            type="search"
          />
        </label>

        <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 sm:justify-end">
          <button
            className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-slate-200 bg-white text-next-muted transition hover:border-next-blue hover:text-next-blue"
            type="button"
            aria-label="Notificaciones"
            title="Notificaciones"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
          </button>
          <div className="flex min-w-0 items-center gap-3 rounded-md border border-slate-200 bg-white px-3 py-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-next-blue text-sm font-bold text-white">
              A
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold leading-5">Admin</p>
              <p className="text-xs font-medium text-next-muted">Administrador</p>
            </div>
          </div>
          <button
            className="h-11 rounded-md border border-slate-200 bg-white px-3 text-sm font-black text-next-muted transition hover:border-next-blue hover:text-next-blue"
            type="button"
            onClick={handleLogout}
          >
            Salir
          </button>
        </div>
      </div>
    </header>
  );
}
