import { supabase } from "@/integrations/supabase/client";
import { logAuditEvent } from "@/lib/audit";
import { isMissingTableOrRpcError, readOrgFeatureFlag, writeOrgFeatureFlag } from "@/lib/orgStore";

export interface AdminSecurityFallbackConfig {
  userId: string;
  identifier: string;
  question: string;
  answerHash: string;
  failedAttempts: number;
  lockedUntil: string | null;
  mustChangePassword?: boolean;
  updatedAt: string;
}

const FLAG_KEY = "admin_security_recovery_config";

export async function sha256Hex(value: string): Promise<string> {
  const normalized = value.trim().toLowerCase();
  const data = new TextEncoder().encode(`po-sec:${normalized}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function hasAdminSecurityConfigured(organizationId: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("admin_security_recovery")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!error && data) return true;
  if (error && !isMissingTableOrRpcError(error)) {
    // Also check fallback in case RLS or partial setup
  }

  const fallback = await readOrgFeatureFlag<AdminSecurityFallbackConfig | null>(organizationId, FLAG_KEY, null);
  return Boolean(fallback && fallback.userId === userId && fallback.question);
}

export async function saveAdminSecurityQuestion(input: {
  organizationId: string;
  userId: string;
  identifier: string;
  question: string;
  answer: string;
}): Promise<void> {
  if (input.question.trim().length < 6) throw new Error("Escribe una pregunta de seguridad más descriptiva");
  if (input.answer.trim().length < 2) throw new Error("Escribe una respuesta válida de al menos 2 caracteres");

  const { error } = await supabase.rpc("configure_admin_security", {
    target_organization_id: input.organizationId,
    security_question: input.question.trim(),
    security_answer: input.answer.trim(),
  });

  if (error && !isMissingTableOrRpcError(error)) throw error;

  // Always keep fallback hash synced so recovery works seamlessly
  const answerHash = await sha256Hex(input.answer);
  await writeOrgFeatureFlag<AdminSecurityFallbackConfig>(input.organizationId, FLAG_KEY, {
    userId: input.userId,
    identifier: input.identifier.trim().toLowerCase(),
    question: input.question.trim(),
    answerHash,
    failedAttempts: 0,
    lockedUntil: null,
    mustChangePassword: false,
    updatedAt: new Date().toISOString(),
  });

  await logAuditEvent({
    organizationId: input.organizationId,
    userId: input.userId,
    action: "UPDATE",
    entityType: "admin_security_question",
    entityId: input.userId,
    newValue: { configured: true },
  });
}

export async function lookupAdminSecurityQuestion(identifier: string): Promise<{
  eligible: boolean;
  reason?: string;
  firstName?: string;
  question?: string;
  lockedUntil?: string | null;
}> {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return { eligible: false, reason: "INVALID" };

  const { data, error } = await supabase.rpc("get_admin_security_question", {
    identifier_value: clean,
  });

  if (!error && data && typeof data === "object") {
    const res = data as Record<string, unknown>;
    return {
      eligible: Boolean(res.eligible),
      reason: typeof res.reason === "string" ? res.reason : undefined,
      firstName: typeof res.first_name === "string" ? res.first_name : undefined,
      question: typeof res.question === "string" ? res.question : undefined,
      lockedUntil: typeof res.locked_until === "string" ? res.locked_until : null,
    };
  }

  if (error && !isMissingTableOrRpcError(error)) {
    throw error;
  }

  return { eligible: false, reason: "RPC_UNAVAILABLE" };
}

export async function resetAdminPasswordBySecurityAnswer(input: {
  identifier: string;
  answer: string;
  newPassword: string;
}): Promise<void> {
  if (input.newPassword.length < 8) {
    throw new Error("La nueva contraseña debe tener mínimo 8 caracteres");
  }
  const { error } = await supabase.rpc("reset_admin_password_with_security_answer", {
    identifier_value: input.identifier.trim().toLowerCase(),
    answer_value: input.answer.trim(),
    new_password: input.newPassword,
  });
  if (error) {
    if (isMissingTableOrRpcError(error)) {
      throw new Error(
        "Para restablecer la contraseña sin sesión activa ejecuta la migración SQL de seguridad en Supabase Dashboard."
      );
    }
    throw error;
  }
}

export async function changeCurrentUserPassword(input: {
  organizationId: string;
  userId: string;
  newPassword: string;
}): Promise<void> {
  if (input.newPassword.length < 8) {
    throw new Error("La nueva contraseña debe tener mínimo 8 caracteres");
  }
  const { error } = await supabase.auth.updateUser({
    password: input.newPassword,
    data: { must_change_password: false },
  });
  if (error) throw error;

  await logAuditEvent({
    organizationId: input.organizationId,
    userId: input.userId,
    action: "PASSWORD_CHANGED",
    entityType: "user_credentials",
    entityId: input.userId,
    newValue: { changed_at: new Date().toISOString() },
  });
}
