// Node 22.18+ / 24 can load these configuration-only TypeScript modules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { navigationItems } from '../src/data/navigation.ts';
import { facilityConfig, fitZoom, roofOpacity } from '../src/experimental/facility/facilityConfig.ts';
import { facilityAreas, areaById, supplierTarget } from '../src/experimental/facility/facilityAreas.ts';
import { civilTrafficConfig, civilPassIsClear, sampleCivilTraffic } from '../src/experimental/facility/civilTrafficConfig.ts';
import { canViewModule } from '../src/lib/roles.ts';
import { activityConfig } from '../src/experimental/facility/activityConfig.ts';
import { neighborhoodConfig, neighborhoodStreet } from '../src/experimental/facility/neighborhoodConfig.ts';
import { advanceActivityTime, doorAngle, emptyMotion, sampleDispatch, sampleMotion, sampleShipment, sampleSmoke, smokingGesture } from '../src/experimental/facility/activityMotion.ts';
import { createRichardSecret, makeRichardDetour, registerSecretClick, requestRichardSecret, sampleRichardSecret, secretWindow, secretWindowAngle } from '../src/experimental/facility/activityMotion.ts';

test('interactive view is available in published navigation immediately above configuration', () => {
  const view = navigationItems.findIndex(item => item.path === '/vista-interactiva');
  const settings = navigationItems.findIndex(item => item.path === '/configuracion');
  assert.ok(view >= 0);
  assert.equal(view + 1, settings);
  assert.equal(navigationItems[view - 1].path, '/reportes');
  assert.equal(navigationItems[view].moduleName, 'control');
});

