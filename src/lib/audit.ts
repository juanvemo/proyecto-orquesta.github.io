import { supabase } from "@/integrations/supabase/client";

export async function logAuditEvent(input: {
  organizationId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  previousValue?: unknown;
  newValue?: unknown;
}) {
  try {
    await supabase.from("audit_logs").insert({
      organization_id: input.organizationId,
      user_id: input.userId ?? null,
      action: input.action,
      entity_type: input.entityType,
      entity_id: input.entityId ?? null,
      previous_value: (input.previousValue as Record<string, unknown> | undefined) ?? null,
      new_value: (input.newValue as Record<string, unknown> | undefined) ?? null,
    });
  } catch {
    // Non-blocking audit log fallback for restricted roles
  }
}
