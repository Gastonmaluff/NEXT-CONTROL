import type { ActivityKeyframe, ActivityRoute } from './activityMotion';
import type { Vec3 } from './types';

// Join closed routes without duplicate timestamps or a jump at the seam.
function patrolWithBreaks(patrol: ActivityRoute, rest: ActivityRoute, laps: readonly number[]): ActivityRoute {
  const frames: ActivityKeyframe[] = [];
  let elapsed = 0;
  const append = (route: ActivityRoute) => {
    if (frames.length) frames.pop();
    for (const frame of route.frames) frames.push({ ...frame, at: elapsed + frame.at });
    elapsed += route.duration;
  };
  for (const count of laps) {
    for (let i = 0; i < count; i++) append(patrol);
    append(rest);
  }
  return { duration: elapsed, frames };
}

const richardPatrol: ActivityRoute = {
  duration: 105,
  frames: [
    { at: 0, position: [3.1, 0, 22] },
    { at: 12, position: [3.1, 0, 12] },
    { at: 22, position: [3.1, 0, 2.8] },
    { at: 39, position: [3.1, 0, -13.8] },
    { at: 49, position: [-7.2, 0, -13.8] },
    { at: 64, position: [-7.2, 0, 0] },
    { at: 81, position: [-7.2, 0, 17] },
    { at: 89, position: [-7.2, 0, 23] },
    { at: 103, position: [3.1, 0, 23] },
    { at: 105, position: [3.1, 0, 22] },
  ],
};
const richardBreak: ActivityRoute = {
  duration: 88,
  frames: [
    { at: 0, position: [3.1, 0, 22] },
    { at: 12, position: [-7.2, 0, 23] },
    { at: 23, position: [-17.25, 0, 23] },
    { at: 27, position: [-17.25, 0, 20.6], heading: 0 },
    { at: 30, position: [-17.25, 0, 20.6], pose: 'smoke', heading: 0 },
    { at: 54, position: [-17.25, 0, 20.6], heading: 0 },
    { at: 57, position: [-17.25, 0, 20.6] },
    { at: 62, position: [-17.25, 0, 23] },
    { at: 74, position: [-7.2, 0, 23] },
    { at: 86, position: [3.1, 0, 23] },
    { at: 88, position: [3.1, 0, 22] },
  ],
};

