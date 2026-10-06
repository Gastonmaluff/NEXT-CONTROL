import { useCallback, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { NoToneMapping, SRGBColorSpace } from 'three';
import { ResourcesContext, useResources } from './Primitives';
import { FacilityBuilding } from './FacilityBuilding';
import { Neighborhood } from './Neighborhood';
import { OfficeBlock } from './OfficeBlock';
import { ProductionWorkshop } from './ProductionWorkshop';
import { RawMaterialsWarehouse } from './RawMaterialsWarehouse';
import { StockRacks } from './StockRacks';
import { Vehicles } from './Vehicles';
import { CivilTraffic } from './CivilTraffic';
import { Workers } from './Workers';
import { ActivityClock } from './ActivityClock';
import { RichardEasterEgg } from './RichardEasterEgg';
import { ReceivingBay } from './ReceivingBay';
import { FinishedWindows } from './FinishedWindows';
import { CameraController } from './CameraController';
import { facilityConfig } from './facilityConfig';
import type { CameraCommand, SceneTelemetry } from './types';
import type { SelectionProps } from './AreaSelection';

function AmbientFrames({ active }: { active: boolean }) {
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => {
    if (!active) return;
    // Cap idle industrial motion at 30fps; no hidden-tab animation or permanent render loop.
    const timer = window.setInterval(() => { if (!document.hidden) invalidate(); }, 1000 / 30);
    return () => window.clearInterval(timer);
  }, [active, invalidate]);
  return null;
}
function SceneContents({ animate, command, onTelemetry, onSupplierSelect, ...selection }: SceneProps) {
  const resources = useResources();
  useEffect(() => () => resources.dispose(), [resources]);
  return <ResourcesContext.Provider value={resources}><ActivityClock active={animate}><RichardEasterEgg>
    <color attach="background" args={['#f0f5f8']} />
    <ambientLight intensity={1.65} />
    <directionalLight position={[-20, 35, 25]} intensity={2.2} />
    <directionalLight position={[15, 18, -20]} intensity={0.65} color="#b2d7ef" />
    <Neighborhood />
    <FacilityBuilding {...selection} />
    <OfficeBlock {...selection} />
    <ProductionWorkshop {...selection} animate={animate} />
    <RawMaterialsWarehouse {...selection} />
    <StockRacks {...selection} />
    <Vehicles onSupplierSelect={onSupplierSelect} />
    <CivilTraffic />
    <Workers />
    <ReceivingBay />
    <FinishedWindows />
    <CameraController command={command} onTelemetry={onTelemetry} />
    <AmbientFrames active={animate} />
  </RichardEasterEgg></ActivityClock></ResourcesContext.Provider>;
}
function ContextLossHandler({ onFailure }: { onFailure: () => void }) {
  const canvas = useThree(state => state.gl.domElement);
  useEffect(() => {
    const lost = (event: Event) => { event.preventDefault(); onFailure(); };
    canvas.addEventListener('webglcontextlost', lost);
    return () => canvas.removeEventListener('webglcontextlost', lost);
  }, [canvas, onFailure]);
  return null;
}
interface SceneProps extends SelectionProps { animate: boolean; command: CameraCommand; onTelemetry: (value: SceneTelemetry) => void; onSupplierSelect: () => void; }
export default function FacilityScene({ onFailure, ...props }: SceneProps & { onFailure: () => void }) {
  const created = useCallback(({ gl }: { gl: import('three').WebGLRenderer }) => {
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMapping = NoToneMapping;
  }, []);
  return <Canvas orthographic camera={{ position: facilityConfig.camera.position, zoom: 8, near: 0.1, far: 200 }}
    dpr={[1, 1.5]} frameloop="demand" gl={{ antialias: true, powerPreference: 'low-power' }} onCreated={created}
    onContextMenu={event => event.preventDefault()}
    style={{ cursor: props.hovered ? 'pointer' : 'grab', touchAction: 'none' }}>
    <SceneContents {...props} />
    <ContextLossHandler onFailure={onFailure} />
  </Canvas>;
}
