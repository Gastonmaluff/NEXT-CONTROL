import { NavLink } from "react-router-dom";
import { navigationItems } from "../../data/mockData";

export default function Sidebar() {
  return (
    <aside className="fixed inset-x-0 top-0 z-30 border-b border-white/10 bg-next-navy px-4 py-3 text-white lg:inset-y-0 lg:left-0 lg:right-auto lg:w-72 lg:border-b-0 lg:px-5 lg:py-6">
      <div className="flex items-center justify-between lg:block">
        <div>
          <p className="text-lg font-black tracking-wide">NEXT GLASS</p>
          <p className="text-xs font-medium text-white/70">Vidrios y Aluminios</p>
        </div>
        <div className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold lg:mt-6 lg:inline-flex">
          NEXT CONTROL
        </div>
      </div>

      <nav className="no-scrollbar mt-3 flex gap-2 overflow-x-auto pb-1 lg:mt-8 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0">
        {navigationItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.label}
              to={item.path}
              className={({ isActive }) =>
                [
                  "flex min-w-max items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold transition",
                  isActive
                    ? "bg-white text-next-navy shadow-soft"
                    : "text-white/78 hover:bg-white/10 hover:text-white"
                ].join(" ")
              }
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
