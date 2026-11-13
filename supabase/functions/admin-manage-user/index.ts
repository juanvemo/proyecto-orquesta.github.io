import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const headers = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return new Response(JSON.stringify({ error: "No autorizado" }), { status: 401, headers });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const token = authHeader.replace("Bearer ", "");
    const { data: authData, error: authError } = await userClient.auth.getUser(token);
    if (authError || !authData.user) return new Response(JSON.stringify({ error: "Sesión no válida" }), { status: 401, headers });

    const body = await req.json();
    const action = String(body.action ?? "update");
    const organizationId = String(body.organization_id ?? "");
    const targetUserId = String(body.user_id ?? "");
    if (!organizationId) return new Response(JSON.stringify({ error: "Datos incompletos" }), { status: 400, headers });

    const { data: allowed } = await userClient.rpc("has_org_permission", { target_organization_id: organizationId, permission_key: "users.approve" });
    if (!allowed) return new Response(JSON.stringify({ error: "No tienes permiso para administrar usuarios" }), { status: 403, headers });

    const admin = createClient(supabaseUrl, serviceKey);

    if (action === "create") {
      const firstName = String(body.first_name ?? "").trim();
      const lastName = String(body.last_name ?? "").trim();
      const identifier = String(body.identifier ?? "").trim().toLowerCase();
      const password = String(body.password ?? "");
      const roleId = String(body.role_id ?? "");
      const isEmail = identifier.includes("@");
      const username = isEmail ? null : identifier;
      if (firstName.length < 2 || lastName.length < 2 || password.length < 8 || !roleId) return new Response(JSON.stringify({ error: "Completa nombre, apellidos, rol y una contraseña de mínimo 8 caracteres" }), { status: 400, headers });
      if (isEmail && (identifier.startsWith("@") || identifier.endsWith("@") || /\s/.test(identifier))) return new Response(JSON.stringify({ error: "El correo no es válido" }), { status: 400, headers });
      if (username && !/^[a-z0-9._-]{3,30}$/.test(username)) return new Response(JSON.stringify({ error: "El usuario debe tener entre 3 y 30 caracteres: letras, números, punto, guion o guion bajo" }), { status: 400, headers });
      const { data: role } = await admin.from("roles").select("id").eq("id", roleId).eq("organization_id", organizationId).maybeSingle();
      if (!role) return new Response(JSON.stringify({ error: "El rol seleccionado no es válido" }), { status: 400, headers });
      const authEmail = isEmail ? identifier : `${username}@usuarios.proyecto-orquesta.local`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: authEmail,
        password,
        email_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
        app_metadata: { provisioning_method: "admin", organization_id: organizationId, role_id: roleId, username },
      });
      if (createError || !created.user) return new Response(JSON.stringify({ error: createError?.message ?? "No fue posible crear el usuario" }), { status: 409, headers });

      const { data: savedProfile, error: profileError } = await admin.from("profiles").update({ first_name: firstName, last_name: lastName, email: authEmail, username, profile_completed_at: null, updated_at: new Date().toISOString() }).eq("id", created.user.id).select("id").single();
      const { data: savedMembership, error: membershipError } = await admin.from("organization_memberships").upsert({ organization_id: organizationId, user_id: created.user.id, role_id: roleId, approval_status: "APPROVED", approved_by: authData.user.id, approved_at: new Date().toISOString() }, { onConflict: "organization_id,user_id" }).select("id").single();
      if (profileError || membershipError || !savedProfile || !savedMembership) {
        await admin.auth.admin.deleteUser(created.user.id);
        console.error("[admin-manage-user] Alta revertida por error de perfil o membresía", { profileError: profileError?.message, membershipError: membershipError?.message });
        return new Response(JSON.stringify({ error: "No se pudo completar el perfil y el acceso. El alta fue revertida; puedes intentarlo nuevamente." }), { status: 500, headers });
      }

      await admin.from("audit_logs").insert({ organization_id: organizationId, user_id: authData.user.id, action: "CREATE", entity_type: "user", entity_id: created.user.id, new_value: { login_identifier: identifier, role_id: roleId, requires_profile_completion: true, email_sent: false } });
      console.log("[admin-manage-user] Usuario creado sin envío de correo", { actor: authData.user.id, target: created.user.id, loginType: isEmail ? "email" : "username" });
      return new Response(JSON.stringify({ success: true, user_id: created.user.id, login_identifier: identifier }), { status: 200, headers });
    }

    if (!targetUserId) return new Response(JSON.stringify({ error: "Usuario requerido" }), { status: 400, headers });
    const { data: membership } = await admin.from("organization_memberships").select("id,role_id,roles(code)").eq("organization_id", organizationId).eq("user_id", targetUserId).maybeSingle();
    if (!membership) return new Response(JSON.stringify({ error: "El usuario no pertenece a esta organización" }), { status: 404, headers });

    if (action === "delete") {
      if (targetUserId === authData.user.id) return new Response(JSON.stringify({ error: "No puedes eliminar tu propio usuario administrador" }), { status: 400, headers });

      const { data: actorMembership } = await admin.from("organization_memberships").select("roles(code)").eq("organization_id", organizationId).eq("user_id", authData.user.id).eq("approval_status", "APPROVED").maybeSingle();
      const actorRole = (actorMembership?.roles as { code?: string } | null)?.code;
      if (actorRole !== "ADMIN") return new Response(JSON.stringify({ error: "Solo el administrador puede eliminar usuarios" }), { status: 403, headers });

      const targetRole = (membership.roles as { code?: string } | null)?.code;
      if (targetRole === "ADMIN") {
        const { count } = await admin.from("organization_memberships").select("id,roles!inner(code)", { count: "exact", head: true }).eq("organization_id", organizationId).eq("approval_status", "APPROVED").eq("roles.code", "ADMIN");
        if ((count ?? 0) <= 1) return new Response(JSON.stringify({ error: "No se puede eliminar el último administrador" }), { status: 409, headers });
      }

      const anonymize = Boolean(body.anonymize);
      const { data: musician } = await admin.from("musicians").select("id,first_name,last_name").eq("organization_id", organizationId).eq("user_id", targetUserId).maybeSingle();
      if (musician) {
        const snapshot = anonymize ? "Músico retirado (anonimizado)" : `${musician.first_name} ${musician.last_name}`.trim();
        await Promise.all([
          admin.from("event_musicians").update({ musician_name_snapshot: snapshot, musician_id: null } as Record<string, unknown>).eq("musician_id", musician.id),
          admin.from("rehearsal_attendance").update({ musician_name_snapshot: snapshot, musician_id: null } as Record<string, unknown>).eq("musician_id", musician.id),
          admin.from("rehearsal_contributions").update({ musician_name_snapshot: snapshot, musician_id: null } as Record<string, unknown>).eq("musician_id", musician.id),
          admin.from("music_task_assignees").update({ musician_name_snapshot: snapshot, musician_id: null } as Record<string, unknown>).eq("musician_id", musician.id),
          admin.from("rehearsal_musicians").delete().eq("musician_id", musician.id),
          admin.from("availability").delete().eq("musician_id", musician.id),
          admin.from("musician_instruments").delete().eq("musician_id", musician.id),
          admin.from("musician_roles").delete().eq("musician_id", musician.id),
          admin.from("rehearsals").update({ responsible_musician_id: null }).eq("responsible_musician_id", musician.id),
        ]);

        const { error: musicianDeleteError } = await admin.from("musicians").delete().eq("id", musician.id).eq("organization_id", organizationId);
        if (musicianDeleteError) throw musicianDeleteError;
      }

      const nullableReferences = [
        ["audit_logs", "user_id"], ["commercial_timeline", "actor_user_id"], ["event_availability", "checked_by"],
        ["event_riders", "created_by"], ["events", "created_by"], ["financial_transactions", "created_by"],
        ["organization_memberships", "approved_by"], ["quote_versions", "created_by"], ["quotes", "created_by"],
      ] as const;
      for (const [table, column] of nullableReferences) {
        const { error } = await admin.from(table).update({ [column]: null }).eq(column, targetUserId);
        if (error) throw error;
      }

      const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);
      if (deleteError) throw deleteError;
      await admin.from("audit_logs").insert({ organization_id: organizationId, user_id: authData.user.id, action: "DELETE", entity_type: "user", entity_id: targetUserId, previous_value: { role: targetRole, musician_id: musician?.id ?? null }, new_value: { deleted: true, anonymized: anonymize, history_preserved: true } });
      console.log("[admin-manage-user] Usuario eliminado definitivamente", { actor: authData.user.id, target: targetUserId, musician: musician?.id ?? null });
      return new Response(JSON.stringify({ success: true }), { status: 200, headers });
    }

    const firstName = String(body.first_name ?? "").trim();
    const lastName = String(body.last_name ?? "").trim();
    const password = body.password ? String(body.password) : "";
    if (firstName.length < 2 || lastName.length < 2) return new Response(JSON.stringify({ error: "Datos incompletos" }), { status: 400, headers });
    if (password && password.length < 8) return new Response(JSON.stringify({ error: "La contraseña debe tener mínimo 8 caracteres" }), { status: 400, headers });

    const { error: profileError } = await admin.from("profiles").update({ first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() }).eq("id", targetUserId);
    if (profileError) throw profileError;
    const { error: musicianError } = await admin.from("musicians").update({ first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() }).eq("organization_id", organizationId).eq("user_id", targetUserId);
    if (musicianError) throw musicianError;

    const updatePayload: { password?: string; user_metadata: { first_name: string; last_name: string } } = { user_metadata: { first_name: firstName, last_name: lastName } };
    if (password) updatePayload.password = password;
    const { error: userError } = await admin.auth.admin.updateUserById(targetUserId, updatePayload);
    if (userError) throw userError;

    await admin.from("audit_logs").insert({ organization_id: organizationId, user_id: authData.user.id, action: "UPDATE", entity_type: "user_credentials", entity_id: targetUserId, new_value: { first_name: firstName, last_name: lastName, password_changed: Boolean(password) } });
    console.log("[admin-manage-user] Usuario actualizado", { actor: authData.user.id, target: targetUserId, passwordChanged: Boolean(password) });
    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error) {
    console.error("[admin-manage-user] Error administrando usuario", { error: error instanceof Error ? error.message : String(error) });
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Error interno" }), { status: 500, headers });
  }
});
