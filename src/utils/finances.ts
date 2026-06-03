import type {
  CostBudgetItem,
  CostCategoryName,
  FinancialStatus,
  Obra
} from "../types";

export const costCategories: CostCategoryName[] = [
  "Vidrios",
  "Aluminio",
  "Accesorios",
  "Mano de obra fabrica",
  "Mano de obra instalacion",
  "Cielorrasos",
  "ACM",
  "WPC",
  "Transporte",
  "Equipos y alquileres",
  "Otros"
];

export function getDefaultCostBudget(baseValue: number): CostBudgetItem[] {
  const distribution: Record<CostCategoryName, number> = {
    Vidrios: 0.26,
    Aluminio: 0.2,
    Accesorios: 0.06,
    "Mano de obra fabrica": 0.11,
    "Mano de obra instalacion": 0.1,
    Cielorrasos: 0.03,
    ACM: 0.03,
    WPC: 0.02,
    Transporte: 0.04,
    "Equipos y alquileres": 0.03,
    Otros: 0.04
  };

  return costCategories.map((categoria) => {
    const estimado = Math.round(baseValue * distribution[categoria]);
    return {
      id: `cost-${slug(categoria)}`,
      categoria,
      estimado,
      real: Math.round(estimado * 0.96)
    };
  });
}

export function getContractValue(obra: Obra): number {
  return (
    obra.valorFinalContratado ??
    (obra.presupuestoAprobado ?? obra.montoAprobado) +
      (obra.adicionalesAprobados ?? 0) -
      (obra.descuentos ?? 0)
  );
}

export function getCostBudget(obra: Obra): CostBudgetItem[] {
  return obra.costosEstimados?.length
    ? obra.costosEstimados
    : getDefaultCostBudget(getContractValue(obra));
}

export function getRealCosts(obra: Obra): number {
  return getCostBudget(obra).reduce((sum, item) => sum + item.real, 0);
}

export function getGrossProfit(obra: Obra): number {
  return getContractValue(obra) - getRealCosts(obra);
}

export function getMargin(obra: Obra): number {
  const contractValue = getContractValue(obra);
  if (!contractValue) {
    return 0;
  }

  return Math.round((getGrossProfit(obra) / contractValue) * 100);
}

export function getFinancialStatus(obra: Obra): FinancialStatus {
  const margin = getMargin(obra);
  const realCosts = getRealCosts(obra);
  const contractValue = getContractValue(obra);

  if (realCosts > contractValue) {
    return "Excedido";
  }

  if (obra.saldoPendienteCobro > contractValue * 0.35) {
    return "Pendiente de cobro";
  }

  if (margin < 20) {
    return "Margen bajo";
  }

  if (margin < 28) {
    return "Atencion";
  }

  return "Saludable";
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
