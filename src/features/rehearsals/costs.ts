import { supabase } from "@/integrations/supabase/client";

export interface RehearsalContribution {
  id: string;
  musician_id: string;
  amount_due: number;
  status: "PENDIENTE" | "PAGADO";
  contribution_date: string | null;
  paid_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
  musician: { id: string; first_name: string; last_name: string; photo_url: string | null; user_id: string | null } | null;
}
export interface RehearsalCost { id: string; organization_id: string; rehearsal_id: string; total_amount: number; description: string | null; collector_user_id: string | null; collector_name: string; rehearsal_contributions: RehearsalContribution[]; }

export function contributionErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object" && "message" in error && typeof error.message === "string") {
    const code = "code" in error && typeof error.code === "string" ? ` (${error.code})` : "";
    return `${error.message}${code}`;
  }
  return "No se recibió una respuesta válida del servidor.";
}

export async function loadRehearsalCost(rehearsalId: string, organizationId: string) {
  const { data, error } = await supabase.from("rehearsal_costs")
    .select("*,rehearsal_contributions(*,musician:musicians(id,first_name,last_name,photo_url,user_id))")
    .eq("rehearsal_id", rehearsalId).eq("organization_id", organizationId).maybeSingle();
  if (error) throw error;
  return data as unknown as RehearsalCost | null;
}

export async function saveRehearsalCost(input: {
  organizationId: string;
  rehearsalId: string;
  totalAmount: number;
  description: string;
  collectorName: string;
  contributions: Array<{ id?: string; musicianId: string; amount: number; date: string; notes: string }>;
}) {
  const { data, error } = await supabase.rpc("save_rehearsal_distribution", {
    target_organization_id: input.organizationId,
    target_rehearsal_id: input.rehearsalId,
    cost_amount: input.totalAmount,
    cost_description: input.description,
    collector_name_value: input.collectorName,
    contributions_data: input.contributions.map((item) => ({
      musician_id: item.musicianId,
      contribution_id: item.id ?? null,
      amount: item.amount,
      contribution_date: item.date || null,
      notes: item.notes,
    })),
  });
  if (error) throw error;
  return data as string;
}

export async function confirmContributionPayment(id: string, organizationId: string, date: string, note: string) {
  const { error } = await supabase.rpc("confirm_rehearsal_payment", {
    target_contribution_id: id,
    target_organization_id: organizationId,
    payment_date: date || null,
    payment_note: note,
  });
  if (error) throw error;
}
