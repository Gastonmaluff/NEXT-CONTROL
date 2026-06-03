import { Outlet } from "react-router-dom";
import { useEffect, useState } from "react";
import Header from "./Header";
import Sidebar from "./Sidebar";

const SIDEBAR_STORAGE_KEY = "next-control-sidebar-collapsed";

function getInitialSidebarState() {
  if (typeof window === "undefined") {
    return false;
  }

  const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
  if (stored !== null) {
    return stored === "true";
  }

  return window.matchMedia("(max-width: 1279px)").matches;
}

export default function AppLayout() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(getInitialSidebarState);

  useEffect(() => {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  return (
    <div className="min-h-screen min-w-0 overflow-x-hidden bg-next-bg text-next-text">
      <Sidebar collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed((current) => !current)} />
      <div
        className={`min-h-screen min-w-0 transition-[padding] duration-300 ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <Header />
        <main className="mx-auto w-full max-w-none min-w-0 px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
