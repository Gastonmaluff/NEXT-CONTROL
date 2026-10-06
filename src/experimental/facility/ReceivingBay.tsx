import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useActivityClock } from './ActivityClock';
import { activityConfig } from './activityConfig';
import { sampleShipment } from './activityMotion';
import { ActivityCargo } from './ActivityCargo';
import { Box } from './Primitives';

export const ReceivingBay = memo(function ReceivingBay() {
  const clock = useActivityClock();
  const glass = useRef<Group>(null), boxes = useRef<Group>(null);
  const shipment = useRef(sampleShipment(0, activityConfig.shipment));
  useFrame(() => {
    const load = sampleShipment(clock.current, activityConfig.shipment, shipment.current);
    if (glass.current) glass.current.visible = load.receivedGlass;
    if (boxes.current) boxes.current.visible = load.receivedBoxes;
  });
  return <>
    <Box position={[0, 0.105, 31.5]} size={[46, 0.025, 4.5]} color="#cad9e3" />
    {Array.from({ length: 10 }, (_, i) => <Box key={i} position={[-20 + i * 4.4, 0.123, 31.5]} size={[1.8, 0.015, 0.075]} color="#eff5f9" />)}
    <Box position={[-11.5, 0.12, 24.5]} size={[5, 0.025, 0.08]} color="#80a5ba" />
    <group ref={glass} visible={false} name="received:glass" position={activityConfig.receivedGlass}><ActivityCargo kind="glass" /></group>
    <group name="sorting:glass-rack" position={[-5.4, 0, -3]}><ActivityCargo kind="glass" /></group>
    <group ref={boxes} visible={false} name="received:boxes" position={activityConfig.receivedBoxes}><ActivityCargo kind="boxes" /></group>
  </>;
});
