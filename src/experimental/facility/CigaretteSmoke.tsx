import { memo, useEffect, useMemo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { MeshBasicMaterial, type Group, type Mesh } from 'three';
import { useActivityClock } from './ActivityClock';
import { ease, sampleSmoke, smokingGesture, type ActorPose } from './activityMotion';
import { useSceneResources } from './Primitives';

const puffCount = 10;
export const CigaretteSmoke = memo(function CigaretteSmoke({ pose }: { pose: MutableRefObject<ActorPose> }) {
  const clock = useActivityClock();
  const resources = useSceneResources();
  const root = useRef<Group>(null);
  const puffs = useRef<(Mesh | null)[]>([]);
  const started = useRef(-1);
  const sample = useRef(sampleSmoke(0, 0));
  // Own fixed pool: opacity varies in-place, not in the shared material cache.
  const materials = useMemo(() => Array.from({ length: puffCount }, () => new MeshBasicMaterial({ color: '#8e9ba4', transparent: true, opacity: 0, depthWrite: false })), []);
  useEffect(() => () => materials.forEach(material => material.dispose()), [materials]);
  useFrame(() => {
    const active = pose.current === 'smoke';
    if (root.current) root.current.visible = active;
    if (!active) { started.current = -1; return; }
    if (started.current < 0) started.current = clock.current;
    const elapsed = clock.current - started.current;
    for (let i = 0; i < puffCount; i++) {
      const puff = puffs.current[i];
      if (!puff) continue;
      const s = sampleSmoke(elapsed, i, sample.current);
      puff.position.set(s.x, s.y, s.z);
      puff.scale.set(s.scale, s.scale * 1.3, s.scale);
      materials[i].opacity = s.opacity * ease(elapsed / 1.5) * (0.3 + 0.7 * smokingGesture(clock.current - s.y / 0.48));
    }
  });
  return <group ref={root} name="richard:smoke" visible={false} position={[0.06, 1.8, 0.42]}>
    {materials.map((material, i) => <mesh key={i} name={`smoke:puff:${i}`} ref={mesh => { puffs.current[i] = mesh; }} geometry={resources.sphere} material={material} dispose={null} raycast={() => {}} />)}
  </group>;
});
