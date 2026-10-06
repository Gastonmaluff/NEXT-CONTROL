import { memo } from 'react';
import { AreaSelection, type SelectionProps } from './AreaSelection';
import { facilityConfig } from './facilityConfig';
import { GlassStand, MaterialStack } from './Materials';
import { Box } from './Primitives';
import type { AreaId, MaterialFamily } from './types';

export function Rack({ width = 6, family }: { width?: number; family: MaterialFamily }) {
  const { height, depth, levels } = facilityConfig.rack;
  const steel = facilityConfig.palette.rack;
  return <group>
    {[-1, 1].flatMap(x => [-1, 1].map(z => <Box key={`${x}:${z}`} position={[x * width / 2, height / 2, z * depth / 2]} size={[0.12, height, 0.12]} color={steel} />))}
    {levels.map(y => <group key={y}>
      <Box position={[0, y, 0]} size={[width, 0.13, depth]} color="#c9d4dc" />
      <Box position={[0, y - 0.08, depth / 2]} size={[width, 0.2, 0.1]} color="#67869e" />
      <MaterialStack family={family} position={[0, y + 0.12, 0]} width={width - 0.4} />
    </group>)}
    <Box position={[-width / 2 + 0.3, 2.1, depth / 2 + 0.07]} size={[0.55, 0.25, 0.02]} color="#f3f7f9" />
  </group>;
}
const RackContents = memo(function RackContents({ family }: { family: MaterialFamily }) {
  if (family === 'glass') return <>{[-5.2, 0, 5.2].map(x => <GlassStand key={x} position={[x, 0, 0]} width={3.7} />)}</>;
  if (family === 'aluminum') return <Rack family={family} width={12} />;
  if (family === 'slats') return <><Rack family="wpc" /><MaterialStack family="slats" position={[0, 0.7, 1.8]} /></>;
  return <Rack family={family} />;
});
export function StockRacks(props: SelectionProps) {
  return <>{(['wpc', 'spc', 'slats', 'ceiling', 'glass', 'aluminum'] as const).map((id: AreaId) =>
    <AreaSelection key={id} id={id} {...props}><RackContents family={id as MaterialFamily} /></AreaSelection>)}
  </>;
}
