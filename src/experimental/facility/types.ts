export type AreaId = 'entrance' | 'administration' | 'sales' | 'control' | 'workshop' | 'raw' | 'wpc' | 'spc' | 'slats' | 'ceiling' | 'glass' | 'aluminum';
export type FacilityTargetId = AreaId | 'delivery';
export type Vec3 = [number, number, number];
export type MaterialFamily = 'wpc' | 'spc' | 'slats' | 'ceiling' | 'glass' | 'aluminum';
export interface AreaLayout { position: Vec3; size: [number, number]; }
export interface FacilityArea {
  id: AreaId; label: string; shortLabel: string; category: string; description: string;
  accent: string; route: string; action: string; module: 'control' | 'avance_obras' | 'finanzas_obras' | 'produccion' | 'inventario' | 'instalaciones' | 'proveedores';
}
export type FacilityTarget = Omit<FacilityArea, 'id'> & { id: FacilityTargetId };
export interface CameraCommand { type: 'home' | 'area' | 'zoom'; area?: AreaId; factor?: number; sequence: number; }
export interface SceneTelemetry { zoom: number; roof: number; }
