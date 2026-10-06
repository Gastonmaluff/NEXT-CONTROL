import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { AreaSelection, type SelectionProps } from './AreaSelection';
import { facilityConfig } from './facilityConfig';
import { GlassStand } from './Materials';
import { Box, Cylinder, WindowFrame } from './Primitives';
import type { Vec3 } from './types';
import { useActivityClock } from './ActivityClock';

function WorkTable({ position, assembled }: { position: Vec3; assembled: boolean }) {
  return <group position={position}>
    <Box position={[0, 1.05, 0]} size={[4, 0.18, 2.5]} color="#bac7ce" />
    {[-1, 1].flatMap(x => [-1, 1].map(z => <Box key={`${x}:${z}`} position={[x * 1.6, 0.5, z]} size={[0.12, 1, 0.12]} color="#51748b" />))}
    {assembled ? <group position={[0, 1.2, 0]} rotation={[-Math.PI / 2, 0, 0]}><WindowFrame width={2.9} height={1.6} /></group> : <>
      <Box position={[0, 1.2, -0.3]} size={[3.3, 0.1, 0.14]} color="#869fac" />
      <Box position={[0, 1.2, 0.3]} size={[3.3, 0.1, 0.14]} color="#869fac" />
    </>}
    <Box position={[1.5, 1.22, 0.7]} size={[0.35, 0.16, 0.28]} color="#2878ba" />
  </group>;
}
function CuttingMachine({ animate }: { animate: boolean }) {
  const carriage = useRef<Group>(null);
  const clock = useActivityClock();
  useFrame(() => {
    if (!animate || !carriage.current) return;
    carriage.current.position.x = Math.sin(clock.current * 0.65) * 0.65;
  });
  return <group position={facilityConfig.workshop.cutter}>
    <Box position={[0, 0.65, 0]} size={[4.4, 1.2, 1.4]} color="#7093a8" />
    <Box position={[0, 1.35, 0]} size={[5.2, 0.14, 1.5]} color="#c4d1d9" />
    <Box position={[0, 1.5, 0]} size={[5.8, 0.1, 0.18]} color="#b3c2cf" />
    <group ref={carriage}>
      <Box position={[0, 1.8, 0]} size={[0.9, 0.65, 1]} color="#3f6f8a" />
      <Cylinder position={[0, 1.63, 0.58]} size={[0.3, 0.05, 0.3]} rotation={[Math.PI / 2, 0, 0]} color="#9fb1be" />
      <Box position={[0.35, 2.16, 0]} size={[0.1, 0.06, 0.1]} color="#37c495" />
    </group>
  </group>;
}
const WorkshopContents = memo(function WorkshopContents({ animate }: { animate: boolean }) {
  return <>
    {facilityConfig.workshop.tables.map((position, i) => <WorkTable key={i} position={position} assembled={i !== 1} />)}
    <CuttingMachine animate={animate} />
    <GlassStand position={facilityConfig.workshop.glassStand} width={2.6} />
    <Box position={[4.8, 0.9, 4.5]} size={[1.2, 1.8, 1.5]} color="#55819a" />
    <Box position={[4.8, 1.95, 4.5]} size={[1.3, 0.12, 1.6]} color="#a8bccb" />
  </>;
});
export function ProductionWorkshop({ animate, ...selection }: SelectionProps & { animate: boolean }) {
  return <AreaSelection id="workshop" {...selection}><WorkshopContents animate={animate} /></AreaSelection>;
}
