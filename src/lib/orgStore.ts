import { supabase } from "@/integrations/supabase/client";

export function isMissingTableOrRpcError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const err = error as { code?: string; message?: string; status?: number };
  const code = String(err.code ?? "");
  const msg = String(err.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST205" ||
    code === "PGRST202" ||
    err.status === 404 ||
    msg.includes("does not exist") ||
    msg.includes("could not find the table") ||
    msg.includes("could not find the function") ||
    msg.includes("schema cache")
  );
}

export async function readOrgFeatureFlag<T>(organizationId: string, key: string, fallback: T): Promise<T> {
  const { data, error } = await supabase
    .from("organization_settings")
    .select("feature_flags")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error || !data?.feature_flags || typeof data.feature_flags !== "object") return fallback;
  const flags = data.feature_flags as Record<string, unknown>;
  return (flags[key] as T | undefined) ?? fallback;
}

export async function writeOrgFeatureFlag<T>(organizationId: string, key: string, value: T): Promise<void> {
  const { data, error } = await supabase
    .from("organization_settings")
    .select("feature_flags")
    .eq("organization_id", organizationId)
    .maybeSingle();
  if (error) throw error;
  const currentFlags = (data?.feature_flags && typeof data.feature_flags === "object"
    ? data.feature_flags
    : {}) as Record<string, unknown>;
  const { error: updateError } = await supabase
    .from("organization_settings")
    .update({
      feature_flags: { ...currentFlags, [key]: value },
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);
  if (updateError) throw updateError;
}
