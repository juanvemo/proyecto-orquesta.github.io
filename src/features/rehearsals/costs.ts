import { supabase } from "@/integrations/supabase/client";

export interface RehearsalContribution {
  id: string;
  musician_id: string;
  amount_due: number;
  status: "PENDIENTE" | "PAGADO";
  paid_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  musician: { id: string; first_name: string; last_name: string; photo_url: string | null; user_id: string | null } | null;
}
export interface RehearsalCost { id: string; organization_id: string; rehearsal_id: string; total_amount: number; description: string | null; collector_user_id: string | null; collector_name: string; rehearsal_contributions: RehearsalContribution[]; }

export async function loadRehearsalCost(rehearsalId: string) {
  const { data, error } = await supabase.from("rehearsal_costs").select("*,rehearsal_contributions(*,musician:musicians(id,first_name,last_name,photo_url,user_id))").eq("rehearsal_id", rehearsalId).maybeSingle();
  if (error) throw error;
  return data as unknown as RehearsalCost | null;
}

export async function saveRehearsalCost(input: { organizationId: string; rehearsalId: string; totalAmount: number; description: string; collectorUserId: string; collectorName: string; contributions: Array<{ musicianId: string; amount: number }> }) {
  const { data: cost, error: costError } = await supabase.from("rehearsal_costs").upsert({ organization_id: input.organizationId, rehearsal_id: input.rehearsalId, total_amount: input.totalAmount, description: input.description.trim() || null, collector_user_id: input.collectorUserId, collector_name: input.collectorName.trim() || "Director", created_by: input.collectorUserId, updated_at: new Date().toISOString() }, { onConflict: "rehearsal_id" }).select("id").single();
  if (costError) throw costError;
  const currentResult = await supabase.from("rehearsal_contributions").select("musician_id,status").eq("rehearsal_cost_id", cost.id);
  if (currentResult.error) throw currentResult.error;
  const paidIds = new Set((currentResult.data ?? []).filter((item) => item.status === "PAGADO").map((item) => item.musician_id));
  const desiredIds = input.contributions.filter((item) => item.amount > 0).map((item) => item.musicianId);
  const removedIds = (currentResult.data ?? []).filter((item) => !desiredIds.includes(item.musician_id) && item.status === "PENDIENTE").map((item) => item.musician_id);
  if (removedIds.length) { const { error } = await supabase.from("rehearsal_contributions").delete().eq("rehearsal_cost_id", cost.id).in("musician_id", removedIds); if (error) throw error; }
  const rows = input.contributions.filter((item) => item.amount > 0 && !paidIds.has(item.musicianId)).map((item) => ({ organization_id: input.organizationId, rehearsal_cost_id: cost.id, musician_id: item.musicianId, amount_due: item.amount, updated_at: new Date().toISOString() }));
  if (rows.length) { const { error } = await supabase.from("rehearsal_contributions").upsert(rows, { onConflict: "rehearsal_cost_id,musician_id", ignoreDuplicates: false }); if (error) throw error; }
  return cost.id;
}

export async function confirmContributionPayment(id: string, userId: string, organizationId: string) {
  const paidAt = new Date().toISOString();
  const { error } = await supabase.from("rehearsal_contributions").update({ status: "PAGADO", paid_at: paidAt, confirmed_by: userId, updated_at: paidAt }).eq("id", id);
  if (error) throw error;
  const { error: auditError } = await supabase.from("audit_logs").insert({ organization_id: organizationId, user_id: userId, action: "PAY", entity_type: "rehearsal_contribution", entity_id: id, new_value: { status: "PAGADO", paid_at: paidAt } });
  if (auditError) throw auditError;
}
