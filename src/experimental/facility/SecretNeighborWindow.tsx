import { memo, useRef } from 'react';
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import type { Group } from 'three';
import { useSceneResources } from './Primitives';
import { useActivityClock } from './ActivityClock';
import { useRichardSecret } from './RichardEasterEgg';
import { activityConfig } from './activityConfig';
import { registerSecretClick, requestRichardSecret, secretWindowAngle } from './activityMotion';
import type { Vec3 } from './types';

const noRaycast = () => {};
export const SecretNeighborWindow = memo(function SecretNeighborWindow({ position }: { position: Vec3 }) {
  const resources = useSceneResources();
  const time = useActivityClock(), secret = useRichardSecret();
  const invalidate = useThree(state => state.invalidate);
  const leaf = useRef<Group>(null);
  const clicks = useRef({ count: 0, startedAt: 0 });
  const click = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (registerSecretClick(clicks.current, performance.now(), event.delta > 4) && secret) {
      requestRichardSecret(secret.current, activityConfig.routes.richard, activityConfig.richardRoutine.rest, time.current);
      invalidate();
    }
  };
  useFrame(() => {
    if (leaf.current && secret) leaf.current.rotation.y = secretWindowAngle(secret.current, time.current);
  }, -1);
  return <group name="easter-egg-window" position={position} onClick={click}>
    {/* Only this fixed opening receives hits; the other neighboring meshes stay scenery. */}
    <mesh name="secret-window-hit" geometry={resources.box} material={resources.material('#425967', 1)} scale={[0.09, 0.85, 2.2]} dispose={null} />
    <group ref={leaf} name="secret-window-leaf" position={[0.06, 0, -1.1]}>
      <mesh geometry={resources.box} material={resources.material('#9baeb6', 1)} position={[0, 0, 1.1]} scale={[0.08, 0.85, 2.2]} raycast={noRaycast} dispose={null} />
      <mesh geometry={resources.box} material={resources.material('#dbe2e4', 1)} position={[0.05, 0, 1.1]} scale={[0.035, 0.85, 0.045]} raycast={noRaycast} dispose={null} />
    </group>
    {[-1, 1].map(side => <group key={side}>
      <mesh geometry={resources.box} material={resources.material('#dbe2e4', 1)} position={[0.07, side * 0.45, 0]} scale={[0.06, 0.045, 2.3]} raycast={noRaycast} dispose={null} />
      <mesh geometry={resources.box} material={resources.material('#dbe2e4', 1)} position={[0.07, 0, side * 1.12]} scale={[0.06, 0.9, 0.045]} raycast={noRaycast} dispose={null} />
    </group>)}
  </group>;
});
