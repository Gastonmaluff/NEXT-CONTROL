import { Box, Cylinder, WindowFrame } from './Primitives';
import { GlassStand } from './Materials';
import type { CargoKind } from './activityMotion';

export function ActivityCargo({ kind }: { kind: Exclude<CargoKind, 'none'> }) {
  if (kind === 'profile') return <><Box size={[3.2, 0.09, 0.09]} color="#9bb1c0" /><Box position={[0, 0.13, 0]} size={[3.2, 0.09, 0.09]} color="#c4d3dc" /></>;
  if (kind === 'glass') return <GlassStand width={1.45} />;
  if (kind === 'glass-sheet') return <Box size={[1.3, 1.6, 0.045]} color="#7abccc" opacity={0.55} />;
  if (kind === 'box') return <>
    <Box size={[0.62, 0.48, 0.52]} color="#bea98a" />
    <Box position={[0, 0, 0.265]} size={[0.24, 0.14, 0.012]} color="#edf0e8" />
  </>;
  if (kind === 'windows') return <>{[0, 1].map(i => <group key={i} position={[0, 0, i * 0.24]}><WindowFrame width={1.5} height={1.65} /></group>)}</>;
  if (kind === 'panels') return <>
    {Array.from({ length: 5 }, (_, i) => <Box key={i} position={[0, 0.12 + i * 0.14, 0]} size={[0.9, 0.12, 2.7]} color={i % 2 ? '#b69a76' : '#c5ad8b'} />)}
    {[-0.8, 0.8].map(z => <Box key={z} position={[0, 0.37, z]} size={[0.94, 0.76, 0.055]} color="#e5dfcd" />)}
  </>;
  return <>
    <Box position={[0, 0.06, 0]} size={[1.3, 0.12, 1.3]} color="#a38764" />
    {[-0.3, 0.3].flatMap(x => [0, 1].map(y => <group key={`${x}:${y}`}>
      <Box position={[x, 0.3 + y * 0.43, 0]} size={[0.56, 0.4, 1.1]} color="#bea98a" />
      <Box position={[x, 0.3 + y * 0.43, 0.558]} size={[0.2, 0.15, 0.014]} color="#edf0e8" />
    </group>))}
  </>;
}
export function MaterialTrolley() {
  return <>
    <Box position={[0, 0.25, 1.15]} size={[1.45, 0.1, 1.65]} color="#7595a8" />
    {[-0.62, 0.62].flatMap(x => [0.55, 1.75].map(z => <Cylinder key={`${x}:${z}`} position={[x, 0.16, z]} size={[0.16, 0.09, 0.16]} rotation={[0, 0, Math.PI / 2]} color="#526e80" />))}
    {[-0.5, 0.5].map(x => <Box key={x} position={[x, 0.62, 0.4]} size={[0.06, 0.85, 0.06]} color="#54778d" />)}
    <Box position={[0, 1.03, 0.4]} size={[1.06, 0.06, 0.06]} color="#54778d" />
  </>;
}
