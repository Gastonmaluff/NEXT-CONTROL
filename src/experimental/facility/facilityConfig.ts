import type { AreaId, AreaLayout, Vec3 } from './types';

// Units are illustrative metres, not a survey. +Z = front/entrance; -Z = rear.
// All site layout changes belong here. Detail offsets are local to each asset.
export const facilityConfig = {
  site: { width: 48, depth: 60, center: [0, 0, 5] as Vec3 },
  building: { width: 36, depth: 40, wallHeight: 7, ridgeHeight: 8.8, columnSpacing: 8 },
  camera: {
    position: [25, 36, 45] as Vec3, target: [0, 0, 4] as Vec3,
    fitWidth: 102, fitHeight: 84, minZoom: 0.88, maxZoom: 3.4, focusZoom: 2.25,
    minPolar: Math.PI / 5, maxPolar: Math.PI / 3,
    minAzimuth: 0.05, maxAzimuth: 0.85,
    panX: 16, panZ: 28, smoothing: 5,
  },
  roof: { fadeStart: 1.08, fadeEnd: 1.85, smoothing: 7 },
  palette: {
    ground: '#e6edf2', concrete: '#f7f9fb', roof: '#638098', steel: '#37546b',
    wall: '#dbe5ed', glass: '#9bc8d8', aisle: '#dfe7ee', wood: '#b79470',
    aluminum: '#b8c8d4', rack: '#536a7b', blue: '#2878ba', green: '#23957e',
  },
  areas: {
    entrance: { position: [0, 0, 25], size: [32, 9] },
    administration: { position: [11.5, 0, 14], size: [11, 10] },
    sales: { position: [8.5, 0, 6], size: [5, 5] },
    control: { position: [14.5, 0, 6], size: [5, 5] },
    workshop: { position: [11, 0, -5], size: [12, 15] },
    raw: { position: [-1.5, 0, -5], size: [8, 15] },
    wpc: { position: [-13, 0, 13], size: [7, 5] },
    spc: { position: [-13, 0, 5.5], size: [7, 5] },
    slats: { position: [-13, 0, -2], size: [7, 5] },
    ceiling: { position: [-13, 0, -9.5], size: [7, 5] },
    glass: { position: [-8, 0, -17], size: [16, 4] },
    aluminum: { position: [10, 0, -17], size: [14, 4] },
  } satisfies Record<AreaId, AreaLayout>,
  offices: [
    { id: 'administration' as const, desks: [[-3, 0, -1], [2.5, 0, -1], [-3, 0, 2]] as Vec3[], door: { wall: 'left' as const, offset: 2.8, width: 1.35 } },
    { id: 'sales' as const, desks: [[0, 0, 0]] as Vec3[], door: { wall: 'left' as const, offset: 1.4, width: 1.3 } },
    { id: 'control' as const, desks: [[0, 0, -0.4]] as Vec3[], door: { wall: 'front' as const, offset: 0, width: 1.3 } },
  ],
  workshop: {
    tables: [[-2.8, 0, -3], [2.8, 0, -3], [2.8, 0, 2]] as Vec3[],
    cutter: [-2.7, 0, 3] as Vec3, glassStand: [3.2, 0, -6] as Vec3,
  },
  raw: { stands: [[-2, 0, -3], [2, 0, -3]] as Vec3[], profiles: [0, 0, 3] as Vec3 },
  rack: { height: 4.6, levels: [0.65, 2, 3.35], depth: 1.8, rows: [-1.2, 1.2] },
  vehicles: [
    { id: 'delivery', position: [-52, 0, 31] as Vec3, rotation: Math.PI / 2, kind: 'truck' as const, color: '#2571ad' },
    { id: 'service', position: [52, 0, 31] as Vec3, rotation: -Math.PI / 2, kind: 'van' as const, color: '#e8edf1' },
  ],
  workers: [
    { id: 'cutting', position: [6.8, 0, -1] as Vec3, rotation: 0.4, color: '#377ead' },
    { id: 'assembly', position: [14, 0, -6] as Vec3, rotation: Math.PI, color: '#377ead' },
    { id: 'supply', position: [7.1, 0, 0.4] as Vec3, rotation: Math.PI, color: '#44877e' },
    { id: 'richard', position: [3.1, 0, 22] as Vec3, rotation: Math.PI, color: '#344e68' },
    { id: 'glass-handler', position: [-6.6, 0, 2.2] as Vec3, rotation: Math.PI / 2, color: '#4c8a99' },
    { id: 'cargo-handler', position: [-9, 0, 17.8] as Vec3, rotation: -Math.PI / 2, color: '#52778f' },
    { id: 'window-loader-a', position: [9.4, 0, 26] as Vec3, rotation: 0, color: '#377ead' },
    { id: 'window-loader-b', position: [9.4, 0, 27.5] as Vec3, rotation: 0, color: '#44877e' },
  ],
} as const;

export function fitZoom(width: number, height: number) {
  return Math.max(1, Math.min(width / facilityConfig.camera.fitWidth, height / facilityConfig.camera.fitHeight));
}
export function roofOpacity(zoomRatio: number) {
  const { fadeStart, fadeEnd } = facilityConfig.roof;
  const t = Math.min(1, Math.max(0, (zoomRatio - fadeStart) / (fadeEnd - fadeStart)));
  return 1 - t * t * (3 - 2 * t);
}
