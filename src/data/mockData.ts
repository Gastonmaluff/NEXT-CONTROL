import {
  BarChart3,
  Bell,
  Boxes,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ClipboardList,
  Factory,
  FileSpreadsheet,
  Home,
  PackageSearch,
  Receipt,
  Settings,
  Truck,
  Users
} from "lucide-react";
import type { WeightedProgressItem } from "../utils/progress";

export type BadgeStatus =
  | "success"
  | "warning"
  | "critical"
  | "info"
  | "neutral";

export const navigationItems = [
  { label: "Dashboard", path: "/", icon: Home },
  { label: "Obras", path: "/obras", icon: Building2 },
  { label: "CRM de obras", path: "/crm", icon: BriefcaseBusiness },
  { label: "Presupuestos", path: "/presupuestos", icon: FileSpreadsheet },
  { label: "Producción", path: "/produccion", icon: Factory },
  { label: "Instalaciones", path: "/instalaciones/mobile", icon: Truck },
  { label: "Cobros", path: "/cobros", icon: Receipt },
  { label: "Proveedores", path: "/proveedores", icon: Users },
  { label: "Inventario", path: "/inventario", icon: Boxes },
  { label: "Reportes", path: "/reportes", icon: BarChart3 },
  { label: "Configuración", path: "/configuracion", icon: Settings }
];

export const dashboardKpis = [
  { label: "Ventas del mes", value: "₲ 1.245.680.000", icon: Receipt, tone: "blue" },
  { label: "Cobrado del mes", value: "₲ 892.350.000", icon: Bell, tone: "green" },
  { label: "Cuentas por cobrar", value: "₲ 1.128.900.000", icon: CalendarClock, tone: "orange" },
  { label: "Flujo proyectado 30 días", value: "₲ 1.672.500.000", icon: BarChart3, tone: "blue" },
  { label: "Obras atrasadas", value: "3", icon: ClipboardList, tone: "red" },
  { label: "Producción pendiente", value: "₲ 487.600.000", icon: Factory, tone: "orange" },
  { label: "M² instalados esta semana", value: "0 m²", icon: Truck, tone: "green" },
  { label: "Utilidad estimada", value: "₲ 373.850.000", icon: PackageSearch, tone: "green" }
];

export const cashflowBars = [
  { label: "Sem 1", value: 52, amount: "₲ 286M" },
  { label: "Sem 2", value: 74, amount: "₲ 412M" },
  { label: "Sem 3", value: 61, amount: "₲ 338M" },
  { label: "Sem 4", value: 88, amount: "₲ 497M" },
  { label: "+30", value: 69, amount: "₲ 381M" }
];

export const worksByStatus = [
  { label: "En ejecución", value: 12, percent: 82, status: "info" as BadgeStatus },
  { label: "En fabricación", value: 8, percent: 58, status: "neutral" as BadgeStatus },
  { label: "Por iniciar", value: 5, percent: 36, status: "warning" as BadgeStatus },
  { label: "Atrasadas", value: 3, percent: 22, status: "critical" as BadgeStatus },
  { label: "Finalizadas", value: 15, percent: 92, status: "success" as BadgeStatus }
];

export const criticalWorks = [
  {
    project: "Palmanova",
    client: "Inversora del Este S.A.",
    status: "Atrasada",
    days: "5 días",
    badge: "critical" as BadgeStatus
  },
  {
    project: "Katuete",
    client: "Grupo Katuete",
    status: "En ejecución",
    days: "2 días",
    badge: "info" as BadgeStatus
  },
  {
    project: "Edificio Aurora",
    client: "Aurora Desarrollos",
    status: "En fabricación",
    days: "1 día",
    badge: "warning" as BadgeStatus
  }
];

export const dueDates = [
  { title: "Anticipo Torre Norte", date: "04 Jun", amount: "₲ 126.000.000" },
  { title: "Certificado Palmanova", date: "09 Jun", amount: "₲ 215.680.000" },
  { title: "Saldo Casa Atlas", date: "14 Jun", amount: "₲ 48.900.000" }
];

export const activeCrews = [
  { crew: "Cuadrilla A", project: "Edificio Aurora", progress: "Nivel 2" },
  { crew: "Cuadrilla B", project: "Palmanova", progress: "Fachada norte" },
  { crew: "Cuadrilla C", project: "Katuete", progress: "Sector acceso" }
];

