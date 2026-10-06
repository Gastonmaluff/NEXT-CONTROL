import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import { facilityConfig } from './facilityConfig';
import { Box, Cylinder, WindowFrame } from './Primitives';
import { ActivityCargo } from './ActivityCargo';
import { activityConfig } from './activityConfig';
import { emptyMotion, sampleDispatch, sampleMotion, sampleShipment, type ActorPose } from './activityMotion';
import { useActivityClock } from './ActivityClock';
import { Person } from './Person';

function Vehicle({ v, onSupplierSelect }: { v: typeof facilityConfig.vehicles[number]; onSupplierSelect: () => void }) {
  const clock = useActivityClock();
  const root = useRef<Group>(null), glass = useRef<Group>(null), boxes = useRef<Group>(null), gate = useRef<Group>(null);
  const sample = useRef(emptyMotion());
  const shipment = useRef(sampleShipment(0, activityConfig.shipment));
  const dispatch = useRef(sampleDispatch(0, activityConfig.dispatch));
  const windows = useRef<(Group | null)[]>([]), passengers = useRef<(Group | null)[]>([]);
  const driverPose = useRef<ActorPose>('stand');
  const wheels = useRef<(Group | null)[]>([]);
  const lastTime = useRef(-1), lastX = useRef(v.position[0]), lastZ = useRef(v.position[2]), spin = useRef(0);
  useFrame((_, delta) => {
    const delivery = v.id === 'delivery';
    const result = sampleMotion(delivery ? activityConfig.truck : activityConfig.serviceTruck, clock.current, sample.current);
    if (root.current) {
      root.current.position.set(result.x, result.y, result.z);
      // Vehicles return only outside the lot, never loop visibly across the building.
      root.current.visible = Math.abs(result.x) < 38 && result.z < 36;
      if (lastTime.current !== clock.current) {
        const diff = Math.atan2(Math.sin(result.heading - root.current.rotation.y), Math.cos(result.heading - root.current.rotation.y));
        root.current.rotation.y = MathUtils.damp(root.current.rotation.y, root.current.rotation.y + diff, 7, Math.min(delta, 0.08));
      }
    }
    spin.current += Math.hypot(result.x - lastX.current, result.z - lastZ.current) / 0.52;
    lastX.current = result.x; lastZ.current = result.z; lastTime.current = clock.current;
    wheels.current.forEach(wheel => { if (wheel) wheel.rotation.x = spin.current; });
    if (delivery) {
      const load = sampleShipment(clock.current, activityConfig.shipment, shipment.current);
      if (glass.current) glass.current.visible = load.truckGlass;
      if (boxes.current) boxes.current.visible = load.truckBoxes;
      if (gate.current) gate.current.rotation.x = -Math.PI / 2 * load.gate;
    } else {
      const load = sampleDispatch(clock.current, activityConfig.dispatch, dispatch.current);
      windows.current.forEach((window, i) => { if (window) window.visible = i < load.loadedWindows; });
      passengers.current.forEach((passenger, i) => { if (passenger) passenger.visible = i < load.passengers; });
      if (gate.current) gate.current.rotation.x = -Math.PI / 2 * load.gate;
    }
  });
  return <group ref={root} name={`vehicle:${v.id}`} position={v.position} rotation={[0, v.rotation, 0]}
    onClick={v.id === 'delivery' ? event => { event.stopPropagation(); if (event.delta < 5) onSupplierSelect(); } : undefined}>
    <Box position={[0, 0.45, 0]} size={[2.6, 0.32, 6.4]} color="#536777" />
      <Box position={[0, 0.72, -0.95]} size={[2.6, 0.15, 4.3]} color="#a5b9c6" />
      {[-1, 1].map(s => <Box key={s} position={[s * 1.27, 1, -0.95]} size={[0.08, 0.42, 4.3]} color="#e4ecf2" />)}
      <group ref={gate} position={[0, 0.78, -3.1]}><Box position={[0, 0.2, 0]} size={[2.6, 0.4, 0.08]} color="#d0dce5" /></group>
      {v.id === 'delivery' ? <>
        <group ref={glass} name="shipment:glass" position={[0, 0.75, -0.55]}><ActivityCargo kind="glass" /></group>
        <group ref={boxes} name="shipment:boxes" position={[0, 0.78, -2.3]}><ActivityCargo kind="boxes" /></group>
      </> : <>
        <Box position={[0, 0.84, -1]} size={[2.2, 0.12, 3.5]} color="#7e98a5" />
        {[-1, 1].map(s => <group key={s}>
          {[-2.5, 0.5].map(z => <Box key={z} position={[s * 0.85, 1.7, z]} size={[0.08, 1.7, 0.08]} rotation={[0, 0, -s * 0.18]} color="#7895a4" />)}
          <Box position={[s * 0.7, 2.5, -1]} size={[0.07, 0.07, 3.5]} color="#7895a4" />
        </group>)}
        {[0, 1, 2, 3].map(i => <group key={i} name={`dispatch:window:${i}`} ref={group => { windows.current[i] = group; }} visible={false} position={[0, 1.75, -2.4 + i * 0.8]}><WindowFrame width={1.65} height={1.65} /></group>)}
      </>}
    <Box position={[0, 0.98, 1.8]} size={[2.5, 1.15, 1.8]} color={v.color} />
    <Box position={[0, 1.8, 2.74]} size={[2.1, 0.7, 0.035]} color="#86a9bd" opacity={0.28} />
    <Box position={[0, 2.2, 1.8]} size={[2.6, 0.1, 1.9]} color={v.color} />
    {[-1, 1].map(s => <Box key={s} position={[s * 1.2, 1.85, 1.8]} size={[0.05, 0.65, 1.6]} color="#9bc8d8" opacity={0.18} />)}
    <group position={[0, 0.8, 1.9]} scale={0.68}><Person color="#426781" pose={driverPose} seated helmet={false} /></group>
    {v.id === 'service' ? [-1, 1].map((s, i) => <group key={s} name={`dispatch:passenger:${i}`} ref={group => { passengers.current[i] = group; }} position={[s * 0.7, 0.8, 1.8]} scale={0.6}><Person color={i ? '#44877e' : '#377ead'} pose={driverPose} seated /></group>) : null}
    {[-1, 1].flatMap((x, xi) => [-1.7, 1.7].map((z, zi) => <group key={`${x}:${z}`} position={[x * 1.28, 0.55, z]} ref={wheel => { wheels.current[xi * 2 + zi] = wheel; }}>
      <Cylinder size={[0.52, 0.32, 0.52]} rotation={[0, 0, Math.PI / 2]} color="#40515f" />
      <Cylinder position={[x * 0.18, 0, 0]} size={[0.23, 0.035, 0.23]} rotation={[0, 0, Math.PI / 2]} color="#afbec9" />
      <Box position={[x * 0.2, 0, 0]} size={[0.025, 0.37, 0.05]} color="#718d9e" />
    </group>))}
    {[-0.9, 0.9].map(x => <Box key={x} position={[x, 0.95, 2.75]} size={[0.45, 0.22, 0.06]} color="#f5f7e9" />)}
    <Box position={[0, 0.65, 2.83]} size={[2.5, 0.18, 0.12]} color="#9eb0bd" />
  </group>;
}
export const Vehicles = memo(function Vehicles({ onSupplierSelect }: { onSupplierSelect: () => void }) {
  return <>{facilityConfig.vehicles.map(v => <Vehicle key={v.id} v={v} onSupplierSelect={onSupplierSelect} />)}</>;
});
