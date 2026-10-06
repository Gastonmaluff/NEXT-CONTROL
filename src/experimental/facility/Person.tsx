import { memo, useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, type Group } from 'three';
import { Box, Cylinder, Sphere } from './Primitives';
import { useActivityClock } from './ActivityClock';
import { smokingGesture, type ActorPose } from './activityMotion';
import { CigaretteSmoke } from './CigaretteSmoke';

export const Person = memo(function Person({ color, pose, moving, helmet = true, seated = false, phase = 0, robust = false, hairColor = '#596572', smoking = false }: { color: string; pose: MutableRefObject<ActorPose>; moving?: MutableRefObject<boolean>; helmet?: boolean; seated?: boolean; phase?: number; robust?: boolean; hairColor?: string; smoking?: boolean }) {
  const time = useActivityClock();
  const body = useRef<Group>(null), head = useRef<Group>(null);
  const leftLeg = useRef<Group>(null), rightLeg = useRef<Group>(null);
  const leftArm = useRef<Group>(null), rightArm = useRef<Group>(null);
  const cigarette = useRef<Group>(null);
  const hand = useRef(new Vector3());
  useFrame(() => {
    const t = time.current + phase;
    const walking = moving?.current ?? pose.current === 'walk';
    const gait = Math.sin(t * 5.4);
    const resting = smoking && pose.current === 'smoke';
    const draw = resting ? smokingGesture(t) : 0;
    if (body.current) { body.current.position.y = (seated ? -0.4 : 0) + (walking ? Math.abs(gait) * 0.025 : 0); body.current.rotation.x = resting ? -0.13 : pose.current === 'work' ? -0.05 : 0; }
    if (head.current) head.current.rotation.y = (pose.current === 'talk' ? 0.22 : 0.07) * Math.sin(t * 1.3);
    if (leftLeg.current) leftLeg.current.rotation.x = seated ? -1.05 : walking ? gait * 0.34 : 0;
    if (rightLeg.current) rightLeg.current.rotation.x = seated ? -1.05 : walking ? -gait * 0.34 : 0;
    const carry = pose.current === 'carry', work = pose.current === 'work', talk = pose.current === 'talk';
    if (leftArm.current) leftArm.current.rotation.x = carry ? -1.05 : work ? -0.85 + Math.sin(t * 4) * 0.08 : talk ? -0.65 + Math.sin(t * 2) * 0.24 : walking ? -gait * 0.24 : -0.1;
    if (rightArm.current) rightArm.current.rotation.x = carry ? -1.05 : work ? -0.85 - Math.sin(t * 4) * 0.08 : talk ? -0.32 + Math.cos(t * 1.7) * 0.17 : walking ? gait * 0.24 : -0.1;
    if (rightArm.current) {
      rightArm.current.rotation.z = resting ? -0.65 * draw : 0;
      if (resting) rightArm.current.rotation.x = -0.1 - 2.4 * draw;
      if (cigarette.current) {
        cigarette.current.visible = resting;
        hand.current.set(0, -0.55, 0).applyEuler(rightArm.current.rotation).add(rightArm.current.position);
        cigarette.current.position.copy(hand.current);
        cigarette.current.position.z += 0.11;
      }
    }
  });
  return <group ref={body}>
    <Cylinder position={[0, 1.2, 0]} size={[robust ? 0.36 : 0.28, 0.65, robust ? 0.26 : 0.22]} color={color} />
    {robust ? <Box position={[0, 1.43, 0]} size={[0.73, 0.24, 0.34]} color={color} /> : null}
    <group ref={head} position={[0, 1.77, 0]}>
      <Sphere size={[0.23, 0.24, 0.23]} color="#c1a992" />
      <Sphere position={[0, 0.17, 0]} size={[0.26, 0.13, 0.26]} color={helmet ? '#e8f0f5' : hairColor} />
      {!helmet && robust ? <Box position={[0.04, 0.22, 0.04]} size={[0.35, 0.12, 0.3]} rotation={[0, 0, -0.15]} color={hairColor} /> : null}
    </group>
    {[-1, 1].map(s => <group key={s}>
      <group ref={s < 0 ? leftLeg : rightLeg} position={[s * 0.14, 0.93, 0]}>
        <Cylinder position={[0, -0.42, 0]} size={[0.11, 0.85, 0.11]} color="#4d6171" />
        <Box position={[0, -0.81, 0.09]} size={[0.22, 0.15, 0.35]} color="#384d5b" />
      </group>
      <group ref={s < 0 ? leftArm : rightArm} position={[s * (robust ? 0.42 : 0.34), 1.43, 0]}>
        <Cylinder position={[0, -0.25, 0]} size={[robust ? 0.12 : 0.085, 0.5, robust ? 0.12 : 0.085]} color={color} />
        <Sphere position={[0, -0.55, 0]} size={[0.095, 0.1, 0.09]} color="#c1a992" />
      </group>
    </group>)}
    {smoking ? <>
      <group ref={cigarette} name="richard:cigarette" visible={false}>
        <Cylinder size={[0.022, 0.24, 0.022]} rotation={[Math.PI / 2, 0, 0]} color="#f1eee3" />
        <Cylinder position={[0, 0, -0.09]} size={[0.023, 0.06, 0.023]} rotation={[Math.PI / 2, 0, 0]} color="#bd9668" />
        <Sphere position={[0, 0, 0.13]} size={[0.03, 0.03, 0.03]} color="#ed8044" />
      </group>
      <CigaretteSmoke pose={pose} />
    </> : null}
  </group>;
});
