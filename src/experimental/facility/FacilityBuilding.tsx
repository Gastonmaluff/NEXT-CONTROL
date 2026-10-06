import { memo, useEffect, useMemo } from 'react';
import { Html } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, MeshStandardMaterial, type OrthographicCamera } from 'three';
import { facilityConfig, fitZoom, roofOpacity } from './facilityConfig';
import { AreaSelection, type SelectionProps } from './AreaSelection';
import { Box, useSceneResources } from './Primitives';
import { FacilityRoof } from './FacilityRoof';

function ExteriorWalls() {
  const { camera, size } = useThree();
  const r = useSceneResources();
  const { width, depth, wallHeight } = facilityConfig.building;
  const material = useMemo(() => new MeshStandardMaterial({ color: facilityConfig.palette.wall, roughness: 0.85, transparent: true, depthWrite: false }), []);
  useEffect(() => () => material.dispose(), [material]);
  useFrame((state, delta) => {
    const target = 0.15 + 0.85 * roofOpacity((camera as OrthographicCamera).zoom / fitZoom(size.width, size.height));
    material.opacity = MathUtils.damp(material.opacity, target, 7, delta);
    if (Math.abs(material.opacity - target) > 0.001) state.invalidate();
  });
  return <group dispose={null}>
    {[-1, 1].map(s => <mesh key={s} geometry={r.box} material={material} position={[s * width / 2, wallHeight / 2, 0]} scale={[0.18, wallHeight, depth]} raycast={() => {}} />)}
    <mesh geometry={r.box} material={material} position={[0, wallHeight / 2, -depth / 2]} scale={[width, wallHeight, 0.18]} raycast={() => {}} />
    <mesh geometry={r.box} material={material} position={[-14, wallHeight / 2, depth / 2]} scale={[8, wallHeight, 0.18]} raycast={() => {}} />
    <mesh geometry={r.box} material={material} position={[12, wallHeight / 2, depth / 2]} scale={[12, wallHeight, 0.18]} raycast={() => {}} />
    <mesh geometry={r.box} material={material} position={[-2, 6.1, depth / 2]} scale={[16, 1.8, 0.18]} raycast={() => {}} />
  </group>;
}
const Structure = memo(function Structure() {
  const { width, depth, wallHeight, columnSpacing } = facilityConfig.building;
  return <>
    {[-1, 1].flatMap(s => Array.from({ length: depth / columnSpacing + 1 }, (_, i) => <Box key={`${s}:${i}`} position={[s * (width / 2 - 0.15), wallHeight / 2, -depth / 2 + i * columnSpacing]} size={[0.22, wallHeight, 0.22]} color={facilityConfig.palette.steel} />))}
    <Box position={[0, 0, 0]} size={[width + 0.6, 0.14, depth + 0.6]} color={facilityConfig.palette.concrete} />
    <Box position={[2.9, 0.08, 0]} size={[2.5, 0.025, depth - 2]} color="#e4ebf1" />
    <Box position={[0, 0.08, -13.9]} size={[width - 1, 0.025, 1.9]} color="#e4ebf1" />
    <Box position={[-7.2, 0.08, 2]} size={[1.7, 0.025, 32]} color="#e4ebf1" />
    {[-1, 1].map(s => <Box key={s} position={[s * 18, 0.34, 0]} size={[0.24, 0.6, 40]} color="#b9cbd6" />)}
  </>;
});
function Entrance(props: SelectionProps) {
  return <AreaSelection id="entrance" {...props}>
    <Box position={[0, -0.09, 0]} size={[32, 0.12, 9]} color="#d5e1e9" />
    {Array.from({ length: 6 }, (_, i) => <Box key={i} position={[3, 0.03, -3 + i * 0.9]} size={[3.2, 0.02, 0.35]} color="#f9fbfc" />)}
    <Box position={[-7, 0.04, 0]} size={[0.1, 0.02, 9]} color="#f1f6fa" />
    <Box position={[8, 0.04, 0]} size={[0.1, 0.02, 9]} color="#f1f6fa" />
    <Box position={[3, 0.14, -4.5]} size={[2.8, 0.15, 1.2]} color="#b0c2d0" />
  </AreaSelection>;
}
export function FacilityBuilding(props: SelectionProps) {
  return <>
    <Box position={facilityConfig.site.center} size={[facilityConfig.site.width, 0.18, facilityConfig.site.depth]} color={facilityConfig.palette.ground} />
    <Structure />
    <ExteriorWalls />
    <FacilityRoof />
    <Entrance {...props} />
    <Html position={[0, 0.2, 32]} center style={{ pointerEvents: 'none' }} zIndexRange={[3, 0]}><span className="facility-front-label">FRENTE / ACCESO ↑</span></Html>
  </>;
}
