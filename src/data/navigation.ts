import {
  BarChart3,
  Boxes,
  BriefcaseBusiness,
  Calculator,
  ClipboardList,
  ClipboardCheck,
  Factory,
  FileSpreadsheet,
  LayoutDashboard,
  Landmark,
  Settings,
  Truck,
  UserCog,
  Users
} from "lucide-react";
import type { SystemModuleName } from "../types";

export const navigationItems: Array<{
  label: string;
  path: string;
  icon: typeof LayoutDashboard;
  animClass: string;
  moduleName: SystemModuleName;
  adminOnly?: boolean;
}> = [
  { label: "Control",         path: "/control",             icon: LayoutDashboard,  animClass: "icon-control",       moduleName: "control" },
  { label: "Avance de obras", path: "/avance-obras",        icon: ClipboardCheck,   animClass: "icon-avance",        moduleName: "avance_obras" },
  { label: "Finanzas de obras",path: "/finanzas-obras",     icon: Calculator,       animClass: "icon-finanzas",      moduleName: "finanzas_obras" },
  { label: "Clientes",        path: "/clientes",            icon: Users,            animClass: "icon-clientes",      moduleName: "clientes" },
  { label: "Proveedores",     path: "/proveedores",         icon: BriefcaseBusiness,animClass: "icon-proveedores",   moduleName: "proveedores" },
  { label: "Cheques",         path: "/cheques",             icon: Landmark,         animClass: "icon-cobros",        moduleName: "cheques" },
  { label: "Tareas",          path: "/tareas",              icon: ClipboardList,    animClass: "icon-avance",        moduleName: "tareas" },
  { label: "Instalaciones",   path: "/instalaciones",       icon: Truck,            animClass: "icon-instalaciones", moduleName: "instalaciones" },
  { label: "Presupuestos",    path: "/presupuestos",        icon: FileSpreadsheet,  animClass: "icon-presupuestos",  moduleName: "presupuestos" },
  { label: "Produccion",      path: "/produccion",          icon: Factory,          animClass: "icon-produccion",    moduleName: "produccion" },
  { label: "Inventario",      path: "/inventario",          icon: Boxes,            animClass: "icon-inventario",    moduleName: "inventario" },
  { label: "Reportes",        path: "/reportes",            icon: BarChart3,        animClass: "icon-reportes",      moduleName: "reportes" },
  { label: "Configuracion",   path: "/configuracion",       icon: Settings,         animClass: "icon-settings",      moduleName: "configuracion" },
  { label: "Usuarios",        path: "/usuarios",            icon: UserCog,          animClass: "icon-usuarios",      moduleName: "usuarios", adminOnly: true }
];
