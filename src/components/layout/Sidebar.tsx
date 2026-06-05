import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { NavLink } from "react-router-dom";
import BrandLogo from "../brand/BrandLogo";
import { navigationItems } from "../../data/navigation";
import { useAuth } from "../../context/AuthContext";
import { canManageUsers } from "../../lib/roles";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

export default function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const { profile } = useAuth();
  const items = navigationItems.filter((item) => !("adminOnly" in item) || !item.adminOnly || canManageUsers(profile));

  return (
    <aside
      className={`fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-[linear-gradient(180deg,#061a2f_0%,#0b2b49_48%,#06182a_100%)] px-4 py-3 text-white shadow-[inset_-1px_0_0_rgba(255,255,255,0.08)] transition-[width,padding] duration-300 lg:inset-y-0 lg:left-0 lg:right-auto lg:border-b-0 lg:py-5 ${
        collapsed ? "lg:w-20 lg:px-3" : "lg:w-72 lg:px-5"
      }`}
    >
      <div
        className={`relative border-white/10 ${
          collapsed ? "lg:flex lg:flex-col lg:items-center lg:gap-3 lg:border-b lg:pb-4" : "lg:border-b lg:pb-6"
        }`}
      >
        <div className={`flex items-center justify-between gap-3 ${collapsed ? "lg:flex-col" : "lg:block"}`}>
          <div className={`min-w-0 ${collapsed ? "lg:flex lg:justify-center" : "lg:flex lg:justify-center lg:pt-2"}`}>
            <BrandLogo variant="compact" className="lg:hidden" />
            {collapsed ? <BrandLogo variant="compact" className="hidden lg:inline-flex" /> : null}
            <BrandLogo variant="full" className={collapsed ? "hidden" : "hidden lg:inline-flex"} />
          </div>
          <button
            className={`inline-flex h-9 w-9 items-center justify-center rounded-md border border-white/10 bg-white/[0.06] text-white/80 transition hover:border-white/20 hover:bg-white/[0.12] hover:text-white ${
              collapsed ? "lg:mt-0" : "lg:absolute lg:right-0 lg:top-0"
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

      <nav
        className={`no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-5 lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0 ${
          collapsed ? "justify-start" : ""
        }`}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.path}
              title={item.label}
              className={({ isActive }) =>
                [
                  "sidebar-nav-item group relative flex min-w-max items-center rounded-lg text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-white/60",
                  collapsed
                    ? "sidebar-nav-item-collapsed justify-center px-3 py-2.5 lg:h-10 lg:w-10 lg:min-w-0 lg:px-0"
                    : "gap-3 px-3 py-2.5",
                  isActive
                    ? "sidebar-nav-active bg-white/95 text-next-navy shadow-[0_10px_24px_rgba(0,0,0,0.16)] ring-1 ring-white/40"
                    : "text-white/70 hover:bg-white/[0.12] hover:text-white"
                ].join(" ")
              }
            >
              <Icon className={`sidebar-nav-icon ${item.animClass} h-4 w-4 shrink-0`} aria-hidden="true" />
              <span className={collapsed ? "sr-only lg:hidden" : ""}>{item.label}</span>
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
  );
}
