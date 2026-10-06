import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { MathUtils, MeshBasicMaterial, type MeshStandardMaterial } from 'three';
import { areaById } from './facilityAreas';
import { facilityConfig } from './facilityConfig';
import { useSceneResources } from './Primitives';
import type { AreaId } from './types';

export interface SelectionProps { selected: AreaId | null; hovered: AreaId | null; onSelect: (id: AreaId) => void; onHover: (id: AreaId | null) => void; }
export function AreaSelection({ id, children, selected, hovered, onSelect, onHover }: SelectionProps & { id: AreaId; children: ReactNode }) {
  const layout = facilityConfig.areas[id];
  const data = areaById[id];
  const resources = useSceneResources();
  const highlight = useRef<MeshStandardMaterial>(null);
  const border = useMemo(() => new MeshBasicMaterial({ color: data.accent, transparent: true, opacity: 0, depthWrite: false }), [data.accent]);
  useEffect(() => () => border.dispose(), [border]);
  const active = selected === id;
  const over = hovered === id;
  useFrame((state, delta) => {
    if (!highlight.current) return;
    const target = active ? 0.26 : over ? 0.14 : 0.035;
    const next = MathUtils.damp(highlight.current.opacity, target, 9, delta);
    if (Math.abs(next - target) > 0.001) state.invalidate();
    highlight.current.opacity = next;
    const edgeTarget = active ? 0.9 : over ? 0.45 : 0;
    border.opacity = MathUtils.damp(border.opacity, edgeTarget, 9, delta);
    if (Math.abs(border.opacity - edgeTarget) > 0.001) state.invalidate();
  });
  return <group position={layout.position}
    onPointerOver={event => { event.stopPropagation(); onHover(id); }}
    onPointerOut={() => onHover(null)}
    onClick={event => { event.stopPropagation(); if (event.delta < 5) onSelect(id); }}>
    <mesh geometry={resources.box} position={[0, 0.055, 0]} scale={[layout.size[0], 0.06, layout.size[1]]} dispose={null}>
      <meshStandardMaterial ref={highlight} color={data.accent} transparent opacity={0.035} depthWrite={false} />
    </mesh>
    {[-1, 1].map(s => <group key={s} dispose={null}>
      <mesh geometry={resources.box} material={border} position={[s * layout.size[0] / 2, 0.12, 0]} scale={[0.07, 0.025, layout.size[1]]} />
      <mesh geometry={resources.box} material={border} position={[0, 0.12, s * layout.size[1] / 2]} scale={[layout.size[0], 0.025, 0.07]} />
    </group>)}
    {children}
    {over || active ? <Html position={[0, 8.9, 0]} center style={{ pointerEvents: 'none' }} zIndexRange={[5, 0]}><span className="facility-label">{data.shortLabel}</span></Html> : null}
  </group>;
}
