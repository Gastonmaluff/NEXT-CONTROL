export type UserRole =
  | "admin"
  | "gerencia"
  | "supervisor"
  | "fiscalizador"
  | "encargado"
  | "administracion"
  | "produccion"
  | "instalador";

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

export type SystemUser = {
  uid: string;
  nombre: string;
  email: string;
  role: UserRole;
  active: boolean;
  phone?: string;
  assignedWorkIds: string[];
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
  observacion?: string;
  createdAt: string;
  updatedAt?: string;
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
};

export type DataSourceLabel = "Usando Firebase" | "Usando modo demo local";
