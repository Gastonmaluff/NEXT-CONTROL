import type { SystemUser, UserRole } from "../types";

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
  return role === "admin" || role === "gerencia" || role === "produccion" || role === "fiscalizador" || role === "supervisor";
}

export function canUploadInstallationPhotos(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "instalador" || role === "equipo_campo" || role === "supervisor" || role === "fiscalizador" || role === "encargado";
}

export function canManageSettings(role: UserRole): boolean {
  return role === "admin" || role === "gerencia";
}

export function canViewAllWorks(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "administracion";
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
  return Boolean(user?.active && ["admin", "gerencia", "fiscalizador", "supervisor", "encargado", "instalador", "equipo_campo"].includes(user.role));
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
  return Boolean(user?.active && ["fiscalizador", "supervisor", "encargado", "equipo_campo", "instalador"].includes(user.role));
}

export function canStartWorkDay(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["equipo_campo", "instalador", "admin", "gerencia"].includes(user.role));
}

export function canUploadTaskPhotos(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["equipo_campo", "instalador", "fiscalizador", "supervisor", "encargado", "admin", "gerencia"].includes(user.role));
}

export function canValidateTaskProgress(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia", "fiscalizador", "supervisor"].includes(user.role));
}

export function canViewFieldMap(user?: Pick<SystemUser, "role" | "active"> | null): boolean {
  return Boolean(user?.active && ["admin", "gerencia", "fiscalizador", "supervisor"].includes(user.role));
}
