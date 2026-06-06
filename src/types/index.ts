export type UserRole =
  | "admin"
  | "gerencia"
  | "supervisor"
  | "fiscalizador"
  | "encargado"
  | "administracion"
  | "produccion"
  | "instalador"
  | "equipo_campo";

export type WorkStatus =
  | "Prospecto"
  | "Presupuesto enviado"
  | "Seguimiento"
  | "Aprobado"
  | "Produccion"
  | "Instalacion"
  | "Facturacion"
  | "Cobrado"
  | "Finalizada"
  | "Pausada"
  | "Atrasada";

export type PipelineStatus =
  | "Prospecto"
  | "Presupuesto enviado"
  | "Seguimiento"
  | "Aprobado"
  | "Perdido";

export type ProductionStageStatus = "Pendiente" | "En proceso" | "Completado";
export type MaterialStatus = "Pendiente" | "Resuelto";
export type ProgressMaterialStatus = "Pendiente" | "Solicitado" | "Recibido" | "Resuelto";
export type ProgressCalculationMode = "cantidad" | "manual";
export type PaymentMethod = "Efectivo" | "Transferencia" | "Cheque" | "Otro";
export type FinancialPaymentMethod = PaymentMethod | "Credito";
export type InstallationTaskStatus = "Pendiente" | "Completada";
export type FinancialStatus =
  | "Saludable"
  | "Atencion"
  | "Margen bajo"
  | "Pendiente de cobro";

