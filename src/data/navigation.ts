import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Calculator,
  ClipboardCheck,
  Factory,
  FileSpreadsheet,
  LayoutDashboard,
  Receipt,
  Settings,
  Truck,
  Users
} from "lucide-react";

export const navigationItems = [
  { label: "Control", path: "/control", icon: LayoutDashboard },
  { label: "Avance de obras", path: "/avance-obras", icon: ClipboardCheck },
  { label: "Finanzas de obras", path: "/finanzas-obras", icon: Calculator },
  { label: "Clientes", path: "/clientes", icon: Users },
  { label: "Presupuestos", path: "/presupuestos", icon: FileSpreadsheet },
  { label: "Produccion", path: "/produccion", icon: Factory },
  { label: "Instalaciones", path: "/instalaciones/mobile", icon: Truck },
  { label: "Cobros", path: "/cobros", icon: Receipt },
  { label: "Proveedores", path: "/proveedores", icon: BriefcaseBusiness },
  { label: "Inventario", path: "/inventario", icon: Boxes },
  { label: "Reportes", path: "/reportes", icon: BarChart3 },
  { label: "Configuracion", path: "/configuracion", icon: Settings }
];
