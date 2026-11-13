import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { isMissingTableOrRpcError, readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";
import type { SwotFactor, SwotGap } from "./types";

const FACTORS_KEY = "swot_factors_store";
const GAPS_KEY = "swot_gaps_store";

export async function listSwotData(organizationId: string): Promise<{ factors: SwotFactor[]; gaps: SwotGap[] }> {
  const [factorsRes, gapsRes] = await Promise.all([
    supabase
      .from("swot_factors" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: false }),
    supabase
      .from("swot_gaps" as never)
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false }),
  ]);

  let factors: SwotFactor[];
  if (!factorsRes.error) {
    factors = (factorsRes.data ?? []) as unknown as SwotFactor[];
  } else if (isMissingTableOrRpcError(factorsRes.error)) {
    factors = await readOrgFeatureFlag<SwotFactor[]>(organizationId, FACTORS_KEY, []);
  } else {
    throw factorsRes.error;
  }

  let gaps: SwotGap[];
  if (!gapsRes.error) {
    gaps = (gapsRes.data ?? []) as unknown as SwotGap[];
  } else if (isMissingTableOrRpcError(gapsRes.error)) {
    gaps = await readOrgFeatureFlag<SwotGap[]>(organizationId, GAPS_KEY, []);
  } else {
    throw gapsRes.error;
  }

  return { factors, gaps };
}

export async function saveSwotFactor(
  organizationId: string,
  userId: string,
  input: Partial<SwotFactor> & Pick<SwotFactor, "quadrant" | "title">,
): Promise<SwotFactor> {
  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    quadrant: input.quadrant,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    impact: input.impact ?? "MEDIO",
    priority: Number(input.priority ?? 2),
    responsible: input.responsible?.trim() || null,
    target_date: input.target_date || null,
    status: input.status ?? "ACTIVO",
    strategic_action: input.strategic_action?.trim() || null,
    updated_at: now,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("swot_factors" as never)
      .update(payload as never)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (!error && data) {
      await logAuditEvent({ organizationId, userId, action: "UPDATE", entityType: "swot_factor", entityId: input.id, newValue: payload });
      return data as unknown as SwotFactor;
    }
    if (error && !isMissingTableOrRpcError(error)) throw error;

    const current = await readOrgFeatureFlag<SwotFactor[]>(organizationId, FACTORS_KEY, []);
    const next = current.map((item) => (item.id === input.id ? { ...item, ...payload } : item));
    await writeOrgFeatureFlag(organizationId, FACTORS_KEY, next);
    const updated = next.find((item) => item.id === input.id);
    if (!updated) throw new Error("Factor no encontrado");
    return updated;
  }

  const insertRow = {
    ...payload,
    created_by: userId,
    created_at: now,
  };
  const { data, error } = await supabase
    .from("swot_factors" as never)
    .insert(insertRow as never)
    .select("*")
    .single();
  if (!error && data) {
    const saved = data as unknown as SwotFactor;
    await logAuditEvent({ organizationId, userId, action: "CREATE", entityType: "swot_factor", entityId: saved.id, newValue: payload });
    return saved;
  }
  if (error && !isMissingTableOrRpcError(error)) throw error;

  const current = await readOrgFeatureFlag<SwotFactor[]>(organizationId, FACTORS_KEY, []);
  const created: SwotFactor = { ...(insertRow as Omit<SwotFactor, "id">), id: crypto.randomUUID() };
  await writeOrgFeatureFlag(organizationId, FACTORS_KEY, [created, ...current]);
  return created;
}

export async function deleteSwotFactor(organizationId: string, userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("swot_factors" as never)
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (!error) {
    await logAuditEvent({ organizationId, userId, action: "DELETE", entityType: "swot_factor", entityId: id });
    return;
  }
  if (!isMissingTableOrRpcError(error)) throw error;
  const current = await readOrgFeatureFlag<SwotFactor[]>(organizationId, FACTORS_KEY, []);
  await writeOrgFeatureFlag(organizationId, FACTORS_KEY, current.filter((item) => item.id !== id));
}

export async function saveSwotGap(
  organizationId: string,
  userId: string,
  input: Partial<SwotGap> & Pick<SwotGap, "area" | "current_state" | "desired_state" | "gap_description" | "action_plan">,
): Promise<SwotGap> {
  const now = new Date().toISOString();
  const payload = {
    organization_id: organizationId,
    area: input.area.trim(),
    current_state: input.current_state.trim(),
    desired_state: input.desired_state.trim(),
    gap_description: input.gap_description.trim(),
    action_plan: input.action_plan.trim(),
    responsible: input.responsible?.trim() || null,
    priority: input.priority ?? "ALTA",
    status: input.status ?? "IDENTIFICADA",
    due_date: input.due_date || null,
    updated_at: now,
  };

  if (input.id) {
    const { data, error } = await supabase
      .from("swot_gaps" as never)
      .update(payload as never)
      .eq("id", input.id)
      .eq("organization_id", organizationId)
      .select("*")
      .single();
    if (!error && data) {
      await logAuditEvent({ organizationId, userId, action: "UPDATE", entityType: "swot_gap", entityId: input.id, newValue: payload });
      return data as unknown as SwotGap;
    }
    if (error && !isMissingTableOrRpcError(error)) throw error;
    const current = await readOrgFeatureFlag<SwotGap[]>(organizationId, GAPS_KEY, []);
    const next = current.map((item) => (item.id === input.id ? { ...item, ...payload } : item));
    await writeOrgFeatureFlag(organizationId, GAPS_KEY, next);
    const updated = next.find((item) => item.id === input.id);
    if (!updated) throw new Error("Brecha no encontrada");
    return updated;
  }

  const insertRow = { ...payload, created_by: userId, created_at: now };
  const { data, error } = await supabase
    .from("swot_gaps" as never)
    .insert(insertRow as never)
    .select("*")
    .single();
  if (!error && data) {
    const saved = data as unknown as SwotGap;
    await logAuditEvent({ organizationId, userId, action: "CREATE", entityType: "swot_gap", entityId: saved.id, newValue: payload });
    return saved;
  }
  if (error && !isMissingTableOrRpcError(error)) throw error;
  const current = await readOrgFeatureFlag<SwotGap[]>(organizationId, GAPS_KEY, []);
  const created: SwotGap = { ...(insertRow as Omit<SwotGap, "id">), id: crypto.randomUUID() };
  await writeOrgFeatureFlag(organizationId, GAPS_KEY, [created, ...current]);
  return created;
}

export async function deleteSwotGap(organizationId: string, userId: string, id: string): Promise<void> {
  const { error } = await supabase
    .from("swot_gaps" as never)
    .delete()
    .eq("id", id)
    .eq("organization_id", organizationId);
  if (!error) {
    await logAuditEvent({ organizationId, userId, action: "DELETE", entityType: "swot_gap", entityId: id });
    return;
  }
  if (!isMissingTableOrRpcError(error)) throw error;
  const current = await readOrgFeatureFlag<SwotGap[]>(organizationId, GAPS_KEY, []);
  await writeOrgFeatureFlag(organizationId, GAPS_KEY, current.filter((item) => item.id !== id));
}
