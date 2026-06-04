import type { UserRole } from "../types";

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
  return role === "admin" || role === "gerencia" || role === "produccion" || role === "supervisor";
}

export function canUploadInstallationPhotos(role: UserRole): boolean {
  return role === "admin" || role === "gerencia" || role === "instalador" || role === "supervisor" || role === "fiscalizador" || role === "encargado";
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
