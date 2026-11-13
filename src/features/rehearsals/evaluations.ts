import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { isMissingTableOrRpcError, readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";

export type SemaphoreColor = "VERDE" | "AMARILLO" | "ROJO";

export interface RehearsalEvaluation {
  id: string;
  organization_id: string;
  rehearsal_id: string;
  evaluator_user_id: string | null;
  evaluator_name: string;
  semaphore: SemaphoreColor;
  score: number | null;
  progress_percentage: number;
  strengths: string;
  improvements: string;
  general_notes: string;
  songs_worked: string[];
  updated_at: string;
}

export interface MusicianEvaluation {
  id: string;
  organization_id: string;
  rehearsal_id: string;
  rehearsal_name?: string;
  rehearsal_date?: string;
  musician_id: string;
  musician_name?: string;
  evaluator_user_id: string | null;
  evaluator_name: string;
  semaphore: SemaphoreColor;
  score: number | null;
  progress_percentage: number;
  notes: string;
  updated_at: string;
}

const FLAG_REHEARSAL_EVALS = "rehearsal_evaluations_store";
const FLAG_MUSICIAN_EVALS = "musician_evaluations_store";

export async function loadRehearsalEvaluations(organizationId: string, rehearsalId: string): Promise<{
  rehearsalEval: RehearsalEvaluation | null;
  musicianEvals: MusicianEvaluation[];
}> {
  const [rehRes, musRes] = await Promise.all([
    supabase
      .from("rehearsal_evaluations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rehearsal_id", rehearsalId)
      .maybeSingle(),
    supabase
      .from("musician_evaluations")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("rehearsal_id", rehearsalId),
  ]);

  if (!rehRes.error && !musRes.error) {
    return {
      rehearsalEval: (rehRes.data as unknown as RehearsalEvaluation | null) ?? null,
      musicianEvals: (musRes.data ?? []) as unknown as MusicianEvaluation[],
    };
  }

  if (isMissingTableOrRpcError(rehRes.error) || isMissingTableOrRpcError(musRes.error)) {
    const [storedReh, storedMus] = await Promise.all([
      readOrgFeatureFlag<RehearsalEvaluation[]>(organizationId, FLAG_REHEARSAL_EVALS, []),
      readOrgFeatureFlag<MusicianEvaluation[]>(organizationId, FLAG_MUSICIAN_EVALS, []),
    ]);
    return {
      rehearsalEval: storedReh.find((e) => e.rehearsal_id === rehearsalId) ?? null,
      musicianEvals: storedMus.filter((e) => e.rehearsal_id === rehearsalId),
    };
  }

  throw rehRes.error ?? musRes.error;
}

export async function saveRehearsalEvaluation(input: Omit<RehearsalEvaluation, "id" | "updated_at">): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing, error: selErr } = await supabase
    .from("rehearsal_evaluations")
    .select("id")
    .eq("rehearsal_id", input.rehearsal_id)
    .maybeSingle();

  if (!selErr) {
    if (existing?.id) {
      const { error } = await supabase
        .from("rehearsal_evaluations")
        .update({
          evaluator_user_id: input.evaluator_user_id,
          evaluator_name: input.evaluator_name,
          semaphore: input.semaphore,
          score: input.score,
          progress_percentage: input.progress_percentage,
          strengths: input.strengths || null,
          improvements: input.improvements || null,
          general_notes: input.general_notes || null,
          songs_worked: input.songs_worked,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("rehearsal_evaluations").insert({
        organization_id: input.organization_id,
        rehearsal_id: input.rehearsal_id,
        evaluator_user_id: input.evaluator_user_id,
        evaluator_name: input.evaluator_name,
        semaphore: input.semaphore,
        score: input.score,
        progress_percentage: input.progress_percentage,
        strengths: input.strengths || null,
        improvements: input.improvements || null,
        general_notes: input.general_notes || null,
        songs_worked: input.songs_worked,
        updated_at: now,
      });
      if (error) throw error;
    }
  } else if (isMissingTableOrRpcError(selErr)) {
    const all = await readOrgFeatureFlag<RehearsalEvaluation[]>(input.organization_id, FLAG_REHEARSAL_EVALS, []);
    const nextItem: RehearsalEvaluation = {
      ...input,
      id: all.find((item) => item.rehearsal_id === input.rehearsal_id)?.id ?? crypto.randomUUID(),
      updated_at: now,
    };
    await writeOrgFeatureFlag(
      input.organization_id,
      FLAG_REHEARSAL_EVALS,
      [...all.filter((item) => item.rehearsal_id !== input.rehearsal_id), nextItem],
    );
  } else {
    throw selErr;
  }

  await logAuditEvent({
    organizationId: input.organization_id,
    userId: input.evaluator_user_id,
    action: "EVALUATE_REHEARSAL",
    entityType: "rehearsal",
    entityId: input.rehearsal_id,
    newValue: { semaphore: input.semaphore, score: input.score, progress: input.progress_percentage },
  });
}

export async function saveMusicianEvaluation(input: Omit<MusicianEvaluation, "id" | "updated_at">): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing, error: selErr } = await supabase
    .from("musician_evaluations")
    .select("id")
    .eq("rehearsal_id", input.rehearsal_id)
    .eq("musician_id", input.musician_id)
    .maybeSingle();

  if (!selErr) {
    if (existing?.id) {
      const { error } = await supabase
        .from("musician_evaluations")
        .update({
          evaluator_user_id: input.evaluator_user_id,
          evaluator_name: input.evaluator_name,
          semaphore: input.semaphore,
          score: input.score,
          progress_percentage: input.progress_percentage,
          notes: input.notes || null,
          updated_at: now,
        })
        .eq("id", existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from("musician_evaluations").insert({
        organization_id: input.organization_id,
        rehearsal_id: input.rehearsal_id,
        musician_id: input.musician_id,
        evaluator_user_id: input.evaluator_user_id,
        evaluator_name: input.evaluator_name,
        semaphore: input.semaphore,
        score: input.score,
        progress_percentage: input.progress_percentage,
        notes: input.notes || null,
        updated_at: now,
      });
      if (error) throw error;
    }
  } else if (isMissingTableOrRpcError(selErr)) {
    const all = await readOrgFeatureFlag<MusicianEvaluation[]>(input.organization_id, FLAG_MUSICIAN_EVALS, []);
    const existingItem = all.find((item) => item.rehearsal_id === input.rehearsal_id && item.musician_id === input.musician_id);
    const nextItem: MusicianEvaluation = {
      ...input,
      id: existingItem?.id ?? crypto.randomUUID(),
      updated_at: now,
    };
    await writeOrgFeatureFlag(
      input.organization_id,
      FLAG_MUSICIAN_EVALS,
      [...all.filter((item) => !(item.rehearsal_id === input.rehearsal_id && item.musician_id === input.musician_id)), nextItem],
    );
  } else {
    throw selErr;
  }

  await logAuditEvent({
    organizationId: input.organization_id,
    userId: input.evaluator_user_id,
    action: "EVALUATE_MUSICIAN",
    entityType: "musician",
    entityId: input.musician_id,
    newValue: { rehearsal_id: input.rehearsal_id, semaphore: input.semaphore, score: input.score },
  });
}

export async function listEvaluationsForMusician(organizationId: string, musicianId: string): Promise<MusicianEvaluation[]> {
  const { data, error } = await supabase
    .from("musician_evaluations")
    .select("*,rehearsal:rehearsals(name,rehearsal_date)")
    .eq("organization_id", organizationId)
    .eq("musician_id", musicianId)
    .order("updated_at", { ascending: false });

  if (!error) {
    return ((data ?? []) as unknown as Array<MusicianEvaluation & { rehearsal?: { name?: string; rehearsal_date?: string } | null }>).map((row) => ({
      ...row,
      rehearsal_name: row.rehearsal?.name ?? row.rehearsal_name,
      rehearsal_date: row.rehearsal?.rehearsal_date ?? row.rehearsal_date,
    }));
  }

  if (isMissingTableOrRpcError(error)) {
    const all = await readOrgFeatureFlag<MusicianEvaluation[]>(organizationId, FLAG_MUSICIAN_EVALS, []);
    return all
      .filter((item) => item.musician_id === musicianId)
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }

  throw error;
}
