import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Building2,
  Factory,
  FileSpreadsheet,
  Home,
  Receipt,
  Settings,
  Truck,
  Users
} from "lucide-react";

export const navigationItems = [
  { label: "Dashboard", path: "/", icon: Home },
  { label: "Obras", path: "/obras", icon: Building2 },
  { label: "CRM de obras", path: "/crm", icon: BriefcaseBusiness },
  { label: "Presupuestos", path: "/presupuestos", icon: FileSpreadsheet },
  { label: "Produccion", path: "/produccion", icon: Factory },
  { label: "Instalaciones", path: "/instalaciones/mobile", icon: Truck },
  { label: "Cobros", path: "/cobros", icon: Receipt },
  { label: "Proveedores", path: "/proveedores", icon: Users },
  { label: "Inventario", path: "/inventario", icon: Boxes },
  { label: "Reportes", path: "/reportes", icon: BarChart3 },
  { label: "Configuracion", path: "/configuracion", icon: Settings }
];
