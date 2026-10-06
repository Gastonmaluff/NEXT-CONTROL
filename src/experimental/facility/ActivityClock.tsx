import { createContext, useContext, useRef, type Context, type ReactNode, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { advanceActivityTime } from './activityMotion';

// Keep context identity across Vite edits so cached 3D subtrees do not lose it.
const ActivityContext: Context<MutableRefObject<number>> = import.meta.hot?.data.facilityActivityContext ?? createContext<MutableRefObject<number>>({ current: 0 });
if (import.meta.hot) import.meta.hot.data.facilityActivityContext = ActivityContext;
export const useActivityClock = () => useContext(ActivityContext);
export function ActivityClock({ active, children }: { active: boolean; children: ReactNode }) {
  const time = useRef(0);
  // Negative priorities preserve automatic rendering: clock → poses → meshes.
  useFrame((_, delta) => { time.current = advanceActivityTime(time.current, delta, active, document.hidden); }, -2);
  return <ActivityContext.Provider value={time}>{children}</ActivityContext.Provider>;
}
