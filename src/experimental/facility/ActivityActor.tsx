import { memo, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { MathUtils, type Group } from 'three';
import { useActivityClock } from './ActivityClock';
import { emptyMotion, sampleMotion, sampleRichardSecret, type ActorPose, type ActivityRoute, type CargoKind } from './activityMotion';
import { Person } from './Person';
import { ActivityCargo, MaterialTrolley } from './ActivityCargo';
import type { Vec3 } from './types';
import { useRichardSecret } from './RichardEasterEgg';

const kinds = ['profile', 'glass', 'boxes', 'panels', 'windows', 'glass-sheet', 'box'] as const;
export const ActivityActor = memo(function ActivityActor({ id, route, color, helmet = true, trolley = false, robust = false, hairColor, smoking = false, cartParking }: { id: string; route: ActivityRoute; color: string; helmet?: boolean; trolley?: boolean; robust?: boolean; hairColor?: string; smoking?: boolean; cartParking?: { position: Vec3; heading: number } }) {
  const time = useActivityClock();
  const secret = useRichardSecret();
  const root = useRef<Group>(null), load = useRef<Group>(null);
  const cart = useRef<Group>(null);
  const cargoRefs = useRef<Partial<Record<CargoKind, Group>>>({});
  const sample = useRef(emptyMotion());
  const pose = useRef<ActorPose>('stand');
  const moving = useRef(false);
  const lastTime = useRef(-1);
  const usedCargo = useMemo(() => kinds.filter(kind => route.frames.some(frame => frame.cargo === kind)), [route]);
  useFrame((_, delta) => {
    const result = id === 'richard' && secret
      ? sampleRichardSecret(secret.current, route, time.current, sample.current)
      : sampleMotion(route, time.current, sample.current);
    pose.current = result.pose; moving.current = result.moving;
    if (root.current) {
      root.current.visible = result.visible;
      root.current.position.set(result.x, result.y, result.z);
      if (lastTime.current !== time.current) {
        const diff = Math.atan2(Math.sin(result.heading - root.current.rotation.y), Math.cos(result.heading - root.current.rotation.y));
        root.current.rotation.y = MathUtils.damp(root.current.rotation.y, root.current.rotation.y + diff, 8, Math.min(delta, 0.08));
      }
    }
    lastTime.current = time.current;
    const pushing = trolley && result.trolley;
    if (load.current) {
      load.current.position.y = (pushing ? 0.32 : 1.08) + result.lift;
      load.current.position.z = pushing ? 1.15 : 0.58;
    }
    if (cart.current && root.current) {
      if (pushing || !cartParking) {
        cart.current.position.copy(root.current.position);
        cart.current.rotation.y = root.current.rotation.y;
      } else {
        cart.current.position.set(...cartParking.position);
        cart.current.rotation.y = cartParking.heading;
      }
    }
    for (const kind of kinds) { const group = cargoRefs.current[kind]; if (group) group.visible = result.cargo === kind; }
  }, -1);
  return <><group ref={root} name={`actor:${id}`} position={route.frames[0].position} rotation={[0, route.frames[0].heading ?? 0, 0]}>
    <Person color={color} pose={pose} moving={moving} helmet={helmet} robust={robust} hairColor={hairColor} smoking={smoking} />
    <group ref={load} position={[0, trolley ? 0.32 : 1.08, trolley ? 1.15 : 0.58]}>
      {usedCargo.map(kind => <group key={kind} visible={false} name={`cargo:${kind}`} ref={group => { if (group) cargoRefs.current[kind] = group; }}><ActivityCargo kind={kind} /></group>)}
    </group>
  </group>
    {trolley ? <group ref={cart} name={`cart:${id}`} position={cartParking?.position ?? route.frames[0].position} rotation={[0, cartParking?.heading ?? 0, 0]}><MaterialTrolley /></group> : null}
  </>;
});
