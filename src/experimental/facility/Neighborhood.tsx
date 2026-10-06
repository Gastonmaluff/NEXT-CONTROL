import { memo } from 'react';
import { useSceneResources } from './Primitives';
import { neighborhoodConfig, neighborhoodStreet, type NeighborBuilding } from './neighborhoodConfig';
import type { Vec3 } from './types';
import { SecretNeighborWindow } from './SecretNeighborWindow';
import { secretWindow } from './activityMotion';

const noRaycast = () => {};
// Unlike the depot, scenery stays opaque; only the secret window opts into hits.
function SceneryBox({ position = [0, 0, 0], size, color, rotation, name }: {
  position?: Vec3; size: Vec3; color: string; rotation?: Vec3; name?: string;
}) {
  const resources = useSceneResources();
  return <mesh name={name} geometry={resources.box} material={resources.material(color, 1)}
    position={position} scale={size} rotation={rotation} raycast={noRaycast} dispose={null} />;
}

function Neighbor({ building: b }: { building: NeighborBuilding }) {
  const resources = useSceneResources();
  const rise = 0.95;
  const slope = Math.atan2(rise, b.width / 2);
  const halfSpan = Math.hypot(b.width / 2, rise) + 0.3;
  return <group name={`neighbor:${b.id}`} position={b.plot.position}>
    <SceneryBox size={[b.plot.width, 0.18, b.plot.depth]} color="#e6edf2" />
    <group position={[b.position[0] - b.plot.position[0], 0, b.position[2] - b.plot.position[2]]}
      rotation={[0, b.frontage === 'rear' ? Math.PI : 0, 0]}>
    <SceneryBox position={[0, b.height / 2, 0]} size={[b.width, b.height, b.depth]} color={b.wallColor} />
    <group name={`neighbor-roof:${b.id}`}>
      {b.roof === 'pitched' ? <>
        {/* A solid attic fills the gable; no interior, fade material or animation hooks. */}
        <mesh geometry={resources.gable} material={resources.material(b.wallColor, 1)} position={[0, b.height, 0]}
          scale={[b.width, rise, b.depth]} raycast={noRaycast} dispose={null} />
        {[-1, 1].map(side => <group key={side} position={[side * b.width / 4, b.height + rise / 2, 0]} rotation={[0, 0, -side * slope]}>
          <SceneryBox size={[halfSpan, 0.18, b.depth + 0.6]} color={b.roofColor} />
          {[-0.35, 0, 0.35].map(fraction => <SceneryBox key={fraction} position={[0, 0.1, fraction * b.depth]}
            size={[halfSpan, 0.035, 0.08]} color="#bdc4c5" />)}
        </group>)}
        <SceneryBox position={[0, b.height + rise + 0.04, 0]} size={[0.25, 0.16, b.depth + 0.7]} color={b.roofColor} />
      </> : <>
        <SceneryBox position={[0, b.height + 0.12, 0]} size={[b.width + 0.5, 0.24, b.depth + 0.5]} color={b.roofColor} />
        <SceneryBox position={[b.width * 0.2, b.height + 0.48, -b.depth * 0.18]} size={[1.7, 0.5, 1.3]} color="#c7cdce" />
      </>}
    </group>
    {/* Closed roller door and opaque window panels: facade details, not interactive doors. */}
    <SceneryBox position={[-b.width * 0.18, 1.2, b.depth / 2 + 0.025]} size={[3, 2.4, 0.07]} color="#89969d" />
    {[0.5, 1, 1.5, 2].map(y => <SceneryBox key={y} position={[-b.width * 0.18, y, b.depth / 2 + 0.065]}
      size={[2.85, 0.025, 0.025]} color="#b4bec2" />)}
    <SceneryBox position={[b.width * 0.28, 1.85, b.depth / 2 + 0.05]} size={[1.6, 1.05, 0.08]} color="#9baeb6" />
    <SceneryBox position={[b.width * 0.28, 1.85, b.depth / 2 + 0.1]} size={[0.06, 1.05, 0.06]} color="#dbe2e4" />
    {b.id === secretWindow.neighborId
      ? <SecretNeighborWindow position={[b.width / 2 + 0.025, 2.1, -b.depth * 0.18]} />
      : <SceneryBox position={[b.width / 2 + 0.025, 2.1, -b.depth * 0.18]} size={[0.08, 0.85, 2.2]} color="#9baeb6" />}
    </group>
    {b.frontage === 'street' ? <>
      <SceneryBox position={[0, 0.12, 25.5 - b.plot.position[2]]} size={[b.plot.width, 0.06, 3]} color="#dbe2e6" />
      <SceneryBox position={[-b.width * 0.18, 0.11, 23.5 - b.plot.position[2]]} size={[3.2, 0.03, 7]} color="#ced8de" />
    </> : null}
  </group>;
}

// Independent static subtree, sharing the scene's existing geometry/material pool.
export const Neighborhood = memo(function Neighborhood() {
  return <group name="neighborhood">
    <SceneryBox position={[0, -0.2, -5]} size={[78, 0.1, 78]} color="#e9eef0" />
    {neighborhoodConfig.map(building => <Neighbor key={building.id} building={building} />)}
    {/* Contiguous lot boundaries, not gaps masquerading as side streets. */}
    {[-38, -24, 24, 38].map(x => <SceneryBox key={x} position={[x, 0.65, 1]} size={[0.12, 1.1, 52]} color="#b8c6ce" />)}
    <SceneryBox position={[0, 0.65, -25]} size={[76, 1.1, 0.12]} color="#b8c6ce" />
    {[-24, 0, 24].map(x => <SceneryBox key={`rear:${x}`} position={[x, 0.65, -32]} size={[0.12, 1.1, 14]} color="#b8c6ce" />)}
    <group name="neighborhood-street">
      <SceneryBox position={neighborhoodStreet.position} size={[neighborhoodStreet.width, 0.04, neighborhoodStreet.depth]} color="#c5d2da" />
      {[27.15, 34.85].map(z => <SceneryBox key={z} position={[0, 0.13, z]} size={[neighborhoodStreet.width, 0.02, 0.065]} color="#f5f8fa" />)}
    </group>
  </group>;
});
