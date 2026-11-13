export type SwotQuadrant = "FORTALEZA" | "DEBILIDAD" | "OPORTUNIDAD" | "AMENAZA";
export type SwotImpact = "BAJO" | "MEDIO" | "ALTO" | "CRÍTICO";
export type SwotFactorStatus = "ACTIVO" | "EN PROCESO" | "RESUELTO" | "ARCHIVADO";
export type GapPriority = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
export type GapStatus = "IDENTIFICADA" | "EN PLAN" | "EN PROGRESO" | "CERRADA";

export interface SwotFactor {
  id: string;
  organization_id: string;
  quadrant: SwotQuadrant;
  title: string;
  description: string | null;
  impact: SwotImpact;
  priority: number;
  responsible: string | null;
  target_date: string | null;
  status: SwotFactorStatus;
  strategic_action: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SwotGap {
  id: string;
  organization_id: string;
  area: string;
  current_state: string;
  desired_state: string;
  gap_description: string;
  action_plan: string;
  responsible: string | null;
  priority: GapPriority;
  status: GapStatus;
  due_date: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}
