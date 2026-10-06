import { memo, useRef } from 'react';
import { facilityConfig } from './facilityConfig';
import { activityConfig } from './activityConfig';
import type { ActivityRoute, ActorPose } from './activityMotion';
import { ActivityActor } from './ActivityActor';
import { Person } from './Person';

function StationWorker({ worker }: { worker: typeof facilityConfig.workers[number] }) {
  const pose = useRef<ActorPose>('work');
  return <group position={worker.position} rotation={[0, worker.rotation, 0]} name={`actor:${worker.id}`}><Person color={worker.color} pose={pose} /></group>;
}
export const Workers = memo(function Workers() {
  const routes: Partial<Record<string, ActivityRoute>> = activityConfig.routes;
  return <>{facilityConfig.workers.map(worker => {
    const route = routes[worker.id];
    const cartParking = worker.id === 'glass-handler' || worker.id === 'cargo-handler' ? activityConfig.cartParking[worker.id] : undefined;
    return route ? <ActivityActor key={worker.id} id={worker.id} route={route} color={worker.color} trolley={!!cartParking} cartParking={cartParking} helmet={worker.id !== 'richard'} robust={worker.id === 'richard'} hairColor={worker.id === 'richard' ? '#e8c65c' : undefined} smoking={worker.id === 'richard'} /> : <StationWorker key={worker.id} worker={worker} />;
  })}</>;
});
