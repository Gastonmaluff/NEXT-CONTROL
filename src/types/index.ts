export type UserRole = "admin" | "administracion" | "produccion" | "instalador";

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
export type PaymentMethod = "Efectivo" | "Transferencia" | "Cheque" | "Otro";
export type InstallationTaskStatus = "Pendiente" | "Completada";

export type ProgressItem = {
  id: string;
  nombre: string;
  peso: number;
  avance: number;
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
  montoAprobado: number;
  fechaInicio: string;
  fechaEntrega: string;
  responsable: string;
  estado: WorkStatus;
  saldoPendienteCobro: number;
  rubrosAvance: ProgressItem[];
  etapasProduccion: ProductionStage[];
  materialesFaltantes: MissingMaterial[];
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
};

export type DataSourceLabel = "Usando Firebase" | "Usando modo demo local";
