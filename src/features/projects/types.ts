export type ProjectStatus = "PLANIFICADO" | "EN CURSO" | "EN PAUSA" | "COMPLETADO" | "CANCELADO";
export type ProjectPriority = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";
export type ProjectTaskStatus = "PENDIENTE" | "EN PROGRESO" | "COMPLETADA" | "BLOQUEADA";

export interface ProjectObjective {
  id: string;
  title: string;
  metric: string;
  achieved: boolean;
}

export interface ProjectTaskComment {
  id: string;
  organization_id: string;
  task_id: string;
  author_user_id: string;
  author_name: string;
  comment: string;
  created_at: string;
}

export interface ProjectTask {
  id: string;
  organization_id: string;
  project_id: string;
  title: string;
  description: string | null;
  status: ProjectTaskStatus;
  priority: ProjectPriority;
  assignee_user_id: string | null;
  assignee_name: string | null;
  due_date: string | null;
  progress: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  comments: ProjectTaskComment[];
}

export interface OrchestraProject {
  id: string;
  organization_id: string;
  name: string;
  category: string;
  description: string | null;
  status: ProjectStatus;
  priority: ProjectPriority;
  owner_name: string | null;
  start_date: string | null;
  target_date: string | null;
  budget: number;
  objectives: ProjectObjective[];
  created_by: string | null;
  created_at: string;
  updated_at: string;
  tasks: ProjectTask[];
}
