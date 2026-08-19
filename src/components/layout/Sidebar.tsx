import { ChevronRight, LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import BrandLogo from "../brand/BrandLogo";
import { navigationItems } from "../../data/navigation";
import { useAuth } from "../../context/AuthContext";
import { canManageUsers, canViewModule } from "../../lib/roles";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { logout, profile } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const items = navigationItems.filter((item) =>
    canViewModule(profile, item.moduleName) &&
    (!item.adminOnly || canManageUsers(profile)) &&
    (!item.roles || (profile?.role ? item.roles.includes(profile.role) : false))
  );
  const currentItem = items.find((item) =>
    location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
  );

  useEffect(() => {
    setMobileOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-slate-200 bg-white/95 px-4 shadow-[0_8px_24px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-next-navy shadow-sm">
            <BrandLogo variant="compact" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-black uppercase text-next-blue">NEXT CONTROL</p>
            <p className="truncate text-sm font-black text-next-text">{currentItem?.label ?? "Panel principal"}</p>
          </div>
        </div>
        <button
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-next-navy"
          type="button"
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu principal"
          aria-expanded={mobileOpen}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </button>
      </header>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 h-full w-full bg-slate-950/50 backdrop-blur-[2px]"
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Cerrar menu"
          />
          <section
            className="absolute inset-y-0 right-0 flex w-[min(88vw,360px)] flex-col bg-white shadow-2xl"
            role="dialog"
            aria-label="Menu principal"
            aria-modal="true"
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
              <div className="min-w-0">
                <p className="text-[11px] font-black uppercase text-next-blue">Navegacion</p>
                <p className="truncate text-base font-black text-next-text">{profile?.nombre ?? "NEXT CONTROL"}</p>
                <p className="truncate text-xs font-semibold capitalize text-next-muted">
                  {profile?.role?.replace(/_/g, " ") ?? ""}
                </p>
              </div>
              <button
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-next-navy"
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Cerrar menu"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.label}
                    to={item.path}
                    className={({ isActive }) =>
                      `flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-bold ${
                        isActive ? "bg-next-light text-next-blue" : "text-next-text active:bg-slate-100"
                      }`
                    }
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-next-blue">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                  </NavLink>
                );
              })}
            </nav>

            <div className="border-t border-slate-200 p-3">
              <button
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-black text-next-muted"
                type="button"
                onClick={() => void logout()}
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                Cerrar sesion
              </button>
            </div>
          </section>
        </div>
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-30 hidden h-screen flex-col overflow-hidden bg-[linear-gradient(180deg,#061a2f_0%,#0b2b49_48%,#06182a_100%)] py-5 text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.08)] transition-[width,padding] duration-300 lg:flex ${
          collapsed ? "w-20 px-3" : "w-72 px-5"
        }`}
      >
        <div className={`relative border-white/10 ${collapsed ? "flex flex-col items-center gap-3 border-b pb-4" : "border-b pb-6"}`}>
          <div className={`flex items-center justify-between gap-3 ${collapsed ? "flex-col" : "block"}`}>
            <div className={`min-w-0 ${collapsed ? "flex justify-center" : "flex justify-center pt-2"}`}>
              {collapsed ? <BrandLogo variant="compact" /> : <BrandLogo variant="full" />}
            </div>
            <button
              className={`inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-white/80 transition hover:border-white/20 hover:bg-white/[0.12] hover:text-white ${
                collapsed ? "mt-0" : "absolute right-0 top-0"
              }`}
              type="button"
              onClick={onToggle}
              aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
              title={collapsed ? "Expandir menu" : "Colapsar menu"}
            >
              {collapsed ? <PanelLeftOpen className="h-4 w-4" aria-hidden="true" /> : <PanelLeftClose className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>

        <nav className={`mt-5 min-h-0 flex-1 space-y-1.5 pb-2 ${collapsed ? "overflow-visible" : "overflow-y-auto overflow-x-hidden pr-1"}`}>
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.label}
                to={item.path}
                title={item.label}
                className={({ isActive }) =>
                  [
                    "sidebar-nav-item group relative flex items-center rounded-lg text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                    collapsed ? "sidebar-nav-item-collapsed h-10 w-10 justify-center px-0" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "sidebar-nav-active bg-white/95 text-next-navy shadow-[0_10px_24px_rgba(0,0,0,0.16)] ring-1 ring-white/40"
                      : "text-white/70 hover:bg-white/[0.12] hover:text-white"
                  ].join(" ")
                }
              >
                <Icon className={`sidebar-nav-icon ${item.animClass} h-4 w-4 shrink-0`} aria-hidden="true" />
                <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
                {collapsed ? (
                  <span
                    className="sidebar-tooltip pointer-events-none absolute left-full top-1/2 z-40 ml-3 hidden whitespace-nowrap rounded-lg border border-white/20 bg-[#061a2f]/95 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_4px_20px_rgba(0,0,0,0.45)] backdrop-blur-sm lg:block"
                    aria-hidden="true"
                  >
                    {item.label}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
