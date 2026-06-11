import type { SystemModuleName, SystemPermissionName, SystemUser, UserRole } from "../types";

export const currentUserRole: UserRole = "admin";
export const currentUser = {
  id: "demo-admin",
  name: "Richard",
  role: currentUserRole
};

export function canManageFinances(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "administracion";
}

export function canEditProduction(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "produccion" || role === "taller" || role === "fiscalizador" || role === "supervisor";
}

export function canUploadInstallationPhotos(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "instalador" || role === "equipo_campo" || role === "supervisor" || role === "fiscalizador" || role === "encargado";
}

export function canManageSettings(role: UserRole): boolean {
  return role === "admin" || role === "gerencia";
}

export function canViewAllWorks(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "administracion" || role === "produccion" || role === "taller";
}

export function canConfigureProgress(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "administracion";
}

export function canRegisterProgress(role: UserRole): boolean {
  return ["admin", "gerencia", "supervisor", "fiscalizador", "encargado"].includes(role);
}

export function canCorrectProgress(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "supervisor";
}

export function canAssignCrew(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "supervisor";
}

export function isAdmin(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active) && user?.role === "admin";
}

export function canManageUsers(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active) && (user?.role === "admin" || user?.role === "gerencia");
}

export function canCreateWork(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia", "administracion"].includes(user.role));
}

export function canViewAllWorksForUser(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && canViewAllWorks(user.role));
}

export function canManageFinancesForUser(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && canManageFinances(user.role));
}

export function canConfigureProgressForUser(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && canConfigureProgress(user.role));
}

export function canRegisterProgressForUser(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && canRegisterProgress(user.role));
}

export function canManageInstallation(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia", "fiscalizador", "supervisor", "encargado", "instalador", "equipo_campo", "campo"].includes(user.role));
}

export function canCreateTasks(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia", "fiscalizador", "supervisor"].includes(user.role));
}

export function canAssignTasks(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia", "fiscalizador", "supervisor"].includes(user.role));
}

export function canViewAllTasks(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia"].includes(user.role));
}

export function canViewAssignedTasks(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["fiscalizador", "supervisor", "encargado", "equipo_campo", "campo", "instalador"].includes(user.role));
}

export function canStartWorkDay(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["equipo_campo", "campo", "instalador", "admin", "gerencia"].includes(user.role));
}

export function canUploadTaskPhotos(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["equipo_campo", "campo", "instalador", "fiscalizador", "supervisor", "encargado", "admin", "gerencia"].includes(user.role));
}

export function canValidateTaskProgress(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia", "fiscalizador", "supervisor"].includes(user.role));
}

export function canViewFieldMap(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia", "fiscalizador", "supervisor"].includes(user.role));
}

export function canAssignFieldWork(user?: Pick<SystemUser, "role" | "active" | "permissions"> | null): boolean {
  return canPerform(user, "canAssignFieldWork");
}

export function canValidateProgress(user?: Pick<SystemUser, "role" | "active" | "permissions"> | null): boolean {
  return canPerform(user, "canValidateProgress");
}

export function canEditProgress(user?: Pick<SystemUser, "role" | "active" | "permissions"> | null): boolean {
  return canPerform(user, "canEditProgress");
}

export function canViewFinancials(user?: Pick<SystemUser, "role" | "active" | "permissions"> | null): boolean {
  return canPerform(user, "canViewFinancials");
}

export function canUpdateProduction(user?: Pick<SystemUser, "role" | "active" | "permissions"> | null): boolean {
  return canPerform(user, "canUpdateProduction");
}

export function canPerform(
  user: Pick<SystemUser, "role" | "active" | "permissions"> | null | undefined,
  permission: SystemPermissionName
): boolean {
  if (!user?.active) return false;
  const explicit = user.permissions?.[permission];
  if (explicit !== undefined) return explicit;
  return Boolean(defaultPermissionsByRole[user.role]?.[permission]);
}

export function canViewModule(
  user: Pick<SystemUser, "role" | "active" | "modules"> | null | undefined,
  moduleName: SystemModuleName
): boolean {
  if (!user?.active) return false;
  const explicit = user.modules?.[moduleName]?.view;
  if (explicit !== undefined) return explicit;
  return Boolean(defaultModulesByRole[user.role]?.includes(moduleName));
}

export function getOperationalPathByRole(role?: UserRole): string | null {
  if (!role) return null;
  if (role === "fiscalizador" || role === "supervisor") return "/fiscalizador";
  if (role === "campo" || role === "equipo_campo" || role === "instalador") return "/campo";
  if (role === "taller" || role === "produccion") return "/taller";
  if (role === "admin" || role === "gerencia" || role === "administracion" || role === "solo_lectura") return "/control";
  return "/control";
}

export function getOperationalUrlForUser(user: Pick<SystemUser, "role" | "operationalPath">, origin?: string): string | null {
  const path = user.operationalPath || getOperationalPathByRole(user.role);
  if (!path) return null;
  const base = origin || (typeof window !== "undefined" ? window.location.origin : "");
  return `${base}${path}`;
}

const defaultPermissionsByRole: Record<UserRole, Partial<Record<SystemPermissionName, boolean>>> = {
  admin: {
    canAssignFieldWork: true,
    canCreateTasks: true,
    canValidateProgress: true,
    canEditProgress: true,
    canViewFinancials: true,
    canManageUsers: true,
    canUpdateProduction: true
  },
  gerencia: {
    canAssignFieldWork: true,
    canCreateTasks: true,
    canValidateProgress: true,
    canEditProgress: true,
    canViewFinancials: true,
    canManageUsers: true,
    canUpdateProduction: true
  },
  administracion: {
    canViewFinancials: true
  },
  fiscalizador: {
    canAssignFieldWork: true,
    canCreateTasks: true,
    canValidateProgress: true,
    canEditProgress: true
  },
  supervisor: {
    canAssignFieldWork: true,
    canCreateTasks: true,
    canValidateProgress: true,
    canEditProgress: true
  },
  encargado: {
    canCreateTasks: true,
    canEditProgress: true
  },
  equipo_campo: {},
  campo: {},
  instalador: {},
  produccion: {
    canUpdateProduction: true
  },
  taller: {
    canUpdateProduction: true
  },
  solo_lectura: {}
};

const defaultModulesByRole: Record<UserRole, SystemModuleName[]> = {
  admin: [
    "control", "avance_obras", "finanzas_obras", "clientes", "proveedores", "cheques",
    "tareas", "instalaciones", "presupuestos", "produccion", "taller", "inventario",
    "reportes", "configuracion", "usuarios"
  ],
  gerencia: [
    "control", "avance_obras", "finanzas_obras", "clientes", "proveedores", "cheques",
    "tareas", "instalaciones", "presupuestos", "produccion", "inventario", "reportes",
    "configuracion", "usuarios"
  ],
  administracion: ["control", "finanzas_obras", "clientes", "proveedores", "cheques", "reportes"],
  fiscalizador: ["control", "avance_obras", "tareas", "instalaciones", "produccion"],
  supervisor: ["control", "avance_obras", "tareas", "instalaciones", "produccion"],
  encargado: ["control", "avance_obras", "tareas", "instalaciones"],
  equipo_campo: ["tareas", "instalaciones"],
  campo: ["tareas", "instalaciones"],
  instalador: ["tareas", "instalaciones"],
  produccion: ["produccion", "taller"],
  taller: ["taller", "produccion"],
  solo_lectura: ["control", "avance_obras"]
};
