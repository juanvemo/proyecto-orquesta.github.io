import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { isMissingTableOrRpcError, readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";
import type { OrchestraProject, ProjectObjective, ProjectTask, ProjectTaskComment } from "./types";

const PROJECTS_KEY = "projects_store";

function normalizeObjectives(raw: unknown): ProjectObjective[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => {
    const obj = (item ?? {}) as Record<string, unknown>;
    return {
      id: String(obj.id || crypto.randomUUID()),
      title: String(obj.title || ""),
      metric: String(obj.metric || ""),
      achieved: Boolean(obj.achieved),
    };
  });
}

export async function listProjects(organizationId: string): Promise<OrchestraProject[]> {
  const { data: projData, error: projErr } = await supabase
    .from("projects" as never)
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false });

  if (!projErr) {
    const { data: taskData } = await supabase
      .from("project_tasks" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    const { data: commentData } = await supabase
      .from("project_task_comments" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });

    const comments = (commentData ?? []) as unknown as ProjectTaskComment[];
    const authorIds = Array.from(new Set(comments.map((c) => c.author_user_id).filter(Boolean)));
    const authorMap = new Map<string, string>();
    if (authorIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,first_name,last_name")
        .in("id", authorIds);
      for (const p of profiles ?? []) {
        const full = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
        if (full) authorMap.set(p.id, full);
      }
    }

    const tasksByProject = new Map<string, ProjectTask[]>();
    for (const rawTask of (taskData ?? []) as Array<Record<string, unknown>>) {
      const taskId = String(rawTask.id);
      const taskComments = comments
        .filter((c) => c.task_id === taskId)
        .map((c) => ({
          ...c,
          author_name: authorMap.get(c.author_user_id) || c.author_name || "Integrante",
        }));
      const task: ProjectTask = {
        ...(rawTask as unknown as Omit<ProjectTask, "comments">),
        comments: taskComments,
      };
      const pid = task.project_id;
      tasksByProject.set(pid, [...(tasksByProject.get(pid) ?? []), task]);
    }

    return ((projData ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...(row as unknown as Omit<OrchestraProject, "objectives" | "tasks">),
      budget: Number(row.budget ?? 0),
      objectives: normalizeObjectives(row.objectives),
      tasks: tasksByProject.get(String(row.id)) ?? [],
    }));
  }

  if (!isMissingTableOrRpcError(projErr)) throw projErr;
  const fallback = await readOrgFeatureFlag<OrchestraProject[]>(organizationId, PROJECTS_KEY, []);
  return fallback.map((p) => ({
    ...p,
    objectives: normalizeObjectives(p.objectives),
    tasks: Array.isArray(p.tasks) ? p.tasks : [],
  }));
}

export async function listOrgMembersForProjects(organizationId: string): Promise<Array<{ userId: string; name: string }>> {
  const { data } = await supabase
    .from("organization_memberships")
    .select("user_id")
    .eq("organization_id", organizationId)
    .eq("approval_status", "APPROVED");
  const ids = Array.from(new Set((data ?? []).map((m) => m.user_id).filter(Boolean)));
  if (!ids.length) return [];
  const { data: profiles } = await supabase.from("profiles").select("id,first_name,last_name").in("id", ids);
  return (profiles ?? []).map((p) => ({
    userId: p.id,
    name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Usuario",
  }));
}

export async function saveProject(
  organizationId: string,
  userId: string,
  input: Partial<OrchestraProject> & Pick<OrchestraProject, "name">,
): Promise<OrchestraProject> {
  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    name: input.name.trim(),
    category: input.category?.trim() || "Operativo",
    description: input.description?.trim() || null,
    status: input.status ?? "PLANIFICADO",
    priority: input.priority ?? "ALTA",
    owner_name: input.owner_name?.trim() || null,
    start_date: input.start_date || null,
    target_date: input.target_date || null,
    budget: Number(input.budget ?? 0),
    objectives: input.objectives ?? [],
    updated_at: now,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("projects" as never)
      .update(payload as never)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (!error && data) {
      await logAuditEvent({ organizationId, userId, action: "UPDATE", entityType: "project", entityId: input.id, newValue: payload });
      return { ...(data as unknown as OrchestraProject), objectives: normalizeObjectives((data as Record<string, unknown>).objectives), tasks: input.tasks ?? [] };
    }
    if (error && !isMissingTableOrRpcError(error)) throw error;

    const current = await readOrgFeatureFlag<OrchestraProject[]>(organizationId, PROJECTS_KEY, []);
    const next = current.map((p) => (p.id === input.id ? { ...p, ...payload } : p));
    await writeOrgFeatureFlag(organizationId, PROJECTS_KEY, next);
    const updated = next.find((p) => p.id === input.id);
    if (!updated) throw new Error("Proyecto no encontrado");
    return updated;
  }

  const insertRow = { ...payload, created_by: userId, created_at: now };
  const { data, error } = await supabase
    .from("projects" as never)
    .insert(insertRow as never)
    .select("*")
    .single();
  if (!error && data) {
    const saved = data as unknown as OrchestraProject;
    await logAuditEvent({ organizationId, userId, action: "CREATE", entityType: "project", entityId: saved.id, newValue: payload });
    return { ...saved, objectives: normalizeObjectives((data as Record<string, unknown>).objectives), tasks: [] };
  }
  if (error && !isMissingTableOrRpcError(error)) throw error;

  const current = await readOrgFeatureFlag<OrchestraProject[]>(organizationId, PROJECTS_KEY, []);
  const created: OrchestraProject = {
    ...(insertRow as Omit<OrchestraProject, "id" | "tasks">),
    id: crypto.randomUUID(),
    tasks: [],
  };
  await writeOrgFeatureFlag(organizationId, PROJECTS_KEY, [created, ...current]);
  return created;
}

