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
  UserCog,
  Users
} from "lucide-react";

export const navigationItems = [
  { label: "Control",         path: "/control",             icon: LayoutDashboard,  animClass: "icon-control"       },
  { label: "Avance de obras", path: "/avance-obras",        icon: ClipboardCheck,   animClass: "icon-avance"        },
  { label: "Finanzas de obras",path: "/finanzas-obras",     icon: Calculator,       animClass: "icon-finanzas"      },
  { label: "Clientes",        path: "/clientes",            icon: Users,            animClass: "icon-clientes"      },
  { label: "Proveedores",     path: "/proveedores",         icon: BriefcaseBusiness,animClass: "icon-proveedores"   },
  { label: "Presupuestos",    path: "/presupuestos",        icon: FileSpreadsheet,  animClass: "icon-presupuestos"  },
  { label: "Produccion",      path: "/produccion",          icon: Factory,          animClass: "icon-produccion"    },
  { label: "Instalaciones",   path: "/instalaciones/mobile",icon: Truck,            animClass: "icon-instalaciones" },
  { label: "Cobros",          path: "/cobros",              icon: Receipt,          animClass: "icon-cobros"        },
  { label: "Inventario",      path: "/inventario",          icon: Boxes,            animClass: "icon-inventario"    },
  { label: "Reportes",        path: "/reportes",            icon: BarChart3,        animClass: "icon-reportes"      },
  { label: "Configuracion",   path: "/configuracion",       icon: Settings,         animClass: "icon-settings"      },
  { label: "Usuarios",        path: "/usuarios",            icon: UserCog,          animClass: "icon-usuarios", adminOnly: true }
];
