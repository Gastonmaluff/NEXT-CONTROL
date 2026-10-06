import { Component, Suspense, lazy, memo, useCallback, useEffect, useState, type ReactNode } from 'react';
import { Box, MonitorOff, Scan } from 'lucide-react';
import { FacilityHUD } from './FacilityHUD';
import { FacilityInfoPanel } from './FacilityInfoPanel';
import { useFacilityFullscreen } from './useFacilityFullscreen';
import type { AreaId, FacilityTargetId, CameraCommand, SceneTelemetry } from './types';
import './facility.css';

const FacilityScene = memo(lazy(() => import('./FacilityScene')));
function webglAvailable() {
  try {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('webgl2');
    if (!context) return false;
    context.getExtension('WEBGL_lose_context')?.loseContext();
    return true;
  } catch { return false; }
}
class SceneBoundary extends Component<{ children: ReactNode; onFailure: () => void }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { this.props.onFailure(); }
  render() { return this.state.failed ? null : this.props.children; }
}
function SceneFallback() {
  return <div className="facility-fallback" role="status"><MonitorOff size={36} strokeWidth={1.4} /><h2>La vista 3D no está disponible</h2><p>Tu navegador no pudo iniciar WebGL. Podés elegir los sectores desde el panel y abrir sus módulos normalmente.</p></div>;
}
export default function InteractiveFacilityView() {
  const [available, setAvailable] = useState(webglAvailable);
  const [selected, setSelected] = useState<FacilityTargetId | null>(null);
  const [hovered, setHovered] = useState<AreaId | null>(null);
  const { workspace, fullscreen, toggle, leave } = useFacilityFullscreen();
  const [animate, setAnimate] = useState(() => !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [command, setCommand] = useState<CameraCommand>({ type: 'home', sequence: 0 });
  const [telemetry, setTelemetry] = useState<SceneTelemetry>({ zoom: 100, roof: 100 });
  const onSelect = useCallback((id: FacilityTargetId) => {
    setSelected(id);
    setHovered(null);
    if (id !== 'delivery') setCommand(prev => ({ type: 'area', area: id, sequence: prev.sequence + 1 }));
  }, []);
  const onSupplierSelect = useCallback(() => onSelect('delivery'), [onSelect]);
  const onHome = useCallback(() => {
    setSelected(null); setHovered(null);
    setCommand(prev => ({ type: 'home', sequence: prev.sequence + 1 }));
  }, []);
  const onZoom = useCallback((factor: number) => setCommand(prev => ({ type: 'zoom', factor, sequence: prev.sequence + 1 })), []);
  const onTelemetry = useCallback((value: SceneTelemetry) => setTelemetry(prev => prev.zoom === value.zoom && prev.roof === value.roof ? prev : value), []);
  const onFailure = useCallback(() => { setAvailable(false); setHovered(null); }, []);
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape' && !fullscreen) onHome(); };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onHome, fullscreen]);
  return <section className="facility-page">
    <header className="facility-page-header"><div><div className="facility-eyebrow"><Scan size={15} />ACCESOS DEL SISTEMA</div><h1>Vista Interactiva</h1><p>RIJAR <span> / </span> Navegación por las instalaciones</p></div><div className="facility-header-tag"><Box size={16} /> Maqueta industrial</div></header>
    <div ref={workspace} className={`facility-workspace${fullscreen ? ' is-expanded' : ''}${selected ? ' has-sector' : ''}`} role={fullscreen ? 'dialog' : undefined} aria-modal={fullscreen ? true : undefined} aria-label={fullscreen ? 'Vista interactiva en pantalla completa' : undefined}>
      <div className="facility-viewport" role="region" aria-label="Maqueta 3D interactiva de las instalaciones de Rijar">
        {available ? <SceneBoundary onFailure={onFailure}><Suspense fallback={<div className="facility-loading" role="status"><Scan size={28} /><span>Preparando la maqueta…</span></div>}><FacilityScene selected={selected === 'delivery' ? null : selected} hovered={hovered} onSelect={onSelect} onHover={setHovered} command={command} animate={animate} onTelemetry={onTelemetry} onFailure={onFailure} onSupplierSelect={onSupplierSelect} /></Suspense></SceneBoundary> : <SceneFallback />}
        <FacilityHUD selected={selected} onZoom={onZoom} animate={animate} onAnimation={() => setAnimate(prev => !prev)} telemetry={telemetry} available={available} fullscreen={fullscreen} onFullscreen={toggle} />
      </div>
      <FacilityInfoPanel selected={selected} onClose={onHome} onSelect={onSelect} onNavigate={leave} />
    </div>
    <footer className="facility-page-footer"><span><i /> Ambientación visual · accesos a módulos del sistema</span><span>Tocá un sector y abrí su módulo · Esc: volver al predio o salir de pantalla completa</span></footer>
  </section>;
}
