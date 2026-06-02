import type { UserRole } from "../types";

export const currentUserRole: UserRole = "admin";

export function canManageFinances(role: UserRole): boolean {
  return role === "admin" || role === "administracion";
}

export function canEditProduction(role: UserRole): boolean {
  return role === "admin" || role === "produccion";
}

export function canUploadInstallationPhotos(role: UserRole): boolean {
  return role === "admin" || role === "instalador";
}

export function canManageSettings(role: UserRole): boolean {
  return role === "admin";
}
