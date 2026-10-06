import { useEffect, useRef } from 'react';
import { OrbitControls } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { MathUtils, Vector3, MOUSE, TOUCH, type OrthographicCamera } from 'three';
import type { OrbitControls as Controls } from 'three-stdlib';
import { facilityConfig, fitZoom, roofOpacity } from './facilityConfig';
import type { CameraCommand, SceneTelemetry } from './types';

const offset = new Vector3();
const deltaTarget = new Vector3();
export function CameraController({ command, onTelemetry }: { command: CameraCommand; onTelemetry: (value: SceneTelemetry) => void }) {
  const { camera: baseCamera, size, invalidate } = useThree();
  const camera = baseCamera as OrthographicCamera;
  const controls = useRef<Controls>(null);
  const motion = useRef<{ target: Vector3; position: Vector3; zoom: number } | null>(null);
  const lastReport = useRef(0);
  const baseline = fitZoom(size.width, size.height);
  const config = facilityConfig.camera;
  useEffect(() => {
    camera.zoom = baseline;
    camera.position.set(...config.position);
    camera.updateProjectionMatrix();
    controls.current?.target.set(...config.target);
    controls.current?.update();
    invalidate();
  }, [baseline, camera, config, invalidate]);
  useEffect(() => {
    if (!controls.current) return;
    const home = command.type === 'home';
    const target = home ? new Vector3(...config.target) : command.type === 'area' && command.area ? new Vector3(...facilityConfig.areas[command.area].position) : controls.current.target.clone();
    target.x = MathUtils.clamp(target.x, -config.panX, config.panX);
    target.z = MathUtils.clamp(target.z, -config.panZ, config.panZ);
    target.y = 0;
    const zoom = home ? baseline : command.type === 'area' ? baseline * config.focusZoom : MathUtils.clamp(camera.zoom * (command.factor ?? 1), baseline * config.minZoom, baseline * config.maxZoom);
    offset.copy(camera.position).sub(controls.current.target);
    motion.current = { target, position: home ? new Vector3(...config.position) : target.clone().add(offset), zoom };
    invalidate();
  }, [command, baseline, camera, config, invalidate]);
  useFrame((state, delta) => {
    const orbit = controls.current;
    if (!orbit) return;
    if (motion.current) {
      const goal = motion.current;
      const alpha = 1 - Math.exp(-config.smoothing * Math.min(delta, 0.1));
      orbit.target.lerp(goal.target, alpha);
      camera.position.lerp(goal.position, alpha);
      camera.zoom = MathUtils.lerp(camera.zoom, goal.zoom, alpha);
      camera.updateProjectionMatrix();
      orbit.update();
      if (camera.position.distanceTo(goal.position) < 0.015 && Math.abs(camera.zoom - goal.zoom) < 0.005) motion.current = null;
      else state.invalidate();
    }
    // Keep panning inside the property, even when the pointer leaves the canvas.
    deltaTarget.copy(orbit.target);
    orbit.target.x = MathUtils.clamp(orbit.target.x, -config.panX, config.panX);
    orbit.target.z = MathUtils.clamp(orbit.target.z, -config.panZ, config.panZ);
    orbit.target.y = 0;
    deltaTarget.sub(orbit.target);
    camera.position.sub(deltaTarget);
    if (state.clock.elapsedTime - lastReport.current > 0.15) {
      lastReport.current = state.clock.elapsedTime;
      const zoom = camera.zoom / baseline;
      onTelemetry({ zoom: Math.round(zoom * 100), roof: Math.round(roofOpacity(zoom) * 100) });
    }
  });
  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.12}
    enablePan screenSpacePanning={false} zoomSpeed={0.65} panSpeed={0.65} rotateSpeed={0.4}
    minZoom={baseline * config.minZoom} maxZoom={baseline * config.maxZoom}
    minPolarAngle={config.minPolar} maxPolarAngle={config.maxPolar}
    minAzimuthAngle={config.minAzimuth} maxAzimuthAngle={config.maxAzimuth}
    mouseButtons={{ LEFT: MOUSE.PAN, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.ROTATE }}
    touches={{ ONE: TOUCH.PAN, TWO: TOUCH.DOLLY_PAN }}
    onStart={() => { motion.current = null; }} />;
}
