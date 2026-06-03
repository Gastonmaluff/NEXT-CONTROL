import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import { navigationItems } from "../../data/navigation";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  return (
    <aside
      className={`fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-next-navy px-4 py-3 text-white transition-[width,padding] duration-300 lg:inset-y-0 lg:left-0 lg:right-auto lg:border-b-0 lg:py-6 ${
        collapsed ? "lg:w-20 lg:px-3" : "lg:w-72 lg:px-5"
      }`}
    >
      <div className={`flex items-center justify-between gap-3 ${collapsed ? "lg:flex-col" : "lg:block"}`}>
        <div className={`min-w-0 ${collapsed ? "lg:text-center" : ""}`}>
          {collapsed ? (
            <div className="hidden h-11 w-11 items-center justify-center rounded-md bg-white text-sm font-black text-next-navy lg:inline-flex">
              NG
            </div>
          ) : null}
          <div className={collapsed ? "lg:hidden" : ""}>
            <p className="truncate text-lg font-black tracking-wide">NEXT GLASS</p>
            <p className="truncate text-xs font-medium text-white/70">Vidrios y Aluminios</p>
          </div>
        </div>
        <button
          className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-white/10 text-white transition hover:bg-white/20"
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
          title={collapsed ? "Expandir menu" : "Colapsar menu"}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" aria-hidden="true" /> : <PanelLeftClose className="h-5 w-5" aria-hidden="true" />}
        </button>
        <div
          className={`rounded-full bg-white/10 px-3 py-1 text-xs font-semibold transition ${
            collapsed ? "hidden" : "hidden lg:mt-6 lg:inline-flex"
          }`}
        >
          NEXT CONTROL
        </div>
      </div>

      <nav
        className={`no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0 ${
          collapsed ? "justify-start" : ""
        }`}
      >
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                [
                  "group relative flex min-w-max items-center rounded-md text-sm font-semibold transition",
                  collapsed ? "justify-center px-3 py-2.5 lg:h-11 lg:w-11 lg:min-w-0 lg:px-0" : "gap-3 px-3 py-2.5",
                  isActive
                    ? "bg-white text-next-navy shadow-soft"
                    : "text-white/78 hover:bg-white/10 hover:text-white"
                ].join(" ")
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className={collapsed ? "sr-only lg:hidden" : ""}>{item.label}</span>
              {collapsed ? (
                <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-next-navy px-3 py-2 text-xs font-black text-white shadow-xl ring-1 ring-white/10 lg:group-hover:block">
                  {item.label}
                </span>
              ) : null}
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