test('secret window requires three consecutive taps, ignores drags and expires incomplete gestures', () => {
  assert.equal(secretWindow.neighborId, 'left');
  const clicks = { count: 0, startedAt: 0 };
  assert.equal(registerSecretClick(clicks, 0), false);
  assert.equal(registerSecretClick(clicks, 300), false);
  assert.equal(registerSecretClick(clicks, 600), true);
  assert.equal(clicks.count, 0);
  assert.equal(registerSecretClick(clicks, 900), false);
  assert.equal(registerSecretClick(clicks, 1000, true), false);
  assert.equal(registerSecretClick(clicks, 1100), false);
  assert.equal(registerSecretClick(clicks, 1200), false);
  assert.equal(registerSecretClick(clicks, 3100), false);
  assert.equal(clicks.count, 1);
  assert.equal(registerSecretClick(clicks, 3300), false);
  assert.equal(registerSecretClick(clicks, 3500), true);
});
test('manual Richard detours begin and end at the interrupted position using existing aisle segments', () => {
  const routine = activityConfig.routes.richard, rest = activityConfig.richardRoutine.rest;
  const allowed = [...routine.frames, ...rest.frames];
  const onSegment = (point, a, b) => {
    const dx = b[0] - a[0], dz = b[2] - a[2];
    const length = Math.hypot(dx, dz);
    if (length < 0.001) return Math.hypot(point[0] - a[0], point[2] - a[2]) < 0.001;
    const projection = ((point[0] - a[0]) * dx + (point[2] - a[2]) * dz) / length ** 2;
    const cross = Math.abs((point[0] - a[0]) * dz - (point[2] - a[2]) * dx) / length;
    return cross < 0.001 && projection >= -0.001 && projection <= 1.001;
  };
  for (let phase = 0; phase < routine.duration; phase += 3.7) {
    const start = sampleMotion(routine, phase), route = makeRichardDetour(routine, rest, phase);
    const point = [start.x, start.y, start.z];
    assert.ok(route.frames[0].position.every((value, axis) => Math.abs(value - point[axis]) < 0.001));
    assert.ok(route.frames[route.frames.length - 1].position.every((value, axis) => Math.abs(value - point[axis]) < 0.001));
    assert.ok(route.duration >= rest.duration && route.duration < 250);
    assert.ok(route.frames.some(frame => frame.pose === 'smoke' && frame.position[0] === -17.25 && frame.position[2] === 20.6));
    for (let i = 1; i < route.frames.length; i++) {
      const a = route.frames[i - 1], b = route.frames[i];
      assert.ok(b.at > a.at);
      const middle = a.position.map((value, axis) => (value + b.position[axis]) / 2);
      assert.ok(allowed.some((frame, j) => j && onSegment(middle, allowed[j - 1].position, frame.position)), 'no shortcut across racks/offices');
    }
  }
});
test('manual break pauses only Richard routine, rejects repeat triggers and resumes it continuously', () => {
  const routine = activityConfig.routes.richard, rest = activityConfig.richardRoutine.rest;
  const state = createRichardSecret(), now = 60;
  const before = { ...sampleMotion(routine, now) };
  assert.equal(requestRichardSecret(state, routine, rest, now), true);
  const forced = state.forced;
  assert.equal(requestRichardSecret(state, routine, rest, now + 3), false);
  assert.equal(state.forced, forced);
  const start = sampleRichardSecret(state, routine, now);
  assert.deepEqual([start.x, start.y, start.z], [before.x, before.y, before.z]);
  const smoke = forced.route.frames.find(frame => frame.pose === 'smoke');
  assert.equal(sampleRichardSecret(state, routine, now + smoke.at + 1).pose, 'smoke');
  const paused = JSON.stringify(sampleRichardSecret(state, routine, now + smoke.at + 1));
  assert.equal(JSON.stringify(sampleRichardSecret(state, routine, now + smoke.at + 1)), paused);
  assert.equal(secretWindowAngle(state, now + smoke.at + 1), secretWindowAngle(state, now + smoke.at + 1));
  const after = sampleRichardSecret(state, routine, now + forced.route.duration);
  assert.deepEqual([after.x, after.y, after.z], [before.x, before.y, before.z]);
  assert.equal(state.forced, null);
  assert.equal(state.debt, forced.route.duration);
  assert.equal(secretWindowAngle(state, now + forced.route.duration), 0);
  assert.deepEqual(sampleRichardSecret(state, routine, now + forced.route.duration + 8), sampleMotion(routine, now + 8));
  assert.equal(requestRichardSecret(state, routine, rest, now + forced.route.duration + 8), true);
});
test('automatic two/three-lap smoking schedule stays unchanged without the secret', () => {
  const routine = activityConfig.routes.richard, rest = activityConfig.richardRoutine.rest;
  const state = createRichardSecret();
  for (let time = 0; time < 1500; time += 0.5) assert.deepEqual(sampleRichardSecret(state, routine, time), sampleMotion(routine, time));
  assert.equal(requestRichardSecret(state, routine, rest, 241), false, 'already smoking: do not stack another break');
  assert.equal(state.forced, null);
  assert.equal(state.debt, 0);
  assert.equal(secretWindowAngle(state, 242), 1.15);
  assert.equal(secretWindowAngle(state, 247), 0);
});

