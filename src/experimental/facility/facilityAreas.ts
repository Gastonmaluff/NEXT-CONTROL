import type { AreaId, FacilityArea, FacilityTarget } from './types';

// Navigation metadata only. Operational values belong to the destination modules.
const stock = (id: AreaId, label: string, accent: string): FacilityArea => ({
  id, label, shortLabel: label, category: 'Depósito', accent,
  description: `Sector de ${label.toLowerCase()}. Abrí Inventario para acceder al módulo del sistema.`,
  route: '/inventario', module: 'inventario', action: 'Abrir Inventario',
});
export const facilityAreas: FacilityArea[] = [
  { id: 'entrance', label: 'Entrada y expedición', shortLabel: 'Entrada', category: 'Acceso principal', accent: '#4e849e', description: 'Acceso al módulo de instalaciones para consultar los trabajos en obra.', route: '/instalaciones', module: 'instalaciones', action: 'Abrir Instalaciones' },
  { id: 'administration', label: 'Finanzas de obras', shortLabel: 'Finanzas de obras', category: 'Oficinas', accent: '#5178b0', description: 'Oficina administrativa. Accedé a las finanzas de las obras con los permisos de tu usuario.', route: '/finanzas-obras', module: 'finanzas_obras', action: 'Abrir Finanzas de obras' },
  { id: 'sales', label: 'Avance de obras', shortLabel: 'Avance de obras', category: 'Oficinas', accent: '#259284', description: 'Oficina de seguimiento. Consultá el avance y el control de las obras en su módulo.', route: '/avance-obras', module: 'avance_obras', action: 'Abrir Avance de obras' },
  { id: 'control', label: 'Oficina de Richard · Control', shortLabel: 'Oficina de Richard', category: 'Dirección', accent: '#6e75b2', description: 'Oficina del dueño. Accedé al panel de Control del sistema.', route: '/control', module: 'control', action: 'Abrir Control' },
  { id: 'workshop', label: 'Producción / Taller', shortLabel: 'Taller', category: 'Fábrica', accent: '#2878ba', description: 'Corte y armado de aberturas. Abrí Producción / Taller para consultar órdenes y registrar avances según tu rol.', route: '/produccion', module: 'produccion', action: 'Abrir Producción / Taller' },
  { id: 'raw', label: 'Materia prima', shortLabel: 'Materia prima', category: 'Abastecimiento', accent: '#608c9c', description: 'Perfiles, vidrio e insumos del taller. Acceso al módulo de Inventario.', route: '/inventario', module: 'inventario', action: 'Abrir Inventario' },
  stock('wpc', 'Pisos WPC', '#a78259'), stock('spc', 'Pisos SPC', '#6986a1'),
  stock('slats', 'Panel ripado', '#a47d56'), stock('ceiling', 'Cielo raso WPC', '#b69873'),
  stock('glass', 'Vidrio', '#439ba4'), stock('aluminum', 'Perfiles de aluminio', '#758999'),
];
export const areaById = Object.fromEntries(facilityAreas.map(area => [area.id, area])) as Record<AreaId, FacilityArea>;
export const supplierTarget: FacilityTarget = {
  id: 'delivery', label: 'Camión de materia prima', shortLabel: 'Proveedores', category: 'Recepción y abastecimiento',
  accent: '#2878ba', description: 'El camión azul representa la recepción de materiales. Abrí el módulo de Proveedores para consultar y gestionar proveedores.',
  route: '/proveedores', module: 'proveedores', action: 'Abrir Proveedores',
};
