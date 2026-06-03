import type { StoredData } from "../types";

export const initialRubros = [
  { id: "rubro-carpinteria", nombre: "Carpinteria", peso: 40, avance: 100 },
  { id: "rubro-vidrios", nombre: "Vidrios", peso: 30, avance: 80 },
  { id: "rubro-contramarcos", nombre: "Contramarcos", peso: 20, avance: 50 },
  { id: "rubro-sellado", nombre: "Sellado", peso: 10, avance: 20 }
];

export const initialProductionStages = [
  { id: "prod-medicion", nombre: "Medicion", estado: "Completado" as const },
  { id: "prod-planos", nombre: "Planos", estado: "Completado" as const },
  { id: "prod-aluminio", nombre: "Compra aluminio", estado: "Completado" as const },
  { id: "prod-vidrio", nombre: "Compra vidrio", estado: "En proceso" as const },
  { id: "prod-corte", nombre: "Corte", estado: "Pendiente" as const },
  { id: "prod-armado", nombre: "Armado", estado: "Pendiente" as const },
  { id: "prod-vidriado", nombre: "Vidriado", estado: "Pendiente" as const },
  { id: "prod-embalaje", nombre: "Embalaje", estado: "Pendiente" as const }
];

const now = "2026-06-02T09:00:00.000Z";

