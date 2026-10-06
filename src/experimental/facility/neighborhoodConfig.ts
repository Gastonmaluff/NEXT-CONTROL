import type { Vec3 } from './types';

// Scenery only: outside the depot lot, without areas, business data or cutaway roofs.
export interface NeighborBuilding {
  id: string;
  position: Vec3;
  width: number;
  depth: number;
  height: number;
  roof: 'pitched' | 'flat';
  wallColor: string;
  roofColor: string;
  frontage: 'street' | 'rear';
  plot: { position: Vec3; width: number; depth: number };
}
export const neighborhoodConfig: readonly NeighborBuilding[] = [
  // One deep property on each side, sharing the depot's street/front building line.
  { id: 'left', position: [-31, 0, 0], width: 13.4, depth: 40, height: 4.2, roof: 'pitched', wallColor: '#d5d2ca', roofColor: '#aa9990', frontage: 'street', plot: { position: [-31, 0, 1], width: 14, depth: 52 } },
  { id: 'right', position: [31, 0, 0], width: 13.4, depth: 40, height: 3.8, roof: 'flat', wallColor: '#ded9cf', roofColor: '#a1adb3', frontage: 'street', plot: { position: [31, 0, 1], width: 14, depth: 52 } },
  // Only the backs of the rear properties face the depot: no imaginary internal access road.
  { id: 'rear-left', position: [-12, 0, -32], width: 23, depth: 12, height: 4.1, roof: 'pitched', wallColor: '#d8d4cc', roofColor: '#a6a198', frontage: 'rear', plot: { position: [-12, 0, -32], width: 24, depth: 14 } },
  { id: 'rear-right', position: [12, 0, -32], width: 23, depth: 12, height: 3.6, roof: 'flat', wallColor: '#cdd5db', roofColor: '#97a6b0', frontage: 'rear', plot: { position: [12, 0, -32], width: 24, depth: 14 } },
];
export const neighborhoodStreet = { position: [0, 0.095, 31] as Vec3, width: 220, depth: 8 };