test('roof cutaway is continuous, monotone, bounded and fully closed/open at limits', () => {
  const { fadeStart, fadeEnd } = facilityConfig.roof;
  assert.equal(roofOpacity(0.5), 1);
  assert.equal(roofOpacity(fadeStart), 1);
  assert.equal(roofOpacity(fadeEnd), 0);
  assert.equal(roofOpacity(10), 0);
  assert.ok(Math.abs(roofOpacity((fadeStart + fadeEnd) / 2) - 0.5) < 1e-10);
  let previous = 1;
  for (let zoom = 0.8; zoom < 3.5; zoom += 0.005) {
    const opacity = roofOpacity(zoom);
    assert.ok(opacity >= 0 && opacity <= 1 && opacity <= previous);
    assert.ok(previous - opacity < 0.02, 'no abrupt boolean jump');
    previous = opacity;
  }
});
test('every sector has a unique layout and destination, without fictional operational data', () => {
  const ids = facilityAreas.map(area => area.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual(new Set(ids), new Set(Object.keys(facilityConfig.areas)));
  for (const area of facilityAreas) {
    assert.ok(area.route.startsWith('/'));
    assert.ok(area.description.length && area.action.length);
    assert.equal(area.metrics, undefined);
    assert.equal(area.activity, undefined);
    assert.equal(areaById[area.id], area);
    const layout = facilityConfig.areas[area.id];
    assert.ok(layout.position.every(Number.isFinite));
    assert.ok(layout.size.every(n => n > 0));
    assert.ok(Math.abs(layout.position[0]) <= facilityConfig.camera.panX);
    assert.ok(Math.abs(layout.position[2]) <= facilityConfig.camera.panZ);
  }
});
test('layout preserves workshop, offices, supplies and rear/front relationships', () => {
  const a = facilityConfig.areas;
  assert.ok(a.entrance.position[2] > a.administration.position[2]);
  assert.ok(a.administration.position[0] > 0);
  assert.ok(a.sales.position[2] < a.administration.position[2]);
  assert.ok(a.workshop.position[2] < a.sales.position[2]);
  assert.ok(a.raw.position[0] < a.workshop.position[0]);
  assert.ok(a.glass.position[2] < a.workshop.position[2]);
  assert.ok(a.aluminum.position[2] < a.workshop.position[2]);
});
test('decorative neighbors occupy both sides and rear, clear of the depot lot and access road', () => {
  assert.equal(new Set(neighborhoodConfig.map(b => b.id)).size, neighborhoodConfig.length);
  assert.ok(neighborhoodConfig.some(b => b.position[0] < -24));
  assert.ok(neighborhoodConfig.some(b => b.position[0] > 24));
  assert.ok(neighborhoodConfig.some(b => b.position[2] < -25));
  const footprints = neighborhoodConfig.map(b => {
    assert.ok(b.position.every(Number.isFinite));
    assert.ok(b.width > 0 && b.depth > 0 && b.height > 0 && b.height < 7);
    const bounds = { left: b.plot.position[0] - b.plot.width / 2, right: b.plot.position[0] + b.plot.width / 2,
      rear: b.plot.position[2] - b.plot.depth / 2, front: b.plot.position[2] + b.plot.depth / 2 };
    assert.ok(bounds.right <= -24 || bounds.left >= 24 || bounds.front <= -25, 'plot outside the main property');
    assert.ok(bounds.front <= 27, 'no neighbor in the truck access/exit corridor');
    assert.ok(b.position[0] - b.width / 2 >= bounds.left && b.position[0] + b.width / 2 <= bounds.right);
    assert.ok(b.position[2] - b.depth / 2 >= bounds.rear && b.position[2] + b.depth / 2 <= bounds.front);
    return bounds;
  });
  for (let i = 0; i < footprints.length; i++) for (let j = i + 1; j < footprints.length; j++) {
    const a = footprints[i], b = footprints[j];
    assert.ok(a.right <= b.left || b.right <= a.left || a.front <= b.rear || b.front <= a.rear, 'neighbor plots touch without overlapping');
  }
  assert.equal(Object.keys(facilityConfig.areas).length, 12, 'scenery does not become a selectable sector');
});
test('lateral neighbors share the depot frontage and abut its lot, without landlocked rows', () => {
  const streetFront = neighborhoodStreet.position[2] - neighborhoodStreet.depth / 2;
  const sideNeighbors = neighborhoodConfig.filter(b => b.frontage === 'street');
  assert.equal(sideNeighbors.length, 2, 'one deep property on each side, not two rows');
  for (const b of sideNeighbors) {
    assert.equal(b.position[2] + b.depth / 2, facilityConfig.building.depth / 2, 'same front facade line');
    assert.equal(b.plot.position[2] + b.plot.depth / 2, streetFront, 'direct frontage on the single street');
    assert.equal(b.plot.position[2] - b.plot.depth / 2, -25, 'same rear lot boundary');
    assert.equal(Math.abs(b.plot.position[0]) - b.plot.width / 2, facilityConfig.site.width / 2, 'no invented side street');
  }
  for (const b of neighborhoodConfig.filter(b => b.frontage === 'rear')) {
    assert.equal(b.plot.position[2] + b.plot.depth / 2, -25, 'rear lots abut the depot');
  }
});
test('overview fits both phone and desktop while focus stays inside camera limits', () => {
  assert.ok(fitZoom(350, 480) > 0);
  assert.ok(fitZoom(1400, 800) > fitZoom(350, 480));
  const c = facilityConfig.camera;
  assert.ok(c.minZoom < 1 && c.focusZoom < c.maxZoom);
  assert.equal(roofOpacity(c.focusZoom), 0);
  assert.ok(c.minPolar > 0 && c.maxPolar < Math.PI / 2);
});
test('ambient assets have unique identities independent of operational data', () => {
  assert.equal(new Set(facilityConfig.vehicles.map(v => v.id)).size, facilityConfig.vehicles.length);
  assert.equal(new Set(facilityConfig.workers.map(w => w.id)).size, facilityConfig.workers.length);
});
test('offices, workshop, inventory and delivery truck target the existing guarded modules', () => {
  for (const [id, route, module] of [
    ['workshop', '/produccion', 'produccion'], ['control', '/control', 'control'],
    ['sales', '/avance-obras', 'avance_obras'], ['administration', '/finanzas-obras', 'finanzas_obras'],
  ]) {
    assert.equal(areaById[id].route, route);
    assert.equal(areaById[id].module, module);
  }
  for (const area of facilityAreas.filter(a => a.module === 'inventario')) assert.equal(area.route, '/inventario');
  assert.equal(supplierTarget.id, 'delivery');
  assert.equal(supplierTarget.route, '/proveedores');
  assert.equal(supplierTarget.module, 'proveedores');
  for (const target of [...facilityAreas, supplierTarget]) {
    assert.equal(canViewModule({role:'admin', active:true}, target.module), true);
    assert.equal(canViewModule({role:'admin', active:false}, target.module), false);
    assert.equal(canViewModule({role:'admin', active:true, modules:{[target.module]:{view:false}}}, target.module), false);
  }
});
test('civil cars stay on separate road lanes, with continuous constant-speed passes and no overlapping same-lane cars', () => {
  const c = civilTrafficConfig;
  assert.equal(c.crossings[0].period, activityConfig.truck.duration);
  assert.equal(c.crossings[1].period, activityConfig.serviceTruck.duration);
  assert.equal(new Set(c.cars.map(car => car.id)).size, c.cars.length);
  for (let time = 0; time < 4368; time += 0.5) {
    const visible = c.cars.map(car => sampleCivilTraffic(time, car)).filter(car => car.visible);
    for (const pose of visible) assert.ok(pose.z - 0.75 > 27 && pose.z + 0.75 < 35);
    for (let i=0;i<visible.length;i++) for (let j=i+1;j<visible.length;j++) {
      if (visible[i].z === visible[j].z) assert.ok(Math.abs(visible[i].x - visible[j].x) > 4);
    }
  }
  for (const car of c.cars) {
    const out = sampleCivilTraffic(0, car);
    assert.equal(sampleCivilTraffic(1, car, out), out, 'reuse the result object, not allocations per frame');
    const before = sampleCivilTraffic(0, car), after = sampleCivilTraffic(0.01, car);
    assert.ok(before.visible && after.visible || !before.visible);
    assert.ok(Math.abs(after.x - before.x) < 0.1);
    assert.deepEqual(sampleCivilTraffic(5, car), sampleCivilTraffic(5, car), 'paused shared clock freezes cars and wheels');
  }
});
test('civil traffic schedules its central crossing away from truck entry and exit maneuvers', () => {
  const c = civilTrafficConfig;
  for (let start = -100; start < 4368; start += 0.5) {
    if (!civilPassIsClear(start)) continue;
    const speed = (c.endX-c.startX)/c.passDuration;
    const from = start + (-c.gateRadius-c.startX)/speed;
    const to = start + (c.gateRadius-c.startX)/speed;
    for (let time=from;time<to;time+=0.1) for (const crossing of c.crossings) {
      const phase = ((time%crossing.period)+crossing.period)%crossing.period;
      assert.ok(!crossing.windows.some(([a,b])=>phase>a+1e-8 && phase<b-1e-8));
    }
  }
});
test('activity routes are ordered, closed and continuous at every waypoint and loop seam', () => {
  const routes = [activityConfig.truck, activityConfig.serviceTruck, ...Object.values(activityConfig.routes), ...Object.values(activityConfig.officeVisitors)];
  for (const route of routes) {
    assert.equal(route.frames[0].at, 0);
    assert.equal(route.frames.at(-1).at, route.duration);
    assert.deepEqual(route.frames[0].position, route.frames.at(-1).position);
    route.frames.forEach((frame, i) => {
      if (i) assert.ok(frame.at > route.frames[i - 1].at);
      assert.ok(frame.position.every(Number.isFinite));
      const offset = route.offset ?? 0;
      const before = sampleMotion(route, frame.at - offset - 0.001);
      const after = sampleMotion(route, frame.at - offset + 0.001);
      assert.ok(Math.hypot(before.x - after.x, before.z - after.z) < 0.01, 'no teleports at keyframes');
    });
  }
});
test('pausing or hiding the page freezes the shared choreography without catch-up jumps', () => {
  assert.equal(advanceActivityTime(15, 1, false, false), 15);
  assert.equal(advanceActivityTime(15, 1, true, true), 15);
  assert.equal(advanceActivityTime(15, 30, true, false), 15.08);
  const out = emptyMotion();
  assert.equal(sampleMotion(activityConfig.routes.supply, 19, out), out);
  const before = { ...out };
  sampleMotion(activityConfig.routes.supply, advanceActivityTime(19, 4, false, false), out);
  assert.deepEqual(out, before);
});
test('delivery truck arrives before handlers and leaves empty after both deliveries', () => {
  for (const t of [30, 32, 36, 54, 56]) {
    const vehicle = sampleMotion(activityConfig.truck, t);
    assert.equal(vehicle.moving, false);
    assert.equal(vehicle.x, -7); assert.equal(vehicle.z, 26);
  }
  const arriving = sampleShipment(10, activityConfig.shipment);
  assert.ok(arriving.truckGlass && arriving.truckBoxes);
  const departing = sampleShipment(62, activityConfig.shipment);
  assert.ok(!departing.truckGlass && !departing.truckBoxes);
  assert.ok(departing.receivedGlass && departing.receivedBoxes);
  for (const id of ['glass-handler', 'cargo-handler']) {
    const route = activityConfig.routes[id];
    assert.ok(sampleMotion(route, activityConfig.shipment.arrival - 0.1).z < 20, 'works inside until the delivery truck arrives');
    assert.ok(sampleMotion(route, 25).moving);
    assert.equal(sampleMotion(route, 70).trolley, false);
  }
  assert.ok(activityConfig.shipment.departure > activityConfig.shipment.boxesDelivered);
});

test('unloaders park one cart each, sort material on foot, then retrieve it after arrival', () => {
  for (const [id, cargo] of [['glass-handler', 'glass-sheet'], ['cargo-handler', 'box']]) {
    const route = activityConfig.routes[id];
    const parking = activityConfig.cartParking[id];
    assert.ok(parking.position[2] < 20);
    for (let t = 66; t < 112; t += 0.1) {
      const sample = sampleMotion(route, t);
      assert.equal(sample.trolley, false, 'do not push the cart while arranging stock');
      assert.ok(sample.z < 20, 'remain inside instead of waiting in front');
    }
    assert.ok(route.frames.filter(f => f.cargo === cargo).length >= 4, 'two carrying/placing passes');
    assert.ok(sampleMotion(route, 72).moving);
    assert.equal(sampleMotion(route, 72).cargo, cargo);
    const retrieval = route.frames.find(f => f.trolley !== false);
    assert.ok(retrieval.at > activityConfig.shipment.arrival);
    assert.deepEqual(retrieval.position, parking.position);
    const park = route.frames.find(f => f.at > 54 && f.trolley === false);
    assert.deepEqual(park.position, parking.position, 'cart detaches at its actual location, not by teleport');
    const beforeArrival = sampleMotion(route, route.duration + activityConfig.shipment.arrival - 0.1);
    assert.equal(beforeArrival.trolley, false);
    assert.equal(sampleMotion(route, route.duration + 25).trolley, true);
  }
});

test('unloaders do not stand in the same pickup spot behind the delivery truck', () => {
  for (let t = 30; t < 39; t += 0.1) {
    const glass = sampleMotion(activityConfig.routes['glass-handler'], t);
    const boxes = sampleMotion(activityConfig.routes['cargo-handler'], t);
    assert.ok(Math.hypot(glass.x - boxes.x, glass.z - boxes.z) > 1.5);
  }
});
test('supply actor collects a profile from raw materials and carries it to the workshop', () => {
  const route = activityConfig.routes.supply;
  const outbound = sampleMotion(route, 11);
  assert.equal(outbound.cargo, 'none');
  assert.equal(sampleMotion(route, 19).cargo, 'profile');
  assert.equal(sampleMotion(route, 26).cargo, 'profile');
  assert.ok(sampleMotion(route, 26).x > facilityConfig.areas.raw.position[0] + facilityConfig.areas.raw.size[0] / 2);
  assert.equal(sampleMotion(route, 32).cargo, 'none');
});
test('office door openings fit inside their walls and are open when visitors cross', () => {
  for (const office of facilityConfig.offices) {
    const size = facilityConfig.areas[office.id].size;
    const span = office.door.wall === 'left' ? size[1] : size[0];
    assert.ok(Math.abs(office.door.offset) + office.door.width / 2 < span / 2);
    assert.ok(office.door.width >= 1.2);
  }
  for (const t of [3, 4, 24, 26]) assert.ok(doorAngle(t) > 1.1);
  assert.ok(Math.abs(doorAngle(32 - 0.0001) - doorAngle(0.0001)) < 0.001);
});
test('logistics actors carry the right cargo and use the front gate, not a solid facade', () => {
  assert.equal(sampleMotion(activityConfig.routes['glass-handler'], 40).cargo, 'glass');
  assert.equal(sampleMotion(activityConfig.routes['cargo-handler'], 48).cargo, 'boxes');
  assert.equal(sampleMotion(activityConfig.routes['window-loader-a'], 80).cargo, 'windows');
  for (const id of ['glass-handler', 'cargo-handler', 'window-loader-a', 'window-loader-b']) {
    const route = activityConfig.routes[id];
    let previous = sampleMotion(route, 0);
    for (let t = 0.1; t < route.duration; t += 0.1) {
      const current = sampleMotion(route, t);
      if ((previous.z - 20) * (current.z - 20) < 0) assert.ok(current.x > -9.5 && current.x < 5.5, 'cross front through vehicle gate');
      previous = current;
    }
  }
});

test('both vehicles disappear down the road and reset only beyond the visible lot', () => {
  for (const route of [activityConfig.truck, activityConfig.serviceTruck]) {
    const last = route.frames.at(-1).position;
    assert.ok(Math.abs(last[0]) >= 48);
    const exit = sampleMotion(route, route === activityConfig.truck ? 84 : 140);
    assert.ok(Math.abs(exit.x) >= 48);
    assert.equal(exit.cargo, 'none');
  }
});

test('four finished windows accumulate, are collected in pairs and loaded without duplication', () => {
  const s = activityConfig.dispatch;
  assert.equal(sampleDispatch(0, s).finishedWindows, 0);
  assert.equal(sampleDispatch(9, s).finishedWindows, 1);
  assert.equal(sampleDispatch(39, s).finishedWindows, 4);
  assert.equal(sampleDispatch(s.firstPickup + 1, s).finishedWindows, 2);
  assert.equal(sampleDispatch(s.secondPickup + 1, s).finishedWindows, 0);
  assert.equal(sampleDispatch(s.firstLoaded + 1, s).loadedWindows, 2);
  assert.equal(sampleDispatch(s.secondLoaded + 1, s).loadedWindows, 4);
  for (let t = 39; t < s.duration; t += 0.25) {
    const state = sampleDispatch(t, s);
    const carried = ['window-loader-a', 'window-loader-b'].reduce((sum, id) => sum + (sampleMotion(activityConfig.routes[id], t).cargo === 'windows' ? 2 : 0), 0);
    assert.equal(state.finishedWindows + carried + state.loadedWindows, 4);
    const truck = sampleMotion(activityConfig.serviceTruck, t);
    if (carried) assert.equal(truck.moving, false, 'white truck waits for handlers');
  }
});

test('loaders disembark after arrival, board before departure, and ride away invisibly outside', () => {
  const s = activityConfig.dispatch;
  for (const id of ['window-loader-a', 'window-loader-b']) {
    assert.equal(sampleMotion(activityConfig.routes[id], 17).visible, false);
    assert.equal(sampleMotion(activityConfig.routes[id], 20).visible, true);
    assert.equal(sampleMotion(activityConfig.routes[id], s.departure + 1).visible, false);
  }
  assert.equal(sampleDispatch(20, s).passengers, 0);
  assert.equal(sampleDispatch(s.firstBoarded + 1, s).passengers, 1);
  assert.equal(sampleDispatch(s.secondBoarded + 1, s).passengers, 2);
  assert.ok(s.departure > s.secondBoarded);
});

test('Richard patrols front, workshop aisle and rear stock, rather than standing at reception', () => {
  assert.ok(!facilityConfig.workers.some(w => w.id === 'reception'));
  const route = activityConfig.routes.richard;
  assert.ok(route.frames.some(f => f.position[2] < -13));
  assert.ok(route.frames.some(f => f.position[0] < -7));
  assert.ok(route.frames.some(f => f.position[2] > 21));
  for (let t = 0; t < activityConfig.richardRoutine.patrol.duration; t += 3) assert.ok(sampleMotion(route, t).moving);
});

test('Richard alternates two and three patrols with a break at the marked front-left wall', () => {
  const { patrol, rest, laps } = activityConfig.richardRoutine;
  const route = activityConfig.routes.richard;
  assert.deepEqual(laps, [2, 3]);
  const rests = route.frames.filter(f => f.pose === 'smoke');
  assert.equal(rests.length, 2);
  assert.equal(rests[0].at, patrol.duration * 2 + 30);
  assert.equal(rests[1].at, patrol.duration * 5 + rest.duration + 30);
  assert.equal(route.duration, patrol.duration * 5 + rest.duration * 2);
  for (const frame of rests) {
    const p = sampleMotion(route, frame.at + 4);
    assert.equal(p.pose, 'smoke'); assert.equal(p.moving, false);
    assert.equal(p.x, -17.25); assert.ok(p.z > 20 && p.z < 21);
    assert.equal(p.heading, 0);
    assert.equal(sampleMotion(route, frame.at + 30).pose, 'walk');
  }
  // The approach/return remain entirely outside the front wall, using the gate.
  for (let t = 210; t < 298; t += 0.1) assert.ok(sampleMotion(route, t).z >= 20.6);
});

test('smoke rises, expands and fades in a fixed reusable pool; paused clock freezes it', () => {
  const young = sampleSmoke(0.5, 0), old = sampleSmoke(3.8, 0);
  assert.ok(old.y > young.y && old.scale > young.scale && old.opacity < young.opacity);
  assert.equal(sampleSmoke(0.1, 9).opacity, 0, 'no particles before first emission');
  const out = sampleSmoke(2, 0);
  assert.equal(sampleSmoke(2, 0, out), out);
  const frozen = { ...out };
  sampleSmoke(advanceActivityTime(2, 4, false, false), 0, out);
  assert.deepEqual(out, frozen);
  assert.ok(smokingGesture(2) > 0.99);
  assert.equal(smokingGesture(5), 0);
  for (let t = 0; t < 12; t += 0.1) {
    assert.ok(smokingGesture(t) >= 0 && smokingGesture(t) <= 1);
    for (let i = 0; i < 10; i++) {
      const p = sampleSmoke(t, i);
      assert.ok(Object.values(p).every(Number.isFinite));
      assert.ok(p.opacity >= 0 && p.opacity <= 0.35);
    }
  }
});

test('window carriers go around workshop equipment through the rear cross-aisle', () => {
  const workshop = facilityConfig.areas.workshop.position;
  const obstacles = facilityConfig.workshop.tables.map(p => ({ x: workshop[0] + p[0], z: workshop[2] + p[2], width: 4, depth: 2.5 }));
  obstacles.push({ x: workshop[0] + facilityConfig.workshop.cutter[0], z: workshop[2] + facilityConfig.workshop.cutter[2], width: 5.8, depth: 1.5 });
  for (const id of ['window-loader-a', 'window-loader-b']) {
    const route = activityConfig.routes[id];
    assert.ok(route.frames.some(f => f.position[2] < -13));
    for (let t = 18; t < activityConfig.dispatch.secondLoaded; t += 0.1) {
      const p = sampleMotion(route, t);
      for (const obstacle of obstacles) {
        assert.ok(Math.abs(p.x - obstacle.x) > obstacle.width / 2 + 0.35 || Math.abs(p.z - obstacle.z) > obstacle.depth / 2 + 0.35, `${id} must not walk through a table/cutter`);
      }
    }
  }
});
