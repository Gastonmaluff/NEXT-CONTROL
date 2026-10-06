import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Box } from './Primitives';
import { useActivityClock } from './ActivityClock';
import { doorAngle } from './activityMotion';
import type { Vec3 } from './types';

// Build the wall around a real opening, not a door drawn over a solid pane.
export function OfficeDoor({ id, span, position, rotation = [0, 0, 0], center, width, phase = 0, moving = true }: { id: string; span: number; position: Vec3; rotation?: Vec3; center: number; width: number; phase?: number; moving?: boolean }) {
  const clock = useActivityClock();
  const leaf = useRef<Group>(null);
  const left = span / 2 + center - width / 2;
  const right = span / 2 - center - width / 2;
  useFrame(() => { if (leaf.current) leaf.current.rotation.y = (rotation[1] ? -1 : 1) * (moving ? doorAngle(clock.current + phase) : 0.42); });
  return <group position={position} rotation={rotation} name={`office-door:${id}`}>
    <Box position={[-span / 2 + left / 2, 1.35, 0]} size={[left, 2.7, 0.06]} color="#b9dbe6" opacity={0.22} />
    <Box position={[span / 2 - right / 2, 1.35, 0]} size={[right, 2.7, 0.06]} color="#b9dbe6" opacity={0.22} />
    <Box position={[center, 2.55, 0]} size={[width, 0.3, 0.06]} color="#b9dbe6" opacity={0.22} />
    <Box position={[0, 2.7, 0]} size={[span, 0.07, 0.09]} color="#7196ac" />
    {[-1, 1].map(s => <Box key={s} position={[center + s * width / 2, 1.2, 0]} size={[0.07, 2.4, 0.1]} color="#65889d" />)}
    <Box position={[center, 2.4, 0]} size={[width, 0.07, 0.1]} color="#65889d" />
    <Box position={[center, -0.09, 0.15]} size={[width + 0.15, 0.15, 0.55]} color="#c8d6df" />
    <group ref={leaf} position={[center - width / 2, 0, 0]} name={`door-leaf:${id}`}>
      <Box position={[width / 2, 1.2, 0]} size={[width - 0.07, 2.35, 0.045]} color="#9fc6d5" opacity={0.35} />
      {[-1, 1].map(s => <Box key={s} position={[width / 2, 1.2 + s * 1.15, 0]} size={[width, 0.055, 0.07]} color="#7996a7" />)}
      <Box position={[width - 0.05, 1.2, 0]} size={[0.055, 2.35, 0.07]} color="#7996a7" />
      <Box position={[0.035, 1.2, 0]} size={[0.055, 2.35, 0.07]} color="#7996a7" />
      <Box position={[width - 0.18, 1.08, 0.085]} size={[0.06, 0.28, 0.08]} color="#4c6e84" />
    </group>
  </group>;
}
