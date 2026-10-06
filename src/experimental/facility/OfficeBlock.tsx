import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Box, Cylinder } from './Primitives';
import { AreaSelection, type SelectionProps } from './AreaSelection';
import { facilityConfig } from './facilityConfig';
import type { Vec3 } from './types';
import { OfficeDoor } from './OfficeDoor';
import { Person } from './Person';
import { useActivityClock } from './ActivityClock';
import { ease, loopTime, type ActorPose } from './activityMotion';
import { activityConfig } from './activityConfig';
import { ActivityActor } from './ActivityActor';

function Desk({ position }: { position: Vec3 }) {
  return <group position={position}>
    <Box position={[0, 1.1, 0]} size={[2.5, 0.12, 1.2]} color="#c5b49a" />
    {[-1, 1].map(s => <Box key={s} position={[s, 0.52, 0]} size={[0.1, 1.04, 0.8]} color="#7f929e" />)}
    <Box position={[0.35, 1.48, -0.3]} size={[0.9, 0.58, 0.07]} color="#344e66" />
    <Box position={[0.35, 1.22, -0.3]} size={[0.09, 0.3, 0.1]} color="#344e66" />
    <Box position={[-0.6, 1.2, 0.1]} size={[0.55, 0.03, 0.4]} color="#eef3f8" />
    <Box position={[0, 0.58, 1.05]} size={[0.65, 0.12, 0.6]} color="#50748c" />
    <Box position={[0, 0.96, 1.29]} size={[0.65, 0.7, 0.1]} color="#50748c" />
    <Cylinder position={[0, 0.3, 1.05]} size={[0.1, 0.5, 0.1]} color="#647989" />
  </group>;
}
function OfficeStaff({ id, position, phase, visitorHeading }: { id: string; position: Vec3; phase: number; visitorHeading?: number }) {
  const clock = useActivityClock();
  const pose = useRef<ActorPose>('work');
  const chair = useRef<Group>(null);
  useFrame(() => {
    const t = loopTime(clock.current + phase, 32);
    pose.current = t > 11 && t < 20 ? 'talk' : 'work';
    if (chair.current && visitorHeading !== undefined) {
      const turn = Math.atan2(Math.sin(visitorHeading - Math.PI), Math.cos(visitorHeading - Math.PI));
      chair.current.rotation.y = Math.PI + turn * ease((t - 11) / 1.2) * (1 - ease((t - 19) / 1.2));
    }
  }, -1);
  return <group ref={chair} name={`office-staff:${id}`} position={[position[0], 0.2, position[2] + 1.04]} rotation={[0, Math.PI, 0]}><Person color="#607d98" pose={pose} helmet={false} seated phase={phase} /></group>;
}
const OfficeContents = memo(function OfficeContents({ id, desks, door }: typeof facilityConfig.offices[number]) {
  const { size } = facilityConfig.areas[id];
  const [width, depth] = size;
  return <group>
    <Box position={[0, 0.15, 0]} size={[width, 0.2, depth]} color="#e8eef4" />
    {/* Low partitions expose all three offices from the cutaway camera. */}
    <Box position={[0, 0.7, -depth / 2]} size={[width, 1.1, 0.12]} color="#d4e1eb" />
    <Box position={[width / 2, 0.7, 0]} size={[0.12, 1.1, depth]} color="#d4e1eb" />
    {door.wall === 'left' ? <>
      <OfficeDoor id={id} span={depth} position={[-width / 2, 0.25, 0]} rotation={[0, Math.PI / 2, 0]} center={-door.offset} width={door.width} phase={id === 'sales' ? activityConfig.officeVisitors.sales.offset : 0} />
      <Box position={[0, 1.6, depth / 2]} size={[width, 2.7, 0.06]} color="#b9dbe6" opacity={0.2} />
      <Box position={[0, 2.95, depth / 2]} size={[width, 0.07, 0.07]} color="#7196ac" />
    </> : <>
      <Box position={[-width / 2, 1.6, 0]} size={[0.06, 2.7, depth]} color="#b9dbe6" opacity={0.22} />
      <OfficeDoor id={id} span={width} position={[0, 0.25, depth / 2]} center={door.offset} width={door.width} moving={false} />
    </>}
    {desks.map((p, i) => <group key={i}><Desk position={p} /><OfficeStaff id={`${id}:${i}`} position={p} phase={id === 'administration' && i === 2 ? 0 : i * 3 + (id === 'sales' ? 8 : 0)} visitorHeading={id === 'sales' ? -1.07 : id === 'administration' && i === 2 ? 1.03 : undefined} /></group>)}
    {id === 'administration' || id === 'sales' ? <ActivityActor id={`office-visitor:${id}`} route={activityConfig.officeVisitors[id]} color="#527d91" helmet={false} /> : null}
    <Box position={[width / 2 - 0.5, 1.1, -depth / 2 + 0.5]} size={[0.7, 2, 0.6]} color="#f4f6f8" />
    <Cylinder position={[-width / 2 + 0.6, 0.5, -depth / 2 + 0.6]} size={[0.3, 0.65, 0.3]} color="#b0b8b4" />
    <Cylinder position={[-width / 2 + 0.6, 1.1, -depth / 2 + 0.6]} size={[0.48, 0.85, 0.48]} color="#5a9380" />
  </group>;
});
export function OfficeBlock(props: SelectionProps) {
  return <>{facilityConfig.offices.map(office => <AreaSelection key={office.id} id={office.id} {...props}><OfficeContents {...office} /></AreaSelection>)}</>;
}