// Illustrative choreography, not a physical / stock simulation. Routes use real
// aisle coordinates, never straight-line shortcuts through offices or racks.
export const activityConfig = {
  richardRoutine: { patrol: richardPatrol, rest: richardBreak, laps: [2, 3] },
  logisticsDuration: 112,
  cartParking: {
    'glass-handler': { position: [-6.6, 0, 2.2] as Vec3, heading: Math.PI / 2 },
    'cargo-handler': { position: [-9, 0, 17.8] as Vec3, heading: -Math.PI / 2 },
  },
  shipment: { duration: 112, arrival: 16, glassPickup: 32, boxesPickup: 36, glassDelivered: 54, boxesDelivered: 56, departure: 60 },
  dispatch: { duration: 156, arrival: 16, firstPickup: 62, secondPickup: 66, firstLoaded: 100, secondLoaded: 104, firstBoarded: 110, secondBoarded: 112, departure: 116 },
  finishedWindows: [8, 0.15, -11.5] as Vec3,
  truck: {
    duration: 112,
    frames: [
      { at: 0, position: [-52, 0, 31], heading: Math.PI / 2 },
      { at: 10, position: [-7, 0, 31] },
      { at: 16, position: [-7, 0, 26], heading: Math.PI / 2 },
      { at: 60, position: [-7, 0, 26], heading: Math.PI / 2 },
      { at: 66, position: [-7, 0, 31] },
      { at: 82, position: [52, 0, 31] },
      { at: 88, position: [52, 0, 45] },
      { at: 102, position: [-52, 0, 45] },
      { at: 106, position: [-52, 0, 31] },
      { at: 112, position: [-52, 0, 31] },
    ],
  } satisfies ActivityRoute,
  serviceTruck: {
    duration: 156,
    frames: [
      { at: 0, position: [52, 0, 31], heading: -Math.PI / 2 },
      { at: 10, position: [13, 0, 31] },
      { at: 16, position: [13, 0, 26], heading: Math.PI / 2 },
      { at: 116, position: [13, 0, 26], heading: Math.PI / 2 },
      { at: 122, position: [13, 0, 31] },
      { at: 138, position: [52, 0, 31] },
      { at: 156, position: [52, 0, 31] },
    ],
  } satisfies ActivityRoute,
  routes: {
    supply: {
      duration: 38,
      frames: [
        { at: 0, position: [7.1, 0, 0.4], pose: 'work', heading: Math.PI },
        { at: 5, position: [7.1, 0, 0.4] },
        { at: 9, position: [3, 0, 0.4] },
        { at: 14, position: [0, 0, 0.4], pose: 'work', heading: Math.PI },
        { at: 17, position: [0, 0, 0.4], cargo: 'profile', pose: 'carry' },
        { at: 22, position: [3, 0, 0.4], cargo: 'profile' },
        { at: 28, position: [7.1, 0, 0.4], pose: 'carry', cargo: 'profile', heading: Math.PI },
        { at: 30, position: [7.1, 0, 0.4], pose: 'work', heading: Math.PI },
        { at: 38, position: [7.1, 0, 0.4] },
      ],
    },
    'glass-handler': {
      duration: 112,
      frames: [
        { at: 0, position: [-6.6, 0, 2.2], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 8, position: [-6.6, 0, 0], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 12, position: [-6.6, 0, 2.2], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 18, position: [-6.6, 0, 2.2] },
        { at: 20, position: [-8, 0, 2.2] },
        { at: 27, position: [-8, 0, 23] },
        { at: 30, position: [-11, 0, 26], heading: Math.PI / 2, pose: 'work' },
        { at: 32, position: [-11, 0, 26], cargo: 'glass', pose: 'carry', lift: 0.65, heading: Math.PI / 2 },
        { at: 34, position: [-11, 0, 26], cargo: 'glass' },
        { at: 38, position: [-8, 0, 23], cargo: 'glass' },
        { at: 51, position: [-8, 0, 0], cargo: 'glass' },
        { at: 54, position: [-6.6, 0, 0], pose: 'work', heading: Math.PI / 2 },
        { at: 58, position: [-6.6, 0, 2.2], heading: Math.PI / 2 },
        { at: 60, position: [-6.6, 0, 2.2], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 64, position: [-6.6, 0, 0], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 66, position: [-6.6, 0, 0], cargo: 'glass-sheet', trolley: false },
        { at: 73, position: [-6.6, 0, -3], cargo: 'glass-sheet', trolley: false },
        { at: 75, position: [-6.6, 0, -3], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 80, position: [-6.6, 0, -3], pose: 'work', trolley: false },
        { at: 84, position: [-6.6, 0, 0], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 86, position: [-6.6, 0, 0], cargo: 'glass-sheet', trolley: false },
        { at: 93, position: [-6.6, 0, -3], cargo: 'glass-sheet', trolley: false },
        { at: 95, position: [-6.6, 0, -3], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 100, position: [-6.6, 0, -3], pose: 'work', trolley: false },
        { at: 105, position: [-6.6, 0, 2.2], pose: 'work', trolley: false, heading: Math.PI / 2 },
        { at: 112, position: [-6.6, 0, 2.2], pose: 'work', trolley: false, heading: Math.PI / 2 },
      ],
    },
    'cargo-handler': {
      duration: 112,
      frames: [
        { at: 0, position: [-9, 0, 17.8], pose: 'work', trolley: false, heading: -Math.PI / 2 },
        { at: 8, position: [-9, 0, 15.1], pose: 'work', trolley: false, heading: Math.PI },
        { at: 16, position: [-9, 0, 17.8], pose: 'work', trolley: false, heading: -Math.PI / 2 },
        { at: 22, position: [-9, 0, 17.8] },
        { at: 27, position: [-6.6, 0, 23] },
        { at: 30, position: [-11, 0, 30] },
        { at: 33, position: [-11, 0, 27.8], heading: Math.PI / 2, pose: 'work' },
        { at: 36, position: [-11, 0, 27.8], cargo: 'boxes', pose: 'carry', lift: 0.65, heading: Math.PI / 2 },
        { at: 38, position: [-11, 0, 27.8], cargo: 'boxes' },
        { at: 44, position: [-6.6, 0, 23], cargo: 'boxes' },
        { at: 52, position: [-6.6, 0, 17], cargo: 'boxes' },
        { at: 56, position: [-8.4, 0, 17], pose: 'work', heading: Math.PI },
        { at: 61, position: [-9, 0, 17.8], heading: -Math.PI / 2 },
        { at: 64, position: [-9, 0, 17.8], pose: 'work', trolley: false, heading: -Math.PI / 2 },
        { at: 68, position: [-8.4, 0, 15.3], pose: 'work', trolley: false, heading: 0 },
        { at: 70, position: [-8.4, 0, 15.3], cargo: 'box', trolley: false },
        { at: 76, position: [-10.5, 0, 15.3], cargo: 'box', trolley: false },
        { at: 78, position: [-10.5, 0, 15.3], pose: 'work', trolley: false, heading: Math.PI },
        { at: 84, position: [-10.5, 0, 15.3], pose: 'work', trolley: false },
        { at: 88, position: [-8.4, 0, 15.3], pose: 'work', trolley: false, heading: 0 },
        { at: 90, position: [-8.4, 0, 15.3], cargo: 'box', trolley: false },
        { at: 96, position: [-10.5, 0, 15.3], cargo: 'box', trolley: false },
        { at: 98, position: [-10.5, 0, 15.3], pose: 'work', trolley: false, heading: Math.PI },
        { at: 102, position: [-10.5, 0, 15.3], pose: 'work', trolley: false },
        { at: 106, position: [-9, 0, 17.8], pose: 'work', trolley: false, heading: -Math.PI / 2 },
        { at: 112, position: [-9, 0, 17.8], pose: 'work', trolley: false, heading: -Math.PI / 2 },
      ],
    },
    'window-loader-a': {
      duration: 156,
      frames: [
        { at: 0, position: [9.4, 0, 26], visible: false },
        { at: 18, position: [9.4, 0, 26] },
        { at: 24, position: [3, 0, 23] },
        { at: 52, position: [3, 0, -13.8] },
        { at: 55, position: [6.2, 0, -13.8] },
        { at: 60, position: [6.2, 0, -11.5], pose: 'work', heading: Math.PI / 2 },
        { at: 62, position: [6.2, 0, -11.5], cargo: 'windows', pose: 'carry', heading: Math.PI / 2 },
        { at: 65, position: [6.2, 0, -13.8], cargo: 'windows' },
        { at: 68, position: [3, 0, -13.8], cargo: 'windows' },
        { at: 94, position: [3, 0, 23], cargo: 'windows' },
        { at: 98, position: [9.4, 0, 26], cargo: 'windows', pose: 'carry', lift: 0, heading: Math.PI / 2 },
        { at: 100, position: [9.4, 0, 26], pose: 'work', lift: 0.6, heading: Math.PI / 2 },
        { at: 102, position: [9.4, 0, 26] },
        { at: 104, position: [10.8, 0, 24.5] },
        { at: 109, position: [14.8, 0, 24.5] },
        { at: 110, position: [14.8, 0.65, 25.1], visible: false },
        { at: 114, position: [9.4, 0, 26], visible: false },
        { at: 156, position: [9.4, 0, 26], visible: false },
      ],
    },
    'window-loader-b': {
      duration: 156,
      frames: [
        { at: 0, position: [9.4, 0, 27.5], visible: false },
        { at: 18, position: [9.4, 0, 27.5] },
        { at: 27, position: [4.4, 0, 23] },
        { at: 56, position: [4.4, 0, -13.8] },
        { at: 59, position: [6.2, 0, -13.8] },
        { at: 64, position: [6.2, 0, -10], pose: 'work', heading: Math.PI / 2 },
        { at: 66, position: [6.2, 0, -10], cargo: 'windows', pose: 'carry', heading: Math.PI / 2 },
        { at: 69, position: [6.2, 0, -13.8], cargo: 'windows' },
        { at: 72, position: [4.4, 0, -13.8], cargo: 'windows' },
        { at: 98, position: [4.4, 0, 23], cargo: 'windows' },
        { at: 102, position: [9.4, 0, 27.5], cargo: 'windows', pose: 'carry', heading: Math.PI / 2 },
        { at: 104, position: [9.4, 0, 27.5], pose: 'work', lift: 0.6, heading: Math.PI / 2 },
        { at: 105, position: [9.4, 0, 27.5] },
        { at: 109, position: [11, 0, 28.5] },
        { at: 111, position: [14.8, 0, 28.5] },
        { at: 112, position: [14.8, 0.65, 27.5], visible: false },
        { at: 115, position: [9.4, 0, 27.5], visible: false },
        { at: 156, position: [9.4, 0, 27.5], visible: false },
      ],
    },
    richard: patrolWithBreaks(richardPatrol, richardBreak, [2, 3]),
  } satisfies Record<string, ActivityRoute>,
  receivedGlass: [-5.5, 0, 0] as Vec3,
  receivedBoxes: [-8.4, 0.08, 16] as Vec3,
  officeVisitors: {
    administration: {
      duration: 32,
      frames: [
        { at: 0, position: [-6.2, 0.03, 2.8], heading: Math.PI / 2 },
        { at: 2, position: [-6.2, 0.03, 2.8] },
        { at: 5, position: [-4.75, 0.2, 2.8] },
        { at: 7, position: [-4.75, 0.2, 4] },
        { at: 11, position: [-1.4, 0.2, 4], pose: 'talk', heading: -2 },
        { at: 19, position: [-1.4, 0.2, 4] },
        { at: 23, position: [-4.75, 0.2, 4] },
        { at: 25, position: [-4.75, 0.2, 2.8] },
        { at: 28, position: [-6.2, 0.03, 2.8], heading: Math.PI / 2 },
        { at: 32, position: [-6.2, 0.03, 2.8] },
      ],
    },
    sales: {
      duration: 32, offset: 8,
      frames: [
        { at: 0, position: [-3.2, 0.03, 1.4], heading: Math.PI / 2 },
        { at: 2, position: [-3.2, 0.03, 1.4] },
        { at: 5, position: [-1.7, 0.2, 1.4] },
        { at: 9, position: [-1.4, 0.2, 1.8], pose: 'talk', heading: 2 },
        { at: 22, position: [-1.4, 0.2, 1.8] },
        { at: 25, position: [-1.7, 0.2, 1.4] },
        { at: 28, position: [-3.2, 0.03, 1.4], heading: Math.PI / 2 },
        { at: 32, position: [-3.2, 0.03, 1.4] },
      ],
    },
  } satisfies Record<string, ActivityRoute>,
} as const;
