import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, MeshStandardMaterial, type Group, type OrthographicCamera } from 'three';
import { facilityConfig, fitZoom, roofOpacity } from './facilityConfig';
import { useSceneResources } from './Primitives';

const ignoreRaycast = () => {};
export function FacilityRoof() {
  const group = useRef<Group>(null);
  const { width, depth, wallHeight, ridgeHeight } = facilityConfig.building;
  const { camera, size } = useThree();
  const r = useSceneResources();
  const materials = useMemo(() => ({
    roof: new MeshStandardMaterial({ color: facilityConfig.palette.roof, roughness: 0.75, transparent: true, depthWrite: false }),
    seam: new MeshStandardMaterial({ color: '#8197a7', roughness: 0.7, transparent: true, depthWrite: false }),
  }), []);
  useEffect(() => {
    group.current?.traverse(object => { object.raycast = ignoreRaycast; });
    return () => { materials.roof.dispose(); materials.seam.dispose(); };
  }, [materials]);
  useFrame((state, delta) => {
    const target = roofOpacity((camera as OrthographicCamera).zoom / fitZoom(size.width, size.height));
    const next = MathUtils.damp(materials.roof.opacity, target, facilityConfig.roof.smoothing, delta);
    materials.roof.opacity = next;
    materials.roof.depthWrite = next > 0.995;
    materials.seam.opacity = next;
    if (Math.abs(next - target) > 0.001) state.invalidate();
  });
  const rise = ridgeHeight - wallHeight;
  const slope = Math.atan2(rise, width / 2);
  const halfSpan = Math.hypot(rise, width / 2) + 0.5;
  return <group ref={group} dispose={null}>
    {[-1, 1].map(s => <group key={s} position={[s * width / 4, wallHeight + rise / 2, 0]} rotation={[0, 0, -s * slope]}>
      <mesh geometry={r.box} material={materials.roof} scale={[halfSpan, 0.14, depth + 1]} raycast={ignoreRaycast} />
      {Array.from({ length: 11 }, (_, i) => <mesh key={i} geometry={r.box} material={materials.seam} position={[0, 0.09, -20 + i * 4]} scale={[halfSpan, 0.045, 0.055]} raycast={ignoreRaycast} />)}
    </group>)}
    <mesh geometry={r.box} material={materials.seam} position={[0, ridgeHeight + 0.08, 0]} scale={[0.35, 0.15, depth + 1]} raycast={ignoreRaycast} />
  </group>;
}
