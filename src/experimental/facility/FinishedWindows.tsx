import { memo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import { useActivityClock } from './ActivityClock';
import { activityConfig } from './activityConfig';
import { sampleDispatch } from './activityMotion';
import { Box, WindowFrame } from './Primitives';

export const FinishedWindows = memo(function FinishedWindows() {
  const clock = useActivityClock();
  const windows = useRef<(Group | null)[]>([]);
  const dispatch = useRef(sampleDispatch(0, activityConfig.dispatch));
  useFrame(() => {
    const state = sampleDispatch(clock.current, activityConfig.dispatch, dispatch.current);
    windows.current.forEach((window, i) => { if (window) window.visible = i < state.finishedWindows; });
  });
  return <group name="finished-windows" position={activityConfig.finishedWindows}>
    <Box position={[0, 0.1, 0.5]} size={[2.2, 0.2, 2.3]} color="#6a899a" />
    {[0, 1, 2, 3].map(i => <group key={i} name={`finished:window:${i}`} visible={false} ref={group => { windows.current[i] = group; }} position={[0, 1.12, i * 0.55]}><WindowFrame width={1.5} height={1.65} /></group>)}
    {[-0.9, 0.9].map(x => <Box key={x} position={[x, 1.12, 0.5]} size={[0.08, 2.1, 2.3]} color="#7895a4" />)}
  </group>;
});