export const seedData: StoredData = {
  obras: [
    {
      id: "obra-palmanova",
      nombre: "Residencias Palmanova",
      cliente: "Inversora del Este S.A.",
      arquitecto: "Arq. Sofia Ramos",
      ubicacion: "Av. Santa Teresa, Asuncion",
      montoAprobado: 1050000000,
      fechaInicio: "2026-05-05",
      fechaEntrega: "2026-06-30",
      fechaComprometida: "2026-06-30",
      responsable: "Juan Martinez",
      supervisor: "Fiscalizador: Hugo Franco",
      estado: "Instalacion",
      saldoPendienteCobro: 850000000,
      presupuestoAprobado: 1000000000,
      adicionalesAprobados: 50000000,
      descuentos: 0,
      valorFinalContratado: 1050000000,
      totalContratado: 1050000000,
      movimientosFinancieros: [],
      rubrosAvance: initialRubros,
      etapasProduccion: initialProductionStages,
      materialesFaltantes: [
        {
          id: "mat-dvh",
          material: "DVH 8+12+8",
          cantidad: 32,
          unidad: "m2",
          observacion: "Fachada norte",
          estado: "Pendiente",
          createdAt: now
        },
        {
          id: "mat-cerraduras",
          material: "Cerraduras multipunto",
          cantidad: 4,
          unidad: "unidades",
          observacion: "Sector B",
          estado: "Pendiente",
          createdAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "obra-aurora",
      nombre: "Edificio Aurora",
      cliente: "Aurora Desarrollos",
      arquitecto: "Arq. Diego Ferreira",
      ubicacion: "Palmanova 1234, Asuncion",
      montoAprobado: 780000000,
      fechaInicio: "2026-04-18",
      fechaEntrega: "2026-06-18",
      fechaComprometida: "2026-06-18",
      responsable: "Marta Lopez",
      supervisor: "Fiscalizador: Andrea Ruiz",
      estado: "Atrasada",
      saldoPendienteCobro: 630000000,
      presupuestoAprobado: 780000000,
      adicionalesAprobados: 0,
      descuentos: 0,
      valorFinalContratado: 780000000,
      totalContratado: 780000000,
      movimientosFinancieros: [],
      rubrosAvance: [
        { id: "aur-carp", nombre: "Carpinteria", peso: 40, avance: 90 },
        { id: "aur-vid", nombre: "Vidrios", peso: 35, avance: 60 },
        { id: "aur-contra", nombre: "Contramarcos", peso: 15, avance: 70 },
        { id: "aur-sell", nombre: "Sellado", peso: 10, avance: 25 }
      ],
      etapasProduccion: initialProductionStages.map((stage) => ({
        ...stage,
        estado: stage.nombre === "Embalaje" ? "Pendiente" : stage.estado
      })),
      materialesFaltantes: [
        {
          id: "mat-perfil",
          material: "Perfil linea A30",
          cantidad: 120,
          unidad: "metros",
          observacion: "Reposicion para remates",
          estado: "Pendiente",
          createdAt: now
        }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      id: "obra-katuete",
      nombre: "Katuete Residencial",
      cliente: "Grupo Katuete",
      arquitecto: "Arq. Laura Benitez",
      ubicacion: "Ruta PY02, Katuete",
      montoAprobado: 690300000,
      fechaInicio: "2026-05-20",
      fechaEntrega: "2026-07-22",
      fechaComprometida: "2026-07-22",
      responsable: "Carlos Duarte",
      supervisor: "Fiscalizador: Victor Sosa",
      estado: "Produccion",
      saldoPendienteCobro: 420000000,
      presupuestoAprobado: 690300000,
      adicionalesAprobados: 25000000,
      descuentos: 10000000,
      valorFinalContratado: 705300000,
      totalContratado: 705300000,
      movimientosFinancieros: [],
      rubrosAvance: [
        { id: "kat-carp", nombre: "Carpinteria", peso: 45, avance: 65 },
        { id: "kat-vid", nombre: "Vidrios", peso: 30, avance: 35 },
        { id: "kat-contra", nombre: "Contramarcos", peso: 15, avance: 20 },
        { id: "kat-sell", nombre: "Sellado", peso: 10, avance: 0 }
      ],
      etapasProduccion: initialProductionStages.map((stage) => ({
        ...stage,
        estado: ["Medicion", "Planos"].includes(stage.nombre)
          ? "Completado"
          : stage.nombre === "Compra aluminio"
            ? "En proceso"
            : "Pendiente"
      })),
      materialesFaltantes: [],
      createdAt: now,
      updatedAt: now
    }
  ],
  oportunidades: [
    {
      id: "opp-atlas",
      proyecto: "Casa Atlas",
      cliente: "Atlas Propiedades",
      arquitecto: "Arq. Ana Pereira",
      montoEstimado: 148400000,
      estado: "Prospecto",
      prioridad: "Media",
      proximoSeguimiento: "2026-06-06",
      observacion: "Enviar propuesta de mamparas y barandas.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "opp-vistasur",
      proyecto: "Edificio Vista Sur",
      cliente: "Vista Sur S.A.",
      arquitecto: "Arq. Marcos Vera",
      montoEstimado: 516000000,
      estado: "Presupuesto enviado",
      prioridad: "Media",
      proximoSeguimiento: "2026-06-10",
      observacion: "Pendiente revision de alcance.",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "opp-costanera",
      proyecto: "Costanera View",
      cliente: "Costanera Real Estate",
      arquitecto: "Arq. Natalia Gomez",
      montoEstimado: 1010500000,
      estado: "Aprobado",
      prioridad: "Alta",
      proximoSeguimiento: "2026-06-11",
      observacion: "Listo para convertir en obra.",
      createdAt: now,
      updatedAt: now
    }
  ],
  cobros: [
    {
      id: "cob-pal-1",
      obraId: "obra-palmanova",
      fecha: "2026-05-08",
      monto: 450000000,
      medio: "Transferencia",
      observacion: "Anticipo inicial",
      createdAt: now
    },
    {
      id: "cob-pal-2",
      obraId: "obra-palmanova",
      fecha: "2026-05-28",
      monto: 580000000,
      medio: "Cheque",
      observacion: "Certificado avance",
      createdAt: now
    },
    {
      id: "cob-aur-1",
      obraId: "obra-aurora",
      fecha: "2026-04-25",
      monto: 464900000,
      medio: "Transferencia",
      observacion: "Anticipo y compra de materiales",
      createdAt: now
    }
  ],
  actividades: [
    {
      id: "act-pal-1",
      obraId: "obra-palmanova",
      tipo: "avance",
      descripcion: "Instalacion de pano fijo en fachada norte.",
      usuario: "Admin",
      fecha: "2026-06-02T08:30:00.000Z"
    },
    {
      id: "act-pal-2",
      obraId: "obra-palmanova",
      tipo: "materiales",
      descripcion: "Recepcion parcial de vidrios DVH 8+12+8.",
      usuario: "Produccion",
      fecha: "2026-06-01T15:40:00.000Z"
    },
    {
      id: "act-aur-1",
      obraId: "obra-aurora",
      tipo: "instalacion",
      descripcion: "Cuadrilla inicio jornada.",
      usuario: "Cuadrilla A",
      fecha: "2026-06-02T08:02:00.000Z"
    }
  ],
  cuadrillas: [
    {
      id: "cuad-a",
      nombre: "Cuadrilla A",
      responsable: "Luis Acosta",
      personas: 4,
      obraId: "obra-aurora",
      estado: "En obra",
      horaInicio: "",
      horaFin: ""
    },
    {
      id: "cuad-b",
      nombre: "Cuadrilla B",
      responsable: "Pedro Rojas",
      personas: 3,
      obraId: "obra-palmanova",
      estado: "Disponible",
      horaInicio: "",
      horaFin: ""
    }
  ],
  tareasInstalacion: [
    {
      id: "task-aur-1",
      obraId: "obra-aurora",
      cuadrillaId: "cuad-a",
      titulo: "Instalacion de mamparas - Nivel 2",
      estado: "Pendiente",
      createdAt: now
    },
    {
      id: "task-aur-2",
      obraId: "obra-aurora",
      cuadrillaId: "cuad-a",
      titulo: "Colocacion de vidrios fijos - Sector A",
      estado: "Pendiente",
      createdAt: now
    },
    {
      id: "task-aur-3",
      obraId: "obra-aurora",
      cuadrillaId: "cuad-a",
      titulo: "Sellado y silicona - Fachada principal",
      estado: "Pendiente",
      createdAt: now
    }
  ],
  movimientosFinancieros: [
    {
      id: "mov-pal-ing-1",
      obraId: "obra-palmanova",
      fecha: "2026-05-08",
      tipo: "ingreso",
      concepto: "Anticipo de obra",
      categoria: "Anticipo",
      monto: 200000000,
      metodoPago: "Transferencia",
      tercero: "Inversora del Este S.A.",
      observacion: "Primer anticipo",
      createdAt: now
    },
    {
      id: "mov-pal-com-1",
      obraId: "obra-palmanova",
      fecha: "2026-05-12",
      tipo: "compra",
      concepto: "Compra de vidrio DVH",
      categoria: "Vidrio",
      detalle: "DVH 8+12+8",
      cantidad: 120,
      unidad: "m2",
      monto: 85000000,
      metodoPago: "Cheque",
      numeroCheque: "000145",
      fechaEmisionCheque: "2026-05-12",
      fechaCobroCheque: "2026-06-30",
      bancoCheque: "Banco Continental",
      tercero: "Vidriera X",
      createdAt: now
    },
    {
      id: "mov-pal-com-2",
      obraId: "obra-palmanova",
      fecha: "2026-05-14",
      tipo: "compra",
      concepto: "Perfiles de aluminio",
      categoria: "Aluminio",
      monto: 140000000,
      metodoPago: "Transferencia",
      tercero: "Aluminio del Este",
      createdAt: now
    },
    {
      id: "mov-pal-egr-1",
      obraId: "obra-palmanova",
      fecha: "2026-05-22",
      tipo: "egreso",
      concepto: "Viaticos cuadrilla",
      categoria: "Viaticos",
      monto: 2500000,
      metodoPago: "Efectivo",
      tercero: "Cuadrilla B",
      createdAt: now
    },
    {
      id: "mov-pal-egr-2",
      obraId: "obra-palmanova",
      fecha: "2026-05-24",
      tipo: "egreso",
      concepto: "Flete materiales",
      categoria: "Transporte",
      monto: 3800000,
      metodoPago: "Efectivo",
      tercero: "Transporte externo",
      createdAt: now
    },
    {
      id: "mov-aur-ing-1",
      obraId: "obra-aurora",
      fecha: "2026-04-25",
      tipo: "ingreso",
      concepto: "Anticipo",
      categoria: "Anticipo",
      monto: 150000000,
      metodoPago: "Transferencia",
      tercero: "Aurora Desarrollos",
      createdAt: now
    },
    {
      id: "mov-aur-com-1",
      obraId: "obra-aurora",
      fecha: "2026-05-03",
      tipo: "compra",
      concepto: "Vidrios templados",
      categoria: "Vidrio",
      monto: 45000000,
      metodoPago: "Cheque",
      numeroCheque: "000219",
      fechaEmisionCheque: "2026-05-03",
      fechaCobroCheque: "2026-06-15",
      bancoCheque: "Banco Familiar",
      tercero: "Vidriera X",
      createdAt: now
    },
    {
      id: "mov-aur-egr-1",
      obraId: "obra-aurora",
      fecha: "2026-05-20",
      tipo: "egreso",
      concepto: "Mano de obra instalacion",
      categoria: "Instalacion",
      monto: 18000000,
      metodoPago: "Transferencia",
      tercero: "Cuadrilla A",
      createdAt: now
    }
  ]
};