export const crmKpis = [
  { label: "Leads activos", value: "124", icon: Users, tone: "blue" },
  { label: "Presupuestos enviados", value: "48", icon: FileSpreadsheet, tone: "orange" },
  { label: "Tasa de conversión", value: "27,3%", icon: BarChart3, tone: "green" },
  { label: "Ventas estimadas", value: "₲ 2.145.300.000", icon: Receipt, tone: "blue" }
];

export const pipeline = [
  {
    title: "Prospecto",
    opportunities: [
      {
        project: "Residencias Palmanova",
        client: "Inversora del Este S.A.",
        amount: "₲ 1.245.680.000",
        followUp: "05 Jun 2026",
        priority: "Alta" as const
      },
      {
        project: "Casa Atlas",
        client: "Atlas Propiedades",
        amount: "₲ 148.400.000",
        followUp: "06 Jun 2026",
        priority: "Media" as const
      }
    ]
  },
  {
    title: "Presupuesto enviado",
    opportunities: [
      {
        project: "Torre Aurora",
        client: "Aurora Desarrollos",
        amount: "₲ 824.900.000",
        followUp: "07 Jun 2026",
        priority: "Alta" as const
      },
      {
        project: "Edificio Vista Sur",
        client: "Vista Sur S.A.",
        amount: "₲ 516.000.000",
        followUp: "10 Jun 2026",
        priority: "Media" as const
      }
    ]
  },
  {
    title: "Seguimiento",
    opportunities: [
      {
        project: "Katuete Residencial",
        client: "Grupo Katuete",
        amount: "₲ 690.300.000",
        followUp: "08 Jun 2026",
        priority: "Alta" as const
      }
    ]
  },
  {
    title: "Aprobado",
    opportunities: [
      {
        project: "Costanera View",
        client: "Costanera Real Estate",
        amount: "₲ 1.010.500.000",
        followUp: "11 Jun 2026",
        priority: "Media" as const
      }
    ]
  },
  {
    title: "Perdido",
    opportunities: [
      {
        project: "Torres del Norte",
        client: "Norte Capital",
        amount: "₲ 438.700.000",
        followUp: "12 Jun 2026",
        priority: "Baja" as const
      }
    ]
  }
];

export const followUpAgenda = [
  { time: "09:00", title: "Llamar a Aurora Desarrollos" },
  { time: "11:30", title: "Enviar ajuste de presupuesto Palmanova" },
  { time: "15:00", title: "Reunión con Grupo Katuete" }
];

export const salesAdvisors = [
  { name: "Sofía Ramos", deals: 18, value: "₲ 820M" },
  { name: "Diego Ferreira", deals: 14, value: "₲ 642M" },
  { name: "Marta López", deals: 11, value: "₲ 510M" }
];

export const projectProgressItems: (WeightedProgressItem & {
  label: string;
})[] = [
  { label: "Carpintería", weight: 40, progress: 100 },
  { label: "Vidrios", weight: 30, progress: 80 },
  { label: "Contramarcos", weight: 20, progress: 50 },
  { label: "Sellado", weight: 10, progress: 20 }
];

export const productionChecklist = [
  { label: "Medición", status: "Completado" as const },
  { label: "Planos", status: "Completado" as const },
  { label: "Compra aluminio", status: "Completado" as const },
  { label: "Compra vidrio", status: "En proceso" as const },
  { label: "Corte", status: "Pendiente" as const },
  { label: "Armado", status: "Pendiente" as const },
  { label: "Vidriado", status: "Pendiente" as const },
  { label: "Embalaje", status: "Pendiente" as const }
];

export const missingMaterials = [
  { item: "DVH 8+12+8", quantity: "32 m²" },
  { item: "Cerraduras multipunto", quantity: "4 unidades" },
  { item: "Perfil línea A30", quantity: "120 metros" }
];

export const recentActivity = [
  "Instalación de paño fijo en fachada norte.",
  "Sellado perimetral en carpintería del piso 5.",
  "Recepción de vidrios DVH 8+12+8.",
  "Revisión de planos de detalles de contramarcos."
];

export const mobileTasks = [
  "Instalación de mamparas - Nivel 2",
  "Colocación de vidrios fijos - Sector A",
  "Instalación de puertas - Sector B",
  "Sellado y silicona - Fachada principal"
];

export const mobileTimeline = [
  { time: "08:02", event: "Inicié jornada" },
  { time: "11:15", event: "Instalación de mamparas completada" },
  { time: "14:40", event: "Se cargaron 6 fotos" },
  { time: "17:14", event: "Jornada finalizada" }
];

