import { Minus, Plus, Pause, Play, Maximize, Minimize, MousePointer2 } from 'lucide-react';
import type { FacilityTargetId, SceneTelemetry } from './types';

interface Props { selected: FacilityTargetId | null; onZoom: (factor: number) => void; animate: boolean; onAnimation: () => void; telemetry: SceneTelemetry; available: boolean; fullscreen: boolean; onFullscreen: () => void; }
export function FacilityHUD({ selected, onZoom, animate, onAnimation, telemetry, available, fullscreen, onFullscreen }: Props) {
  return <>
    <div className="facility-toolbar">
      <div className="facility-zoom-controls">
        {available ? <>
        <button type="button" aria-label="Alejar vista" title="Alejar" onClick={() => onZoom(0.82)}><Minus size={18} /></button>
        <button type="button" aria-label="Acercar vista" title="Acercar" onClick={() => onZoom(1.22)}><Plus size={18} /></button>
        </> : null}
        <button type="button" aria-label={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} title={fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'} aria-pressed={fullscreen} onClick={onFullscreen}>{fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}</button>
      </div>
    </div>
    {available ? <>
      <div className="facility-scene-status"><span className="facility-live-dot" />{selected ? 'Sector seleccionado' : 'Seleccioná un sector'}<span className="facility-status-divider" />Techo {telemetry.roof}%</div>
      <div className="facility-scene-bottom"><span className="facility-gesture-hint"><MousePointer2 size={14} />Rueda / pellizco: zoom · arrastrá: mover</span>
        <button className="facility-button facility-animation" type="button" aria-pressed={animate} onClick={onAnimation} title="Activar o pausar actividad ambiental">{animate ? <Pause size={14} /> : <Play size={14} />}<span>{animate ? 'Pausar actividad' : 'Activar actividad'}</span></button>
      </div>
    </> : null}
  </>;
}