export type Cliente = {
  id: string;
  nombre: string;
  ruc?: string;
  telefono?: string;
  whatsapp?: string;
  email?: string;
  direccion?: string;
  ciudad?: string;
  contactoPrincipal?: string;
  observaciones?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type SupplierCategory = "Vidrio" | "Aluminio" | "Accesorios" | "Transporte" | "Mano de obra" | "Otros";

export type Proveedor = {
  id: string;
  nombre: string;
  ruc?: string;
  telefono?: string;
  whatsapp?: string;
  email?: string;
  direccion?: string;
  categoriaPrincipal: SupplierCategory;
  contactoPrincipal?: string;
  observaciones?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
};

export type SystemUser = {
  uid: string;
  nombre: string;
  email: string;
  role: UserRole;
  active: boolean;
  phone?: string;
  assignedWorkIds: string[];
  assignedTeamIds?: string[];
  teamName?: string;
  teamType?: "cuadrilla" | "equipo_campo";
  membersDescription?: string;
  lastLoginAt?: string;
  createdAt: string;
  createdBy: string;
  updatedAt?: string;
};

export type CostCategoryName =
  | "Vidrios"
  | "Aluminio"
  | "Accesorios"
  | "Mano de obra fabrica"
  | "Mano de obra instalacion"
  | "Cielorrasos"
  | "ACM"
  | "WPC"
  | "Transporte"
  | "Equipos y alquileres"
  | "Otros";

export type CostBudgetItem = {
  id: string;
  categoria: CostCategoryName;
  estimado: number;
  real: number;
};

export type FinancialMovementKind = "ingreso" | "compra" | "egreso";

export type FinancialMovement = {
  id: string;
  obraId: string;
  fecha: string;
  tipo: FinancialMovementKind;
  concepto: string;
  categoria: string;
  detalle?: string;
  cantidad?: number;
  unidad?: string;
  metodoPago?: FinancialPaymentMethod;
  numeroCheque?: string;
  fechaEmisionCheque?: string;
  fechaCobroCheque?: string;
  bancoCheque?: string;
  monto: number;
  tercero?: string;
  proveedorId?: string;
  proveedorNombre?: string;
  pagadorId?: string;
  pagadorNombre?: string;
  clienteId?: string;
  clienteNombre?: string;
  observacion?: string;
  createdAt: string;
  updatedAt?: string;
};

export type ChequeKind = "recibido" | "emitido";
export type ChequeOrigin = "ingreso" | "compra" | "egreso";
export type ChequeThirdPartyType = "cliente" | "proveedor" | "persona";
export type ReceivedChequeStatus = "recibido" | "depositado" | "cobrado" | "rechazado" | "anulado";
export type IssuedChequeStatus = "emitido" | "entregado" | "debitado" | "rechazado" | "anulado";
export type ChequeStatus = ReceivedChequeStatus | IssuedChequeStatus;

export type ChequeStatusChange = {
  estado: ChequeStatus;
  fecha: string;
  usuario?: string;
  observacion?: string;
};

export type Cheque = {
  id: string;
  tipo: ChequeKind;
  estado: ChequeStatus;
  obraId: string;
  obraNombre: string;
  movimientoId: string;
  origen: ChequeOrigin;
  terceroId?: string;
  terceroNombre: string;
  terceroTipo: ChequeThirdPartyType;
  clienteId?: string;
  clienteNombre?: string;
  pagadorId?: string;
  pagadorNombre?: string;
  proveedorId?: string;
  proveedorNombre?: string;
  beneficiarioId?: string;
  beneficiarioNombre?: string;
  monto: number;
  numeroCheque: string;
  bancoCheque?: string;
  fechaEmisionCheque: string;
  fechaCobroCheque: string;
  fechaVencimientoCheque?: string;
  observacion?: string;
  historial?: ChequeStatusChange[];
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type ProgressItem = {
  id: string;
  nombre: string;
  peso: number;
  avance: number;
};

export type WorkProgressRubric = {
  id: string;
  obraId: string;
  nombre: string;
  unidad: string;
  cantidadTotalPrevista: number;
  equivalenciaM2PorUnidad?: number;
  totalEquivalenteM2?: number;
  pesoOperativo: number;
  modoCalculo: ProgressCalculationMode;
  avanceManualPermitido: boolean;
  orden: number;
  createdAt: string;
  updatedAt?: string;
};

export type ProgressReportEntry = {
  id: string;
  rubroId: string;
  rubroNombre: string;
  cantidadAnterior?: number;
  cantidadEjecutadaHoy?: number;
  cantidadAcumuladaNueva?: number;
  porcentajeAnterior: number;
  porcentajeNuevo: number;
  modo: ProgressCalculationMode;
  justificacionManual?: string;
  observacion?: string;
};

export type ProgressMaterialReport = {
  id: string;
  obraId: string;
  material: string;
  cantidad: number;
  unidad: string;
  observacion?: string;
  estado: ProgressMaterialStatus;
  reportadoPor: string;
  fechaReporte: string;
  urgencia?: "Baja" | "Media" | "Alta";
};

export type ProgressReport = {
  id: string;
  obraId: string;
  fecha: string;
  hora: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  cuadrillaId?: string;
  cuadrillaNombre?: string;
  seTrabajoHoy: boolean;
  observacionGeneral?: string;
  incidentes?: string;
  proximoTrabajo?: string;
  photos?: string[];
  entries: ProgressReportEntry[];
  materialsReported?: ProgressMaterialReport[];
  createdAt: string;
  updatedAt?: string;
};

export type ProgressActivityLog = {
  id: string;
  obraId: string;
  tipo: string;
  descripcion: string;
  userId: string;
  userName: string;
  fechaHora: string;
  previousValue?: unknown;
  newValue?: unknown;
  reportId?: string;
};

export type ProductionStage = {
  id: string;
  nombre: string;
  estado: ProductionStageStatus;
  updatedAt?: string;
  updatedBy?: string;
};

export type MissingMaterial = {
  id: string;
  material: string;
  cantidad: number;
  unidad: string;
  observacion: string;
  estado: MaterialStatus;
  createdAt: string;
};

export type Obra = {
  id: string;
  nombre: string;
  cliente: string;
  clienteId?: string;
  clienteNombre?: string;
  arquitecto: string;
  ubicacion: string;
  direccion?: string;
  montoAprobado: number;
  fechaInicio: string;
  fechaEntrega: string;
  fechaComprometida?: string;
  imageUrl?: string;
  renderUrl?: string;
  renderStoragePath?: string;
  renderFileName?: string;
  renderUploadedAt?: string;
  renderUploadedBy?: string;
  responsable: string;
  encargado?: string;
  supervisor?: string;
  fiscalizador?: string;
  cuadrillaAsignadaId?: string;
  estado: WorkStatus;
  saldoPendienteCobro: number;
  rubrosAvance: ProgressItem[];
  etapasProduccion: ProductionStage[];
  materialesFaltantes: MissingMaterial[];
  presupuestoAprobado?: number;
  adicionalesAprobados?: number;
  descuentos?: number;
  valorFinalContratado?: number;
  totalContratado?: number;
  observacionInicial?: string;
  costosEstimados?: CostBudgetItem[];
  movimientosFinancieros?: FinancialMovement[];
  assignedUserIds?: string[];
  progressConfigured?: boolean;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
};

export type Cobro = {
  id: string;
  obraId: string;
  fecha: string;
  monto: number;
  medio: PaymentMethod;
  observacion: string;
  createdAt: string;
};

export type Actividad = {
  id: string;
  obraId: string;
  tipo: string;
  descripcion: string;
  usuario: string;
  fecha: string;
  imagenUrl?: string;
};

export type OportunidadCRM = {
  id: string;
  proyecto: string;
  cliente: string;
  arquitecto: string;
  montoEstimado: number;
  estado: PipelineStatus;
  prioridad: "Alta" | "Media" | "Baja";
  proximoSeguimiento: string;
  observacion: string;
  createdAt: string;
  updatedAt: string;
};

export type Cuadrilla = {
  id: string;
  nombre: string;
  responsable: string;
  personas: number;
  obraId: string;
  estado: string;
  horaInicio: string;
  horaFin: string;
};

export type TareaInstalacion = {
  id: string;
  obraId: string;
  cuadrillaId: string;
  titulo: string;
  estado: InstallationTaskStatus;
  createdAt: string;
  completedAt?: string;
};

export type FieldTaskStatus =
  | "pendiente"
  | "asignada"
  | "en_proceso"
  | "reportada"
  | "completada"
  | "observada"
  | "cancelada";

export type FieldTaskAssignmentType = "fiscalizador" | "equipo_campo" | "usuario";

export type TaskPhoto = {
  id: string;
  url: string;
  storagePath?: string;
  fileName?: string;
  uploadedBy?: string;
  uploadedAt: string;
  obraId: string;
  taskId?: string;
  jornadaId?: string;
  phase?: "inicio" | "avance" | "fin";
  observacion?: string;
};

export type FieldTask = {
  id: string;
  obraId: string;
  obraNombre: string;
  titulo: string;
  descripcion?: string;
  rubroId?: string;
  rubroNombre?: string;
  cantidadPrevista?: number;
  unidad?: "m2" | "unidad";
  fechaAsignada?: string;
  fechaLimite?: string;
  asignadoAType: FieldTaskAssignmentType;
  asignadoAId?: string;
  asignadoANombre?: string;
  fiscalizadorId?: string;
  fiscalizadorNombre?: string;
  estado: FieldTaskStatus;
  requiereFotos: boolean;
  requiereValidacion: boolean;
  cantidadReportada?: number;
  observacionCampo?: string;
  observacionFiscalizador?: string;
  fotos?: TaskPhoto[];
  jornadaId?: string;
  createdAt: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
};

export type FieldLocation = {
  lat: number;
  lng: number;
  accuracy?: number;
};

export type FieldWorkday = {
  id: string;
  obraId: string;
  obraNombre: string;
  equipoId?: string;
  equipoNombre?: string;
  userId: string;
  userName: string;
  fecha: string;
  horaInicio: string;
  ubicacionInicio?: FieldLocation;
  ubicacionInicioDisponible?: boolean;
  horaFin?: string;
  ubicacionFin?: FieldLocation;
  ubicacionFinDisponible?: boolean;
  estado: "activa" | "finalizada";
  tareasIds: string[];
  fotosInicio?: TaskPhoto[];
  fotosAvance?: TaskPhoto[];
  fotosFin?: TaskPhoto[];
  observacionInicio?: string;
  observacionFin?: string;
  createdAt: string;
  updatedAt?: string;
};

export type StoredData = {
  obras: Obra[];
  oportunidades: OportunidadCRM[];
  cobros: Cobro[];
  actividades: Actividad[];
  cuadrillas: Cuadrilla[];
  tareasInstalacion: TareaInstalacion[];
  movimientosFinancieros: FinancialMovement[];
  rubrosAvanceConfigurados: WorkProgressRubric[];
  reportesAvance: ProgressReport[];
  materialesPendientes: ProgressMaterialReport[];
  actividadesAvance: ProgressActivityLog[];
  users: SystemUser[];
  clientes: Cliente[];
  proveedores: Proveedor[];
  cheques: Cheque[];
  tareas: FieldTask[];
  jornadasCampo: FieldWorkday[];
};

export type DataSourceLabel = "Usando Firebase" | "Usando modo demo local";
