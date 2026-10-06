import type { Vec3 } from './types';

export type ActorPose = 'stand' | 'walk' | 'work' | 'talk' | 'carry' | 'smoke';

export type CargoKind = 'none' | 'profile' | 'glass' | 'boxes' | 'panels' | 'windows' | 'glass-sheet' | 'box';
export interface ActivityKeyframe { at: number; position: Vec3; cargo?: CargoKind; pose?: ActorPose; lift?: number; heading?: number; visible?: boolean; trolley?: boolean; }
export interface ActivityRoute { duration: number; offset?: number; frames: readonly ActivityKeyframe[]; }
export interface MotionSample { x: number; y: number; z: number; heading: number; moving: boolean; cargo: CargoKind; pose: ActorPose; lift: number; visible: boolean; trolley: boolean; }
export const emptyMotion = (): MotionSample => ({ x: 0, y: 0, z: 0, heading: 0, moving: false, cargo: 'none', pose: 'stand', lift: 0, visible: true, trolley: true });
export const loopTime = (seconds: number, duration: number) => ((seconds % duration) + duration) % duration;
export const ease = (value: number) => { const t = Math.max(0, Math.min(1, value)); return t * t * (3 - 2 * t); };
export function advanceActivityTime(current: number, delta: number, active: boolean, hidden: boolean) {
  return current + (active && !hidden ? Math.max(0, Math.min(delta, 0.08)) : 0);
}
// Mutable output avoids allocating vectors / React state in the render loop.
export function sampleMotion(route: ActivityRoute, seconds: number, out = emptyMotion()): MotionSample {
  const t = loopTime(seconds + (route.offset ?? 0), route.duration);
  let index = 0;
  while (index < route.frames.length - 2 && t >= route.frames[index + 1].at) index++;
  const a = route.frames[index];
  const b = route.frames[index + 1];
  const progress = ease((t - a.at) / (b.at - a.at));
  const dx = b.position[0] - a.position[0], dz = b.position[2] - a.position[2];
  out.x = a.position[0] + dx * progress;
  out.y = a.position[1] + (b.position[1] - a.position[1]) * progress;
  out.z = a.position[2] + dz * progress;
  out.moving = Math.abs(dx) + Math.abs(dz) > 0.001;
  out.cargo = a.cargo ?? 'none';
  out.visible = a.visible ?? true;
  out.trolley = a.trolley ?? true;
  out.pose = out.moving ? (out.cargo === 'none' ? 'walk' : 'carry') : (a.pose ?? 'stand');
  out.lift = (a.lift ?? 0) + ((b.lift ?? 0) - (a.lift ?? 0)) * progress;
  if (out.moving) out.heading = Math.atan2(dx, dz);
  else if (a.heading !== undefined) out.heading = a.heading;
  return out;
}

export const secretWindow = { neighborId: 'left', tripleClickMs: 1800 } as const;
export interface SecretClicks { count: number; startedAt: number; }
export function registerSecretClick(clicks: SecretClicks, now: number, dragged = false) {
  if (dragged) { clicks.count = 0; return false; }
  if (!clicks.count || now - clicks.startedAt > secretWindow.tripleClickMs) {
    clicks.count = 1; clicks.startedAt = now; return false;
  }
  if (++clicks.count < 3) return false;
  clicks.count = 0;
  return true;
}

export interface RichardSecretState {
  debt: number;
  forced: { startedAt: number; route: ActivityRoute } | null;
  window: { openedAt: number; closesAt: number } | null;
}
export const createRichardSecret = (): RichardSecretState => ({ debt: 0, forced: null, window: null });
const distance = (a: Vec3, b: Vec3) => Math.hypot(b[0] - a[0], b[2] - a[2]);
const same = (a: Vec3, b: Vec3) => distance(a, b) < 0.001;
const pathLength = (path: Vec3[]) => path.slice(1).reduce((sum, p, i) => sum + distance(path[i], p), 0);

// Retrace existing aisle segments to the closest entrance occurrence. Never cut
// directly across racks/offices, and return to the exact interrupted position.
export function makeRichardDetour(routine: ActivityRoute, rest: ActivityRoute, phase: number): ActivityRoute {
  const current = sampleMotion(routine, phase);
  const point: Vec3 = [current.x, current.y, current.z];
  const t = loopTime(phase + (routine.offset ?? 0), routine.duration);
  let index = 0;
  while (index < routine.frames.length - 2 && t >= routine.frames[index + 1].at) index++;
  const anchor = rest.frames[0].position;
  const backward: Vec3[] = [point], forward: Vec3[] = [point];
  for (let i = index; i >= 0; i--) {
    backward.push(routine.frames[i].position);
    if (same(routine.frames[i].position, anchor)) break;
  }
  for (let i = index + 1; i < routine.frames.length; i++) {
    forward.push(routine.frames[i].position);
    if (same(routine.frames[i].position, anchor)) break;
  }
  const path = pathLength(backward) <= pathLength(forward) ? backward : forward;
  const frames: ActivityKeyframe[] = [{ at: 0, position: point, heading: current.heading }];
  let elapsed = 0;
  const appendPoint = (position: Vec3) => {
    const length = distance(frames[frames.length - 1].position, position);
    if (length < 0.001) return;
    elapsed += Math.max(0.25, length / 1.15);
    frames.push({ at: elapsed, position });
  };
  path.slice(1).forEach(appendPoint);
  frames.pop();
  const arrival = elapsed;
  rest.frames.forEach(frame => frames.push({ ...frame, at: arrival + frame.at }));
  elapsed += rest.duration;
  path.slice(0, -1).reverse().forEach(appendPoint);
  return { duration: elapsed, frames };
}

