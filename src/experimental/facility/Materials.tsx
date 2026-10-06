import { useLayoutEffect, useRef } from 'react';
import { InstancedMesh, Object3D } from 'three';
import { Box, useSceneResources } from './Primitives';
import type { MaterialFamily, Vec3 } from './types';
import { facilityConfig } from './facilityConfig';

const transform = new Object3D();
// One draw call per repeated stack, rather than an object per plank / box.
export function MaterialStack({ family, position = [0, 0, 0], width = 5.5 }: { family: MaterialFamily; position?: Vec3; width?: number }) {
  const ref = useRef<InstancedMesh>(null);
  const r = useSceneResources();
  const profiles = family === 'aluminum';
  const vertical = family === 'slats';
  const count = vertical ? 14 : 12;
  const color = family === 'spc' ? '#99a9b8' : profiles ? facilityConfig.palette.aluminum : family === 'ceiling' ? '#c9b99f' : facilityConfig.palette.wood;
  useLayoutEffect(() => {
    for (let i = 0; i < count; i++) {
      transform.position.set(vertical ? (i - 6.5) * 0.28 : 0, vertical ? 1.35 : 0.16 + Math.floor(i / 3) * 0.21, vertical ? 0 : (i % 3 - 1) * 0.39);
      transform.scale.set(vertical ? 0.18 : width, vertical ? 2.7 : profiles ? 0.12 : 0.17, vertical ? 0.4 : 0.32);
      transform.updateMatrix();
      ref.current!.setMatrixAt(i, transform.matrix);
    }
    ref.current!.instanceMatrix.needsUpdate = true;
  }, [count, profiles, vertical, width]);
  return <group position={position}>
    <instancedMesh ref={ref} args={[r.box, r.material(color, 1), count]} dispose={null} />
    {!vertical && !profiles ? [-1, 1].map(s => <Box key={s} position={[s * width * 0.33, 0.46, 0]} size={[0.08, 0.92, 1.18]} color="#e9dfc9" />) : null}
  </group>;
}
export function GlassStand({ position = [0, 0, 0], width = 3.3 }: { position?: Vec3; width?: number }) {
  return <group position={position}>
    <Box position={[0, 0.16, 0]} size={[width + 0.4, 0.2, 1.8]} color="#728a96" />
    {[-1, 1].map(s => <group key={s}>
      <Box position={[s * width * 0.4, 1.35, 0]} size={[0.11, 2.7, 0.15]} rotation={[0.27, 0, 0]} color="#64808e" />
      <Box position={[s * width * 0.4, 1.35, 0]} size={[0.11, 2.7, 0.15]} rotation={[-0.27, 0, 0]} color="#64808e" />
      <Box position={[0, 1.65, s * 0.46]} size={[width, 2.6, 0.05]} rotation={[s * 0.2, 0, 0]} color="#7abccc" opacity={0.52} />
      <Box position={[0, 0.43, s * 0.71]} size={[width, 0.1, 0.14]} color="#91c6d4" />
    </group>)}
  </group>;
}
