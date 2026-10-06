import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { Box, Cylinder } from './Primitives';
import { useActivityClock } from './ActivityClock';
import { civilTrafficConfig, sampleCivilTraffic, type CivilCar } from './civilTrafficConfig';

function Car({ car }: { car: CivilCar }) {
  const clock = useActivityClock();
  const root = useRef<Group>(null);
  const wheels = useRef<(Group | null)[]>([]);
  const sample = useRef(sampleCivilTraffic(0, car));
  useFrame(() => {
    const pose = sampleCivilTraffic(clock.current, car, sample.current);
    if (root.current) { root.current.position.set(pose.x, 0.13, pose.z); root.current.visible = pose.visible; }
    wheels.current.forEach(wheel => { if (wheel) wheel.rotation.x = pose.spin; });
  }, -1);
  return <group ref={root} name={`civil-car:${car.id}`} position={[sample.current.x, 0.13, car.lane]} rotation={[0, car.direction * Math.PI / 2, 0]} visible={sample.current.visible}>
    <Box position={[0, 0.5, 0]} size={[1.5, 0.5, 3.8]} color={car.color} />
    <Box position={[0, 0.8, -0.15]} size={[1.35, car.tall ? 0.75 : 0.6, car.tall ? 2.5 : 1.9]} color="#58798d" />
    <Box position={[0, car.tall ? 1.21 : 1.14, -0.15]} size={[1.42, 0.1, car.tall ? 2.55 : 2]} color={car.color} />
    {[-1, 1].map(side => <Box key={side} position={[side * 0.69, 0.9, -0.18]} size={[0.06, 0.53, 0.1]} color={car.color} />)}
    {[-0.5, 0.5].map(x => <group key={x}>
      <Box position={[x, 0.55, 1.92]} size={[0.35, 0.18, 0.045]} color="#f2efdb" />
      <Box position={[x, 0.55, -1.92]} size={[0.35, 0.16, 0.045]} color="#b46158" />
    </group>)}
    {[-1, 1].flatMap((side, index) => [-1.15, 1.15].map((z, axle) => <group key={`${side}:${z}`} position={[side * 0.74, 0.34, z]} ref={wheel => { wheels.current[index * 2 + axle] = wheel; }}>
      <Cylinder size={[0.33, 0.16, 0.33]} rotation={[0, 0, Math.PI / 2]} color="#48545d" />
      <Cylinder position={[side * 0.09, 0, 0]} size={[0.17, 0.02, 0.17]} rotation={[0, 0, Math.PI / 2]} color="#bec8ce" />
      <Box position={[side * 0.11, 0, 0]} size={[0.02, 0.25, 0.035]} color="#81939e" />
    </group>))}
  </group>;
}
export const CivilTraffic = memo(function CivilTraffic() {
  return <group name="civil-traffic">{civilTrafficConfig.cars.map(car => <Car key={car.id} car={car} />)}</group>;
});