export function sampleRichardSecret(state: RichardSecretState, routine: ActivityRoute, seconds: number, out = emptyMotion()): MotionSample {
  const forced = state.forced;
  if (forced && seconds - forced.startedAt >= forced.route.duration) {
    state.debt += forced.route.duration;
    state.forced = null;
  }
  return state.forced
    ? sampleMotion(state.forced.route, seconds - state.forced.startedAt, out)
    : sampleMotion(routine, seconds - state.debt, out);
}

export function requestRichardSecret(state: RichardSecretState, routine: ActivityRoute, rest: ActivityRoute, seconds: number) {
  const current = sampleRichardSecret(state, routine, seconds);
  if (state.forced) return false; // No queues or repeated restarts while on a break.
  if (current.pose === 'smoke') {
    state.window = { openedAt: seconds, closesAt: seconds + 6 };
    return false; // Already smoking: leave the automatic routine untouched.
  }
  const route = makeRichardDetour(routine, rest, seconds - state.debt);
  state.forced = { startedAt: seconds, route };
  state.window = { openedAt: seconds, closesAt: seconds + route.duration };
  return true;
}
export function secretWindowAngle(state: RichardSecretState, seconds: number) {
  const window = state.window;
  if (!window) return 0;
  return 1.15 * ease((seconds - window.openedAt) / 0.75) * (1 - ease((seconds - (window.closesAt - 0.9)) / 0.9));
}

export function smokingGesture(seconds: number) {
  const t = loopTime(seconds, 6);
  return ease((t - 0.5) / 0.8) * (1 - ease((t - 2.8) / 1));
}

export function sampleSmoke(seconds: number, index: number, out = { x: 0, y: 0, z: 0, scale: 0, opacity: 0 }) {
  const age = loopTime(seconds - index * 0.37, 4);
  const life = age / 4;
  out.x = Math.sin(age * 1.4 + index) * 0.1 + life * 0.24;
  out.y = age * 0.48;
  out.z = life * 0.16;
  out.scale = 0.06 + life * 0.23;
  out.opacity = seconds < index * 0.37 ? 0 : 0.35 * ease(life / 0.16) * (1 - ease((life - 0.35) / 0.65));
  return out;
}
export function doorAngle(seconds: number, duration = 32) {
  const t = loopTime(seconds, duration);
  // Visitors cross the doorway at 2–5s and 24–28s. The leaf is already open.
  const arrival = ease(t / 1.5) * (1 - ease((t - 7) / 3));
  const departure = ease((t - 21) / 2) * (1 - ease((t - 29) / 3));
  return 0.12 + Math.max(arrival, departure) * 1.12;
}
export interface ShipmentSchedule { duration: number; arrival: number; glassPickup: number; boxesPickup: number; glassDelivered: number; boxesDelivered: number; departure: number; }
export function sampleShipment(seconds: number, schedule: ShipmentSchedule, out = { truckGlass: true, truckBoxes: true, receivedGlass: false, receivedBoxes: false, gate: 0 }) {
  const t = loopTime(seconds, schedule.duration);
  out.truckGlass = t < schedule.glassPickup;
  out.truckBoxes = t < schedule.boxesPickup;
  out.receivedGlass = t >= schedule.glassDelivered;
  out.receivedBoxes = t >= schedule.boxesDelivered;
  out.gate = ease((t - schedule.arrival) / 2) * (1 - ease((t - (schedule.departure - 3)) / 2));
  return out;
}

export interface DispatchSchedule { duration: number; arrival: number; firstPickup: number; secondPickup: number; firstLoaded: number; secondLoaded: number; firstBoarded: number; secondBoarded: number; departure: number; }
export function sampleDispatch(seconds: number, schedule: DispatchSchedule, out = { finishedWindows: 0, loadedWindows: 0, passengers: 2, gate: 0 }) {
  const t = loopTime(seconds, schedule.duration);
  const produced = Math.min(4, Math.max(0, Math.floor((t - 8) / 10) + 1));
  const collected = (t >= schedule.firstPickup ? 2 : 0) + (t >= schedule.secondPickup ? 2 : 0);
  out.finishedWindows = Math.max(0, produced - collected);
  out.loadedWindows = (t >= schedule.firstLoaded ? 2 : 0) + (t >= schedule.secondLoaded ? 2 : 0);
  out.passengers = t < 18 ? 2 : (t >= schedule.firstBoarded ? 1 : 0) + (t >= schedule.secondBoarded ? 1 : 0);
  out.gate = ease((t - schedule.arrival) / 2) * (1 - ease((t - (schedule.departure - 3)) / 2));
  return out;
}
