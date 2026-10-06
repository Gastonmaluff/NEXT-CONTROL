import { memo } from 'react';
import { AreaSelection, type SelectionProps } from './AreaSelection';
import { facilityConfig } from './facilityConfig';
import { GlassStand, MaterialStack } from './Materials';
import { Box } from './Primitives';
import { Rack } from './StockRacks';

const RawContents = memo(function RawContents() {
  return <>
    {facilityConfig.raw.stands.map((position, i) => <GlassStand key={i} position={position} width={2.3} />)}
    <group position={facilityConfig.raw.profiles}><Rack width={6} family="aluminum" /></group>
    <group position={[0, 0, -6]}><MaterialStack family="spc" width={4} /></group>
    {[-2, 0, 2].map(x => <Box key={x} position={[x, 0.5, 6]} size={[1.3, 0.9, 1.2]} color="#baa589" />)}
  </>;
});
export function RawMaterialsWarehouse(props: SelectionProps) {
  return <AreaSelection id="raw" {...props}><RawContents /></AreaSelection>;
}
