import { supabase } from "@/integrations/supabase/client";
import type { MusicTask, TaskFormValues, TaskStatus } from "./types";

const taskSelect = "*,instrument:instruments(id,name),song:songs(id,name,status),rehearsal:rehearsals(id,name,rehearsal_date,start_time,location),event:events(id,name,event_date),music_task_assignees(*,musician:musicians(id,user_id,first_name,last_name,specialty,photo_url,musician_instruments(is_primary,instrument:instruments(id,name)))),music_task_comments(*),music_task_history(*)";

export async function expandRecurringTasks(organizationId: string) {
  const { error } = await supabase.rpc("expand_recurring_music_tasks", { target_organization_id: organizationId });
  if (error) throw error;
}

export async function listMusicTasks(organizationId: string) {
  const { data, error } = await supabase.from("music_tasks").select(taskSelect).eq("organization_id", organizationId).order("due_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  return (data ?? []) as unknown as MusicTask[];
}

export async function createMusicTask(organizationId: string, values: TaskFormValues) {
  const { data, error } = await supabase.rpc("create_music_task", { task_data: { ...values, organization_id: organizationId, assigned_at: values.assigned_at ? new Date(values.assigned_at).toISOString() : null, due_at: values.due_at ? new Date(values.due_at).toISOString() : null }, selected_musician_ids: values.musician_ids });
  if (error) throw error;
  return data as string;
}

export async function updateTaskStatus(assigneeId: string, status: TaskStatus, comment = "") {
  const { error } = await supabase.rpc("update_music_task_status", { target_assignee_id: assigneeId, next_status: status, completion_note: comment || null });
  if (error) throw error;
}

export async function addTaskComment(organizationId: string, taskId: string, userId: string, comment: string) {
  const { error } = await supabase.from("music_task_comments").insert({ organization_id: organizationId, task_id: taskId, author_user_id: userId, comment: comment.trim() });
  if (error) throw error;
}

export async function deleteMusicTask(taskId: string) {
  const { error } = await supabase.rpc("delete_music_task", { target_task_id: taskId });
  if (error) throw error;
}

export async function clearMusicTaskHistory(taskId: string) {
  const { error } = await supabase.rpc("clear_music_task_history", { target_task_id: taskId });
  if (error) throw error;
}

