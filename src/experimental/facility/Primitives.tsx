import { createContext, useContext, useMemo } from 'react';
import { BoxGeometry, BufferGeometry, CylinderGeometry, Float32BufferAttribute, MeshStandardMaterial, SphereGeometry } from 'three';
import type { Vec3 } from './types';

function createResources() {
  const vertices = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 1, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5]];
  const faces = [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 4];
  const gable = new BufferGeometry();
  gable.setAttribute('position', new Float32BufferAttribute(faces.flatMap(index => vertices[index]), 3));
  gable.computeVertexNormals();
  const geometries = { box: new BoxGeometry(1, 1, 1), cylinder: new CylinderGeometry(1, 1, 1, 12), sphere: new SphereGeometry(1, 12, 8), gable };
  const materials = new Map<string, MeshStandardMaterial>();
  return {
    ...geometries,
    material(color: string, opacity: number) {
      const key = `${color}:${opacity}`;
      if (!materials.has(key)) materials.set(key, new MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.08, transparent: opacity < 1, opacity, depthWrite: opacity === 1 }));
      return materials.get(key)!;
    },
    dispose() { Object.values(geometries).forEach(g => g.dispose()); materials.forEach(m => m.dispose()); },
  };
}
export type SceneResources = ReturnType<typeof createResources>;
export const ResourcesContext = createContext<SceneResources | null>(null);
export const useSceneResources = () => useContext(ResourcesContext)!;
export function useResources() { return useMemo(createResources, []); }

interface ShapeProps { position?: Vec3; size: Vec3; color: string; rotation?: Vec3; opacity?: number; }
export function Box({ position = [0, 0, 0], size, color, rotation, opacity = 1 }: ShapeProps) {
  const r = useSceneResources();
  return <mesh geometry={r.box} material={r.material(color, opacity)} position={position} scale={size} rotation={rotation} dispose={null} />;
}
export function Cylinder({ position = [0, 0, 0], size, color, rotation, opacity = 1 }: ShapeProps) {
  const r = useSceneResources();
  return <mesh geometry={r.cylinder} material={r.material(color, opacity)} position={position} scale={size} rotation={rotation} dispose={null} />;
}
export function Sphere({ position = [0, 0, 0], size, color }: ShapeProps) {
  const r = useSceneResources();
  return <mesh geometry={r.sphere} material={r.material(color, 1)} position={position} scale={size} dispose={null} />;
}
export function WindowFrame({ position = [0, 0, 0], width = 2.2, height = 1.8 }: { position?: Vec3; width?: number; height?: number }) {
  return <group position={position}>
    <Box size={[width, height, 0.045]} color="#a2d1de" opacity={0.35} />
    {[-1, 1].map(s => <group key={s}>
      <Box position={[s * width / 2, 0, 0]} size={[0.07, height + 0.1, 0.12]} color="#819ba9" />
      <Box position={[0, s * height / 2, 0]} size={[width, 0.07, 0.12]} color="#819ba9" />
    </group>)}
    <Box size={[0.05, height, 0.1]} color="#819ba9" />
  </group>;
}
