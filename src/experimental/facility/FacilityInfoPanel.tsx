import { ArrowUpRight, ArrowRight, Box, Factory, MapPin, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { canViewModule } from '../../lib/roles';
import { areaById, facilityAreas, supplierTarget } from './facilityAreas';
import type { FacilityTargetId } from './types';

export function FacilityInfoPanel({ selected, onClose, onSelect, onNavigate }: { selected: FacilityTargetId | null; onClose: () => void; onSelect: (id: FacilityTargetId) => void; onNavigate: () => void }) {
  const { profile } = useAuth();
  const area = selected === 'delivery' ? supplierTarget : selected ? areaById[selected] : null;
  if (!area) return <aside className="facility-panel facility-overview" aria-label="Sectores y módulos">
    <div className="facility-panel-eyebrow"><MapPin size={15} /> ACCESOS DEL SISTEMA</div>
    <h2>Tu sistema, desde el depósito.</h2>
    <p>Tocá un sector de la maqueta o elegilo aquí. La cámara se acerca y el botón del sector abre su módulo.</p>
    <h3>Sectores</h3>
    <div className="facility-quick-areas">
      {[...facilityAreas, supplierTarget].map(item => <button type="button" key={item.id} onClick={() => onSelect(item.id)}><span className="facility-area-symbol" style={{ background: `${item.accent}15`, color: item.accent }}>{item.id === 'workshop' ? <Factory size={18} /> : item.module === 'inventario' ? <Box size={18} /> : <MapPin size={18} />}</span><span>{item.shortLabel}</span><ArrowRight size={16} /></button>)}
    </div>
    <p className="facility-navigation-note">Los datos y las operaciones se consultan en cada módulo. La actividad de personas y vehículos es únicamente visual.</p>
  </aside>;
  const canOpen = canViewModule(profile, area.module);
  return <aside className="facility-panel" aria-label="Información del sector" aria-live="polite" key={area.id}>
    <div className="facility-panel-top"><span className="facility-panel-eyebrow" style={{ color: area.accent }}>{area.category}</span><button type="button" className="facility-close" aria-label="Cerrar sector y volver al predio" onClick={onClose}><X size={18} /></button></div>
    <div className="facility-panel-accent" style={{ background: area.accent }} />
    <h2>{area.label}</h2>
    <p>{area.description}</p>
    {area.module === 'inventario' ? <p className="facility-placeholder-note">Inventario está en preparación. Este acceso abre la pantalla existente; todavía no hay stock ni filtros por familia implementados.</p> : null}
    {canOpen ? <Link className="facility-module-link" to={area.route} onClick={onNavigate}>{area.action}<ArrowUpRight size={19} /></Link> : <p className="facility-placeholder-note">Tu usuario no tiene permiso para abrir este módulo.</p>}
    <p className="facility-navigation-note">Acceso al módulo del sistema · se mantienen los permisos de tu usuario.</p>
  </aside>;
}
