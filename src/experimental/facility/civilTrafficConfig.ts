export const civilTrafficConfig = {
  startX: -96, endX: 96, passDuration: 24, interval: 90, gateRadius: 26,
  // Keep civil cars clear of the timed truck entry/exit maneuvers. Not a physics engine.
  crossings: [
    { period: 112, windows: [[6, 21], [55, 73]] },
    { period: 156, windows: [[6, 21], [111, 129]] },
  ],
  cars: [
    { id: 'sedan-red', color: '#aa635b', lane: 33.6, direction: 1, offset: -12, tall: false },
    { id: 'sedan-blue', color: '#678caa', lane: 33.6, direction: 1, offset: 33, tall: false },
    { id: 'suv-white', color: '#e1e7e9', lane: 28.4, direction: -1, offset: -9, tall: true },
    { id: 'sedan-gray', color: '#7d8c96', lane: 28.4, direction: -1, offset: 36, tall: false },
  ],
} as const;
export type CivilCar = typeof civilTrafficConfig.cars[number];
export interface CivilTrafficSample { x: number; z: number; heading: number; visible: boolean; spin: number; }
export function civilPassIsClear(start: number) {
  const c = civilTrafficConfig;
  const speed = (c.endX - c.startX) / c.passDuration;
  const from = start + (-c.gateRadius - c.startX) / speed;
  const to = start + (c.gateRadius - c.startX) / speed;
  for (const crossing of c.crossings) {
    const firstCycle = Math.floor(from / crossing.period) - 1;
    const lastCycle = Math.floor(to / crossing.period);
    for (let cycle = firstCycle; cycle <= lastCycle; cycle++) for (const [a, b] of crossing.windows) {
      if (from < cycle * crossing.period + b && to > cycle * crossing.period + a) return false;
    }
  }
  return true;
}
export function sampleCivilTraffic(time: number, car: CivilCar, out: CivilTrafficSample = { x: 0, z: 0, heading: 0, visible: false, spin: 0 }) {
  const c = civilTrafficConfig;
  const start = car.offset + Math.floor((time - car.offset) / c.interval) * c.interval;
  const elapsed = Math.max(0, Math.min(c.passDuration, time - start));
  const distance = (c.endX - c.startX) * elapsed / c.passDuration;
  out.x = (c.startX + distance) * car.direction;
  out.z = car.lane;
  out.heading = car.direction * Math.PI / 2;
  out.visible = time - start < c.passDuration && civilPassIsClear(start);
  out.spin = distance / 0.33;
  return out;
}