export async function saveProjectTask(
  organizationId: string,
  userId: string,
  projectId: string,
  input: Partial<ProjectTask> & Pick<ProjectTask, "title">,
): Promise<void> {
  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    project_id: projectId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    status: input.status ?? "PENDIENTE",
    priority: input.priority ?? "MEDIA",
    assignee_user_id: input.assignee_user_id || null,
    assignee_name: input.assignee_name?.trim() || null,
    due_date: input.due_date || null,
    progress: input.status === "COMPLETADA" ? 100 : Number(input.progress ?? 0),
    updated_at: now,
  };

  if (input.id) {
    const { error } = await supabase
      .from("project_tasks" as never)
      .update(payload as never)
      .eq("id", input.id)
      .eq("organization_id", organizationId);
    if (!error) {
      await logAuditEvent({ organizationId, userId, action: "UPDATE", entityType: "project_task", entityId: input.id, newValue: payload });
      return;
    }
    if (!isMissingTableOrRpcError(error)) throw error;

    const current = await readOrgFeatureFlag<OrchestraProject[]>(organizationId, PROJECTS_KEY, []);
    const next = current.map((p) =>
      p.id === projectId
        ? { ...p, tasks: p.tasks.map((t) => (t.id === input.id ? { ...t, ...payload } : t)) }
        : p,
    );
    await writeOrgFeatureFlag(organizationId, PROJECTS_KEY, next);
    return;
  }

  const insertRow = { ...payload, created_by: userId, created_at: now };
  const { error } = await supabase.from("project_tasks" as never).insert(insertRow as never);
  if (!error) {
    await logAuditEvent({ organizationId, userId, action: "CREATE", entityType: "project_task", newValue: payload });
    return;
  }
  if (!isMissingTableOrRpcError(error)) throw error;

  const current = await readOrgFeatureFlag<OrchestraProject[]>(organizationId, PROJECTS_KEY, []);
  const createdTask: ProjectTask = { ...(insertRow as Omit<ProjectTask, "id" | "comments">), id: crypto.randomUUID(), comments: [] };
  const next = current.map((p) => (p.id === projectId ? { ...p, tasks: [...p.tasks, createdTask] } : p));
  await writeOrgFeatureFlag(organizationId, PROJECTS_KEY, next);
}

export async function deleteProjectTask(organizationId: string, projectId: string, taskId: string): Promise<void> {
  const { error } = await supabase
    .from("project_tasks" as never)
    .delete()
    .eq("id", taskId)
    .eq("organization_id", organizationId);
  if (!error) return;
  if (!isMissingTableOrRpcError(error)) throw error;
  const current = await readOrgFeatureFlag<OrchestraProject[]>(organizationId, PROJECTS_KEY, []);
  const next = current.map((p) =>
    p.id === projectId ? { ...p, tasks: p.tasks.filter((t) => t.id !== taskId) } : p,
  );
  await writeOrgFeatureFlag(organizationId, PROJECTS_KEY, next);
}

export async function addProjectTaskComment(
  organizationId: string,
  projectId: string,
  taskId: string,
  authorUserId: string,
  authorName: string,
  comment: string,
): Promise<void> {
  const clean = comment.trim();
  if (!clean) return;
  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    task_id: taskId,
    author_user_id: authorUserId,
    author_name: authorName,
    comment: clean,
    created_at: now,
  };
  const { error } = await supabase.from("project_task_comments" as never).insert(payload as never);
  if (!error) return;
  if (!isMissingTableOrRpcError(error)) throw error;

  const current = await readOrgFeatureFlag<OrchestraProject[]>(organizationId, PROJECTS_KEY, []);
  const createdComment: ProjectTaskComment = { ...payload, id: crypto.randomUUID() };
  const next = current.map((p) =>
    p.id === projectId
      ? {
          ...p,
          tasks: p.tasks.map((t) =>
            t.id === taskId ? { ...t, comments: [...(t.comments ?? []), createdComment] } : t,
          ),
        }
      : p,
  );
  await writeOrgFeatureFlag(organizationId, PROJECTS_KEY, next);
}
