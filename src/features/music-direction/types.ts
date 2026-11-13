export type TaskPriority = "BAJA" | "NORMAL" | "ALTA" | "URGENTE";
export type TaskStatus = "PENDIENTE" | "EN PROGRESO" | "COMPLETADA" | "NO COMPLETADA" | "VENCIDA" | "CANCELADA";
export type AssignmentScope = "INDIVIDUAL" | "MULTIPLE" | "INSTRUMENT" | "ALL";

export interface TaskAssignee {
  id: string;
  musician_id: string;
  status: TaskStatus;
  completion_comment: string | null;
  completed_at: string | null;
  musician: { id: string; user_id: string | null; first_name: string; last_name: string; specialty: string | null; photo_url: string | null; musician_instruments: Array<{is_primary:boolean;instrument:{id:string;name:string}|null}> };
}

export interface MusicTask {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  assignment_scope: AssignmentScope;
  instrument_id: string | null;
  song_id: string | null;
  rehearsal_id: string | null;
  event_id: string | null;
  assigned_at: string;
  due_at: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  observations: string | null;
  work_stage: "GENERAL" | "PREVIA" | "DURANTE" | "POSTERIOR";
  recurrence_type: "NONE" | "EACH_REHEARSAL" | "WEEKLY";
  recurrence_until: string | null;
  recurrence_parent_id: string | null;
  created_by: string | null;
  created_at: string;
  instrument: { id: string; name: string } | null;
  song: { id: string; name: string; status: string } | null;
  rehearsal: { id: string; name: string; rehearsal_date: string; start_time: string; location: string } | null;
  event: { id: string; name: string; event_date: string } | null;
  music_task_assignees: TaskAssignee[];
  music_task_comments: Array<{ id: string; author_user_id: string; comment: string; created_at: string }>;
  music_task_history: Array<{ id:string; action:string; previous_value:Record<string,unknown>|null; new_value:Record<string,unknown>|null; actor_user_id:string|null; created_at:string }>;
}

export interface TaskFormValues {
  title: string; description: string; assignment_scope: AssignmentScope; instrument_id: string; song_id: string; rehearsal_id: string; event_id: string; assigned_at: string; due_at: string; priority: TaskPriority; observations: string; work_stage: "GENERAL" | "PREVIA" | "DURANTE" | "POSTERIOR"; recurrence_type: "NONE" | "EACH_REHEARSAL" | "WEEKLY"; recurrence_until: string; musician_ids: string[];
}

export interface RehearsalPlanBlock { id: string; organization_id: string; rehearsal_id: string; song_id: string | null; title: string; objective: string | null; start_time: string | null; estimated_minutes: number; observations: string | null; position: number; song?: { id: string; name: string } | null; }
